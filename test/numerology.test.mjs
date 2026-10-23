// test/numerology.test.mjs — 生命数字引擎：归约规则、主数保留、数义、fail-fast。
import test from 'node:test';
import assert from 'node:assert/strict';

import { computeNumerology, reduceNumber, NUMBER_MEANING } from '../lib/engine/numerology.js';

test('归约：逐位求和到个位；主数在最终结果层保留', () => {
    assert.equal(reduceNumber(34), 7);   // 3+4
    assert.equal(reduceNumber(21), 3);   // 2+1
    assert.equal(reduceNumber(22), 22);  // 主数保留
    assert.equal(reduceNumber(11), 11);
    assert.equal(reduceNumber(33), 33);
});

test('经典锚例：1990-08-16 → 生命路径 7 / 生日数 7 / 态度数 6', () => {
    const r = computeNumerology({ year: 1990, month: 8, day: 16 });
    const life = r.numbers.find((n) => n.name === '生命路径数');
    // 1+9+9+0+8+1+6 = 34 → 3+4 = 7
    assert.equal(life.number, 7);
    const birthday = r.numbers.find((n) => n.name === '生日数');
    assert.equal(birthday.number, 7); // 16 → 7
    const attitude = r.numbers.find((n) => n.name === '态度数');
    assert.equal(attitude.number, 6); // 8+16 = 24 → 6
});

test('主数：2004-09-25 → 全位和 22 保留主数', () => {
    const r = computeNumerology({ year: 2004, month: 9, day: 25 });
    const life = r.numbers.find((n) => n.name === '生命路径数');
    // 2+0+0+4+0+9+2+5 = 22
    assert.equal(life.number, 22);
    assert.equal(life.master, true);
    assert.ok(life.meaning.includes('实干家'));
});

test('数义表齐全：1–9 + 11/22/33', () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 22, 33]) {
        assert.equal(typeof NUMBER_MEANING[n], 'string');
        assert.ok(NUMBER_MEANING[n].length > 4);
    }
});

test('fail-fast：缺年月日、非法月日；确定性', () => {
    assert.throws(() => computeNumerology({ year: 1990 }), /year\/month\/day|缺少/);
    assert.throws(() => computeNumerology({ year: 1990, month: 13, day: 1 }), /缺少|非法|month/);
    assert.throws(() => computeNumerology(null), /缺少/);
    const input = { year: 1990, month: 8, day: 16 };
    assert.deepEqual(computeNumerology(input), computeNumerology(input));
});

test('日期真实性：2 月 30 日等不存在的日期直接拒绝（大小月/闰年校验）', () => {
    assert.throws(() => computeNumerology({ year: 1990, month: 2, day: 30 }), /非法日期/);
    assert.throws(() => computeNumerology({ year: 1990, month: 4, day: 31 }), /非法日期/);
    assert.throws(() => computeNumerology({ year: 1900, month: 2, day: 29 }), /非法日期/, '1900 非闰年（能被 100 整除不能被 400 整除）');
    // 闰年 2 月 29 合法
    assert.doesNotThrow(() => computeNumerology({ year: 2000, month: 2, day: 29 }));
});
