// test/xiaoliuren.test.mjs — 小六壬引擎：掌诀口径、经典例、报数 fail-fast、确定性。
import test from 'node:test';
import assert from 'node:assert/strict';

import { computeXiaoliuren, PALACES, PALACE_ORDER } from '../lib/engine/xiaoliuren.js';

test('六宫表：大安/速喜/小吉为吉，留连/赤口/空亡为凶，断语非空', () => {
    assert.deepEqual(PALACE_ORDER, ['大安', '留连', '速喜', '赤口', '小吉', '空亡']);
    for (const [name, p] of Object.entries(PALACES)) {
        assert.ok(['吉', '凶'].includes(p.luck), `${name} 吉凶缺失`);
        assert.ok(p.text.length > 10, `${name} 断语过短`);
    }
});

test('经典例：正月初一子时（报数 1、1、1）→ 大安', () => {
    const r = computeXiaoliuren({ mode: 'number', num1: 1, num2: 1, num3: 1 });
    assert.deepEqual(r.steps, ['大安', '大安', '大安']);
    assert.equal(r.result.palace, '大安');
    assert.equal(r.result.luck, '吉');
});

test('报数口径：三步逐段累进（越宫循环）', () => {
    // 6、6、6：月起大安数 6 → 空亡；日自空亡数 6 → 小吉；时自小吉数 6 → 赤口
    const r = computeXiaoliuren({ mode: 'number', num1: 6, num2: 6, num3: 6 });
    assert.deepEqual(r.steps, ['空亡', '小吉', '赤口']);
    // 1、1、1：全落大安
    const r2 = computeXiaoliuren({ mode: 'number', num1: 1, num2: 1, num3: 1 });
    assert.deepEqual(r2.steps, ['大安', '大安', '大安']);
});

test('time 模式：date 与 hour 起课，同输入则结果确定', () => {
    const a = computeXiaoliuren({ mode: 'time', date: '2026-10-22', hour: 14, question: 'x' });
    const b = computeXiaoliuren({ mode: 'time', date: '2026-10-22', hour: 14, question: 'x' });
    assert.deepEqual(a, b);
    assert.ok(PALACE_ORDER.includes(a.result.palace));
    assert.ok(a.meta.originText.includes('农历'));
});

test('E7 回归：给了 date 却不给 hour 必须 fail-fast（不许默认午时）', () => {
    // 早期实现把 date 分支的时刻硬编码成 12:00，导致同一天任何时刻都落同一宫。
    // 现在缺时辰必须报错而不是静默代填。
    assert.throws(
        () => computeXiaoliuren({ mode: 'time', date: '2026-10-22' }),
        /必须同时给 hour/,
    );
});

test('E7 回归：同一天的不同时辰必须给出不同落宫', () => {
    const seen = new Set();
    for (const hour of [0, 3, 6, 9, 12, 15, 18, 21]) {
        const r = computeXiaoliuren({ mode: 'time', date: '2026-10-22', hour });
        seen.add(r.result.palace);
        const zhiHit = /午时/.test(r.meta.originText);
        assert.equal(zhiHit, hour >= 11 && hour <= 13, `hour=${hour} 应（不）落在午时`);
    }
    assert.ok(seen.size >= 4, `同一天不同时辰落宫应有多档，实得 ${[...seen].join('/')}`);
});

test('报数非法 fail-fast：越界 / 缺数', () => {
    assert.throws(() => computeXiaoliuren({ mode: 'number', num1: 0, num2: 5, num3: 5 }), /1–99/);
    assert.throws(() => computeXiaoliuren({ mode: 'number', num1: 5 }), /1–99/);
});

test('确定性：同输入两次结果一致', () => {
    const input = { mode: 'number', num1: 3, num2: 15, num3: 8, question: 'x' };
    assert.deepEqual(computeXiaoliuren(input), computeXiaoliuren(input));
});
