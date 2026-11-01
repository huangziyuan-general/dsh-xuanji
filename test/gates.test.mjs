// test/gates.test.mjs — P2 CI 闸门：性能、HTML 注入、产物体积、问/改/纠交互三态。
// 这些闸门守住「工程可信度」：全绿只说明实现符合作者理解，闸门守住的是不会静默劣化的底线。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { computeBazi } from '../lib/engine/bazi.js';
import { computeLiuyao } from '../lib/engine/liuyao.js';
import { computeQimen } from '../lib/engine/qimen.js';
import { escapeHtml } from '../lib/tools/common.js';
import { apply } from '../lib/index.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readDoc = (f) => readFileSync(path.join(root, 'docs', f), 'utf8');

/** 轻量 boot：拿走完整时间管线（DST/真太阳时）的工具层实例。 */
function bootTool(name) {
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
    return registered.find((t) => t.name === name);
}

// ── 闸门 1：性能（排盘必须毫秒级，回归到秒级即闸门报警）──
test('闸门·性能：八字/六爻/奇门 单次排盘 < 200ms（热路径）', () => {
    // 预热一次，排除首载 import 成本
    computeBazi({ year: 1990, month: 8, day: 16, hour: 14, gender: 'male' });
    const cases = [
        ['bazi', () => computeBazi({ year: 1990, month: 8, day: 16, hour: 14, gender: 'male' })],
        ['liuyao', () => computeLiuyao({ mode: 'numbers', nums: '6,7,8,9,7,8', date: '2026-10-23' })],
        ['qimen', () => computeQimen({ year: 2026, month: 10, day: 23, hour: 14 })],
    ];
    for (const [name, fn] of cases) {
        const t0 = process.hrtime.bigint();
        for (let i = 0; i < 5; i++) fn();
        const ms = Number(process.hrtime.bigint() - t0) / 1e6 / 5;
        assert.ok(ms < 200, `${name} 单次 ${ms.toFixed(1)}ms 超过 200ms 闸门`);
    }
});

// ── 闸门 2：HTML 注入（用户可控文本进页面必须转义）──
test('闸门·转义：escapeHtml 对 <>&"\' 全部实体化', () => {
    assert.equal(escapeHtml('<img onerror=alert(1)>'), '&lt;img onerror=alert(1)&gt;');
    assert.equal(escapeHtml('a&b"c\'d'), 'a&amp;b&quot;c&#39;d');
    assert.equal(escapeHtml(42), '42', '数字也要能过');
});

test('闸门·离线页：无内联脚本、无事件属性、体积 < 200KB', () => {
    const html = readDoc('offline.html');
    assert.ok(!/<script/i.test(html), '离线页不得含 <script>');
    // 只盯真正的事件属性（onerror/onload/click 等），「action=」「content=」这类纯文本不算。
    assert.ok(!/\s+on(error|load|click|mouse\w+|focus|blur|key\w+)\s*=/i.test(html), '离线页不得含内联事件属性');
    assert.ok(html.includes('xuanji_bazi'), '离线页应含工具目录');
    assert.ok(html.includes('18'), '离线页应标注 18 个工具');
    const kb = Buffer.byteLength(html) / 1024;
    assert.ok(kb < 200, `offline.html ${kb.toFixed(1)}KB 超过 200KB 闸门`);
});

test('闸门·验证报告：体积 < 100KB 且含通过横幅', () => {
    const html = readDoc('verification.html');
    const kb = Buffer.byteLength(html) / 1024;
    assert.ok(kb < 100, `verification.html ${kb.toFixed(1)}KB 超过 100KB 闸门`);
    assert.ok(/全部通过：\d+\/\d+/.test(html), '报告应含通过横幅');
});

// ── 闸门 3：问 / 改 / 纠 交互三态 ──
test('闸门·问（ask）：缺输入 fail-fast，措辞引导先问而非代填', () => {
    assert.throws(
        () => computeBazi({ year: 1990, month: 8, day: 16 }),
        /gender/,
        '八字缺性别必须报错引导先问',
    );
    assert.throws(
        () => computeQimen({ year: 2026, month: 10, day: 23 }),
        /hour/,
        '奇门缺时辰必须报错引导先问',
    );
    const ly = computeLiuyao({ mode: 'numbers', nums: '6,7,8,9,7,8', date: '2026-10-23' });
    assert.equal(ly.yongShen.found, false, '六爻无问句不定用神');
    assert.ok(ly.yongShen.reason.includes('先问'), '须提示先问所占何事');
});

test('闸门·改（revise）：同参重跑结果逐位一致（幂等可复算）', () => {
    const args = { year: 1990, month: 8, day: 16, hour: 14, minute: 30, gender: 'male' };
    const a = JSON.stringify(computeBazi(args));
    const b = JSON.stringify(computeBazi(args));
    assert.equal(a, b, '同参数两次排盘必须逐字节一致');
});

test('闸门·纠（rectify）：口径修正（补夏令时）走工具层管线、盘面可追溯', async () => {
    // 纠偏路径走完整时间管线（DST 校正在工具层 resolveBirthTime）：
    // 用户报 15:30（夏令时年份）→ 自动校正 14:30 → 未时丁未 + 口径痕迹；关校正 → 申时戊申。
    const t = bootTool('xuanji_bazi');
    const args = { year: 1990, month: 7, day: 1, hour: 15, minute: 30, gender: 'male', calendar: 'solar' };
    const corrected = await t.execute(args, {});
    assert.equal(corrected.pillars.hour.ganZhi, '丁未');
    assert.ok(corrected.meta.notes.some((n) => n.includes('夏令时')), '纠偏必须留下口径痕迹');
    const raw = await t.execute({ ...args, applyDST: false }, {});
    assert.equal(raw.pillars.hour.ganZhi, '戊申');
    assert.notEqual(corrected.pillars.hour.ganZhi, raw.pillars.hour.ganZhi, '纠偏前后盘面必须不同');
});
