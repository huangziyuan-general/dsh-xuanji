// test/foundation.test.mjs — P0 基础三件套：trace / shadow-id / caliber。
// 纯函数、零外部依赖，跑 node --test 即可。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTrace, withTrace } from '../lib/engine/trace.js';
import { shadowId, sameShadow } from '../lib/engine/shadow-id.js';
import { caliberDiff, caliberReport } from '../lib/engine/caliber.js';

test('trace: 记录步骤且深拷贝不污染原对象', () => {
    const t = createTrace('demo');
    const inputs = { x: 1 };
    const out = t.step('half', '除以2', inputs, 0.5, '测试规则');
    assert.equal(out, 0.5);
    // 改原 inputs 不应影响已记录的快照
    inputs.x = 99;
    const snap = t.steps();
    assert.equal(snap[0].inputs.x, 1);
    assert.equal(snap[0].field, 'half');
    assert.equal(snap[0].rule, '除以2');
    assert.equal(snap[0].source, '测试规则');
    assert.equal(snap.length, 1);
});

test('trace: withTrace 包装返回 {value, trace}', () => {
    const { value, trace } = withTrace('mbti', (tr) => {
        tr.step('q1', 'EI 计分', { a: 1 }, 'E');
        return 'INTJ';
    });
    assert.equal(value, 'INTJ');
    assert.equal(trace.scope, 'mbti');
    assert.equal(trace.steps.length, 1);
});

test('shadowId: 同输入同序、乱序同结果', () => {
    const a = { system: 'bazi', year: 1990, month: 8, day: 16, hour: 14, gender: 'male' };
    const b = { gender: 'male', hour: 14, day: 16, month: 8, year: 1990, system: 'bazi' };
    assert.equal(shadowId(a), shadowId(b));
    assert.match(shadowId(a), /^LY-[0-9a-f]{8}$/);
});

test('shadowId: 不同输入不同 ID（时辰变了）', () => {
    const a = { system: 'bazi', year: 1990, month: 8, day: 16, hour: 14 };
    const b = { system: 'bazi', year: 1990, month: 8, day: 16, hour: 2 };
    assert.notEqual(shadowId(a), shadowId(b));
});

test('shadowId: undefined 与缺失 key 视为同一（归一化口径）', () => {
    const a = { x: 1, y: undefined };
    const b = { x: 1 };
    assert.equal(shadowId(a), shadowId(b));
});

test('sameShadow 透传', () => {
    const a = { p: 1 };
    const b = { p: 1 };
    const c = { p: 2 };
    assert.equal(sameShadow(a, b), true);
    assert.equal(sameShadow(a, c), false);
});

test('caliberDiff: 标出变化的字段', () => {
    const A = { dayGanZhi: '癸丑', yongShen: '庚', meta: { dayun: ['甲子'] } };
    const B = { dayGanZhi: '癸丑', yongShen: '辛', meta: { dayun: ['甲子'] } };
    const diff = caliberDiff(A, B, ['dayGanZhi', 'yongShen', 'meta.dayun']);
    const byField = Object.fromEntries(diff.map((d) => [d.field, d]));
    assert.equal(byField['dayGanZhi'].changed, false);
    assert.equal(byField['yongShen'].changed, true);
    assert.equal(byField['yongShen'].a, '庚');
    assert.equal(byField['yongShen'].b, '辛');
    assert.equal(byField['meta.dayun'].changed, false);
});

test('caliberReport: 包引擎函数直接产出报告', () => {
    const compute = (p) => ({ v: p.base + (p.add ?? 0) });
    const rep = caliberReport(compute, { base: 10 }, { base: 10, add: 5 }, ['v']);
    assert.equal(rep.base.v, 10);
    assert.equal(rep.variant.v, 15);
    assert.equal(rep.diff[0].changed, true);
});
