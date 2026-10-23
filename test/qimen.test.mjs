// test/qimen.test.mjs — 奇门遁甲时家转盘（拆补法简化口径）：确定性、阳阴遁、八宫星门、fail-fast。
import test from 'node:test';
import assert from 'node:assert/strict';

import { computeQimen } from '../lib/engine/qimen.js';

const CASE = { year: 2026, month: 10, day: 23, hour: 14 };

test('确定性：同输入两次结果完全一致', () => {
    const a = JSON.stringify(computeQimen(CASE));
    const b = JSON.stringify(computeQimen({ ...CASE }));
    assert.equal(a, b);
});

test('阳遁/局数/值符/旬空齐全，八宫（除中宫外）均有地盘星、天盘星与八门', () => {
    const r = computeQimen(CASE);
    assert.equal(typeof r.meta.ju.yangDun, 'boolean');
    assert.ok(r.meta.ju.ju >= 1 && r.meta.ju.ju <= 9, '局数 1–9');
    assert.equal(typeof r.zhiFu, 'string');
    assert.equal(r.kongWang.length, 2);
    for (const p of [1, 2, 3, 4, 6, 7, 8, 9]) {
        assert.ok(r.diPan[p], `宫 ${p} 应有地盘星`);
        assert.ok(r.tianPan[p], `宫 ${p} 应有天盘星`);
        assert.ok(r.men[p] === null || typeof r.men[p] === 'string', `宫 ${p} 八门应为 null(中宫) 或字符串`);
    }
    assert.equal(r.diPan[5], '天禽', '中宫寄天禽');
});

test('缺时辰 fail-fast（奇门缺时干整盘不可排，不代填）', () => {
    assert.throws(() => computeQimen({ year: 2026, month: 10, day: 23 }), /hour/);
});

test('阳遁与阴遁分界：2026-01-05（冬至后）阳遁；2026-07-01（夏至后）阴遁', () => {
    const winter = computeQimen({ year: 2026, month: 1, day: 5, hour: 8 });
    assert.equal(winter.meta.ju.yangDun, true, '冬至后应为阳遁');
    const summer = computeQimen({ year: 2026, month: 7, day: 1, hour: 8 });
    assert.equal(summer.meta.ju.yangDun, false, '夏至后应为阴遁');
});

test('不同时辰值符/天盘会变化（转盘真实旋转，非全盘恒定）', () => {
    const a = computeQimen({ year: 2026, month: 10, day: 23, hour: 4 });
    const b = computeQimen({ year: 2026, month: 10, day: 23, hour: 14 });
    const aTian = JSON.stringify(a.tianPan);
    const bTian = JSON.stringify(b.tianPan);
    // 转盘在不同时辰至少部分宫位不同（确定性但随时刻旋转）
    const diffCount = [1, 2, 3, 4, 6, 7, 8, 9].filter((p) => a.tianPan[p] !== b.tianPan[p]).length;
    assert.ok(diffCount > 0, '两时辰天盘应有差异（转盘旋转）');
});

test('局数在 1–9 范围内（拆补法偏移不越界）', () => {
    for (let d = 1; d <= 30; d++) {
        const r = computeQimen({ year: 2026, month: 10, day: d, hour: 14 });
        assert.ok(r.meta.ju.ju >= 1 && r.meta.ju.ju <= 9, `第 ${d} 日局数越界`);
    }
});
