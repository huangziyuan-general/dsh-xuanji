// test/chenggu.test.mjs — 称骨引擎：以通行本称骨表手算案例为金标准。
import test from 'node:test';
import assert from 'node:assert/strict';

import { computeChenggu } from '../lib/engine/chenggu.js';
import { YEAR_WEIGHT, MONTH_WEIGHT, DAY_WEIGHT, HOUR_WEIGHT } from '../lib/engine/chenggu.js';
import { JIAZI } from '../lib/engine/tables.js';

test('称骨表自检：六十甲子各有年重、月日时辰表齐全', () => {
    assert.equal(YEAR_WEIGHT.length, 60);
    assert.equal(MONTH_WEIGHT.length, 12);
    assert.equal(DAY_WEIGHT.length, 30);
    for (const gz of JIAZI) {
        const i = JIAZI.indexOf(gz);
        assert.ok(Number.isInteger(YEAR_WEIGHT[i]) && YEAR_WEIGHT[i] >= 5 && YEAR_WEIGHT[i] <= 19, `${gz} 年重越界`);
    }
    for (const [zhi, w] of Object.entries(HOUR_WEIGHT)) assert.ok(w >= 6 && w <= 16, `${zhi} 时重越界`);
});

test('手算案例：农历甲子年正月初一子时 = 12+6+5+16 = 三两九钱', () => {
    const c = computeChenggu({ year: 1984, month: 1, day: 1, hourZhi: '子' });
    assert.equal(c.meta.yearGanZhi, '甲子');
    assert.equal(c.total.qian, 39);
    assert.equal(c.total.label, '三两九钱');
    assert.equal(c.weights.year.qian, 12);
    assert.equal(c.weights.month.qian, 6);
    assert.equal(c.weights.day.qian, 5);
    assert.equal(c.weights.hour.qian, 16);
});

test('公历输入自动转农历：1990-08-16 14 时（未时）= 庚午年六月廿六 = 四两二钱', () => {
    const c = computeChenggu({ year: 1990, month: 8, day: 16, hour: 14, calendar: 'solar' });
    assert.equal(c.meta.solar, '1990-08-16');
    assert.equal(c.meta.yearGanZhi, '庚午');
    assert.equal(c.total.qian, 8 + 16 + 10 + 8);
    assert.equal(c.total.label, '四两二钱');
    assert.ok(['中上'].includes(c.verdict.band));
});

test('农历月份格式：零两的钱数只写「X钱」', () => {
    // 找一个年重 < 10 的干支年：乙丑(9钱)。农历乙丑年正月十五子时 = 9+6+10+16=41=四两一钱
    const idxYichou = JIAZI.indexOf('乙丑');
    assert.equal(YEAR_WEIGHT[idxYichou], 9);
    const year = 1985; // 乙丑年
    const c = computeChenggu({ year, month: 1, day: 15, hourZhi: '子' });
    assert.equal(c.total.qian, 41);
    assert.equal(c.weights.year.label, '乙丑年 九钱');
});

test('时辰缺失 fail-fast（铁律：不代填）', () => {
    assert.throws(
        () => computeChenggu({ year: 1990, month: 8, day: 16, calendar: 'solar' }),
        /时辰/,
    );
});
