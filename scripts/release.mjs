#!/usr/bin/env node
// scripts/release.mjs — 一条命令发版：测试 → 构建 → 发布前校验 → npm publish → 生效轮询 → dist-tags 核对。
//
// 为什么需要它：npm 的发布是**异步**的。PUT 返回 202（甚至 200）之后 registry 还要 1–4 分钟
// 才真正生效——刚发布完立刻 npm view 会拿到旧的 latest，或者只看到一个 0.0.0-stage 占位包。
// 手工发版时这一步最容易误判成「发布失败」，然后重复 publish 撞 E403。脚本把等待和核对做掉。
//
// 用法：
//   npm run release              # 完整发版
//   npm run release -- --dry-run # 只跑到发布前校验，不 publish
//
// 环境变量：NPM_TOKEN（可选，不设就用本机已登录的 npm）；NPM_CLI（可选，指定 npm-cli.js 路径）。
import { execFileSync, execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = path.resolve(new URL('..', import.meta.url).pathname);
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const npmBin = process.env.NPM_CLI || 'npm';

const DRY_RUN = process.argv.includes('--dry-run');
const step = (msg) => console.log(`\n▸ ${msg}`);
const ok = (msg) => console.log(`  ✓ ${msg}`);
const warn = (msg) => console.log(`  ⚠ ${msg}`);
const die = (msg) => { console.error(`\n✗ ${msg}`); process.exit(1); };

/** 跑命令并返回 stdout；失败抛出。 */
function run(cmd, args, opts = {}) {
    return execFileSync(cmd, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
}

/** HEAD 请求 tarball：npm 生效前是 404，生效后是 200。 */
async function tarballReady(url) {
    try {
        const res = await fetch(url, { method: 'HEAD' });
        return res.status === 200;
    } catch {
        return false;
    }
}

async function main() {
    console.log(`dsh-xuanji 发版 · v${pkg.version}${DRY_RUN ? '（dry-run，不发布）' : ''}`);

    // ① 工作区必须是干净的——否则发出去的包里混着未提交的改动，事后无法复现
    step('校验 git 工作区');
    const status = run('git', ['status', '--porcelain']).trim();
    if (status) die(`工作区不干净，先提交或 stash：\n${status.split('\n').slice(0, 8).join('\n')}`);
    ok('工作区干净');

    // ② 构建产物与源码同步：lib/client.js 是构建出来的，忘跑 build 会把旧界面发出去
    step('构建 client 并校验产物同步');
    run(npmBin, ['run', 'build'], { stdio: ['ignore', 'ignore', 'pipe'] });
    const afterBuild = run('git', ['status', '--porcelain']).trim();
    if (afterBuild) die(`build 之后工作区出现改动，说明 lib/client.js 与源码不同步：\n${afterBuild}`);
    ok('lib/client.js 与 src 同步');

    // ③ 全量测试
    step('跑全量测试');
    run(npmBin, ['test'], { stdio: ['ignore', 'ignore', 'pipe'] });
    ok('测试通过');

    // ④ registry 上不能已经有这个版本——重复 publish 会被拒且留下坏印象
    step(`检查 registry 是否已有 v${pkg.version}`);
    let published = false;
    try {
        const view = run(npmBin, ['view', `${pkg.name}@${pkg.version}`, 'version']);
        published = view.trim() === pkg.version;
    } catch {
        published = false; // 404 = 还没发，正常
    }
    if (published) die(`registry 上已有 ${pkg.name}@${pkg.version}——先改 package.json 的版本号（并同步 src/client/index.js 的 PLUGIN_VERSION）`);
    ok('版本号可用');

    if (DRY_RUN) { console.log('\n✓ dry-run 结束：发布前校验全部通过，未执行 publish。'); return; }

    // ⑤ 发布
    step('npm publish');
    const env = { ...process.env };
    if (process.env.NPM_TOKEN) {
        // token 只走环境变量，不落盘到 .npmrc
        env.npm_config__auth = process.env.NPM_TOKEN;
        env.NPM_TOKEN = process.env.NPM_TOKEN;
    }
    try {
        const out = await execFileAsync(npmBin, ['publish', '--json'], { cwd: root, env });
        console.log(`  ${out.stdout.trim().split('\n').pop()}`);
    } catch (e) {
        die(`publish 失败：${(e.stderr || e.stdout || e.message).toString().slice(0, 600)}`);
    }

    // ⑥ 轮询生效：tarball 能取到才算真的发布了
    step('等待 registry 生效（npm 异步，实测 1–4 分钟）');
    const url = `https://registry.npmjs.org/${pkg.name}/-/${pkg.name}-${pkg.version}.tgz`;
    const deadline = Date.now() + 6 * 60 * 1000;
    let ready = false;
    while (Date.now() < deadline) {
        ready = await tarballReady(url);
        if (ready) break;
        await new Promise((r) => setTimeout(r, 10_000));
    }
    if (!ready) {
        warn(`6 分钟内没等到 tarball 生效——发布已提交，稍后自查：npm view ${pkg.name} versions`);
    } else {
        ok(`tarball 已可下载：${url}`);
    }

    // ⑦ dist-tags：latest 必须指向刚发的版本，否则用户 npm install 拿到的还是旧版
    step('核对 dist-tags');
    try {
        const latest = run(npmBin, ['view', pkg.name, 'dist-tags.latest']).trim();
        if (latest === pkg.version) {
            ok(`latest = ${latest}`);
        } else {
            warn(`latest 仍指向 ${latest}，手动修：npm dist-tag add ${pkg.name}@${pkg.version} latest`);
        }
    } catch (e) {
        warn(`读取 dist-tags 失败：${e.message}`);
    }

    console.log(`\n✓ v${pkg.version} 发布完成。后续（脚本不动 git）：`);
    console.log(`  git tag v${pkg.version} && git push && git push origin v${pkg.version}`);
}

main().catch((e) => die(e.message));
