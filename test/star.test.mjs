// test/star.test.mjs — 星座引擎：区间边界 + 确定性。
import test from 'node:test';
import assert from 'node:assert/strict';

import { computeStar, signOfDate } from '../lib/engine/star.js';

test('星座区间：1990-08-16 狮子座；边界日期不串座', () => {
    assert.equal(signOfDate(8, 16).name, '狮子座');
    assert.equal(signOfDate(3, 21).name, '白羊座');
    assert.equal(signOfDate(3, 20).name, '双鱼座');
    assert.equal(signOfDate(12, 22).name, '摩羯座');
    assert.equal(signOfDate(1, 19).name, '摩羯座');
    assert.equal(signOfDate(1, 20).name, '水瓶座');
});

test('computeStar：星座档案与四维基调齐全', () => {
    const s = computeStar('1990-08-16');
    assert.equal(s.sign.name, '狮子座');
    assert.equal(s.sign.element, '火象');
    assert.equal(s.daily.dims.length, 4);
    for (const d of s.daily.dims) {
        assert.ok(d.stars >= 1 && d.stars <= 5);
        assert.ok(d.text.length > 0);
    }
    assert.ok(s.daily.luckyColor.length > 0);
    assert.ok(s.daily.luckyNumber >= 1 && s.daily.luckyNumber <= 9);
});

test('确定性：同日同结果', () => {
    assert.deepEqual(computeStar('2026-10-22'), computeStar('2026-10-22'));
});
