#!/usr/bin/env node
// scripts/generate-offline-page.mjs — 生成 docs/offline.html（离线单页快照，P2 交付）。
//
// 定位：无宿主、无网络也能打开的「能力说明书 + 公开对拍快照」——
//   · 工具目录：全部 xuanji_* 工具的名字与能力一句话（直接用真实注册面，不手抄）；
//   · 排盘纪律：九条铁律全文（照搬 XUANJI_DISCIPLINE）；
//   · 对拍锚点：runVerification 的独立重算结果（与 CI 闸门同源）。
// 单文件零依赖零外链；用户可控字段一律过 escapeHtml（闸门测试盯这条）。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { apply } from '../lib/index.js';
import { XUANJI_DISCIPLINE } from '../lib/discipline.js';
import { runVerification, summarize } from '../lib/engine/verify.js';
import { escapeHtml } from '../lib/tools/common.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 假宿主 boot：只为了拿真实注册的工具描述，不引入 fs。
const registered = [];
apply(
    {
        tools: { register: (t) => registered.push(t) },
        systemPrompt: { section: () => {} },
        plugin: () => {},
        logger: { info() {}, warn() {} },
    },
    { dayunCount: 8, skipSkillRegister: true },
);

const { results, allPass, pass, total } = summarize(runVerification());

const toolRows = registered.map((t) => {
    const firstSentence = String(t.description ?? '').split(/[。；;]/)[0];
    return `<tr><td class="tool">${escapeHtml(t.name)}</td><td>${escapeHtml(firstSentence)}。</td></tr>`;
}).join('');

const disciplineList = XUANJI_DISCIPLINE
    .split('\n')
    .filter((line) => line.trim() !== '' && !line.startsWith('dsh-xuanji（'))
    .map((line) => `<li>${escapeHtml(line.replace(/^\d+\.\s*/, ''))}</li>`)
    .join('');
const anchorRows = results.map((r) => `
  <tr class="${r.pass ? 'ok' : 'bad'}">
    <td>${escapeHtml(r.group)}</td><td>${escapeHtml(r.name)}</td>
    <td>${r.pass ? '通过' : '失败'}</td><td class="detail">${escapeHtml(r.detail ?? '')}</td>
  </tr>`).join('');

const html = `<!doctype html>
<html lang="zh"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>玄机阁 · 离线能力页</title>
<style>
  body{font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;max-width:900px;margin:2rem auto;padding:0 1rem;color:#222;background:#fafafa}
  h1{font-size:1.4rem} h2{font-size:1.1rem;margin-top:1.6rem}
  .banner{padding:.6rem 1rem;border-radius:8px;font-weight:600;display:inline-block}
  .allpass{background:#e6f6ec;color:#1a7f37} .notall{background:#fdecea;color:#b3261e}
  table{border-collapse:collapse;width:100%;margin-top:.6rem;font-size:.9rem}
  th,td{border:1px solid #e2e2e2;padding:.45rem .6rem;text-align:left;vertical-align:top}
  th{background:#f0f0f0} .tool{font-family:ui-monospace,monospace;white-space:nowrap}
  tr.ok td:nth-child(3){color:#1a7f37} tr.bad td:nth-child(3){color:#b3261e;font-weight:700}
  .detail{color:#666;font-family:ui-monospace,monospace;font-size:.8rem}
  ol.rules{font-size:.92rem;line-height:1.7}
  footer{margin-top:2rem;color:#777;font-size:.85rem}
</style></head>
<body>
  <h1>玄机阁（dsh-xuanji）· 离线能力页</h1>
  <p>本页为单文件离线快照：无外链、无脚本依赖，任何浏览器可直接打开。排盘本体运行在 DSH 宿主的工具面里；本页只静态展示能力目录、排盘纪律与最近一次公开对拍结果。生成于 ${new Date().toISOString().slice(0, 10)}。</p>

  <h2>一、工具目录（${registered.length} 个 xuanji_* 工具，全部本地确定性排盘）</h2>
  <table><thead><tr><th>工具</th><th>能力</th></tr></thead><tbody>${toolRows}</tbody></table>

  <h2>二、排盘纪律（模型解读必须遵守的铁律）</h2>
  <ol class="rules">${disciplineList}</ol>

  <h2>三、公开对拍快照</h2>
  <div class="banner ${allPass ? 'allpass' : 'notall'}">${allPass ? `全部通过：${pass}/${total}` : `存在失败：${pass}/${total}`}</div>
  <p>锚点采用「独立重算」口径：预期值由最原始的干支原语在本地重推，不引用被测常量——避免「测试抄实现」导致的全绿但错。</p>
  <table><thead><tr><th>分组</th><th>锚点</th><th>结果</th><th>明细</th></tr></thead><tbody>${anchorRows}</tbody></table>

  <footer>解读属传统文化范畴，仅供娱乐参考，不构成医疗、投资、法律建议。</footer>
</body></html>`;

const outDir = path.join(root, 'docs');
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'offline.html');
writeFileSync(outFile, html, 'utf8');
const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
console.log(`✓ 离线单页：${registered.length} 工具 / 对拍 ${pass}/${total} / ${kb} KB → ${outFile}`);
if (!allPass) process.exit(1);
