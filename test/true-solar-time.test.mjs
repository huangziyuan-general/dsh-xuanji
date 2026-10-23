// test/true-solar-time.test.mjs — 真太阳时校正：均时差界限、经度解析、跨日换算。
import test from 'node:test';
import assert from 'node:assert/strict';

import {
    equationOfTimeMinutes, resolveLongitude, applyTrueSolarTime, CITIES,
} from '../lib/engine/true-solar-time.js';

test('均时差：全年摆动在 -15 ~ +17 分钟内，春秋分附近约 -7 分、11 月初约 +16 分', () => {
    for (let m = 1; m <= 12; m++) {
        for (let d = 1; d <= 28; d++) {
            const e = equationOfTimeMinutes(m, d);
            assert.ok(e > -15 && e < 17, `${m}-${d} 均时差越界：${e}`);
        }
    }
    assert.ok(Math.abs(equationOfTimeMinutes(3, 21) - (-7.8)) < 1);
    assert.ok(Math.abs(equationOfTimeMinutes(11, 3) - 16.4) < 1);
});

test('经度解析：城市查表、直传经度、未知城市报可行动错误', () => {
    assert.equal(resolveLongitude({ city: '成都' }).longitude, 104.07);
    assert.equal(resolveLongitude({ longitude: 116.4 }).longitude, 116.4);
    assert.throws(() => resolveLongitude({ city: '不存在' }), /longitude/);
    assert.throws(() => resolveLongitude({}), /city/);
    assert.throws(() => resolveLongitude({ longitude: 500 }), /-180/);
    assert.ok(Object.keys(CITIES).length >= 50);
});

// 天文事实锚（方向性测试不许复述实现，必须锚定外部事实）：
// 太阳正午 = 真太阳时 12:00。乌鲁木齐（87.62°E）7 月太阳正午约在北京时间 14:10，
// 成都（104.07°E）约 13:05，上海（121.47°E）约 12:06——所以钟面到正午差多少，
// 真太阳时就该从钟面往回差多少（再叠加 ±16 分钟内的均时差）。

test('方向锚：乌鲁木齐 7 月钟面 14:10（≈当地太阳正午）→ 真太阳时约 11:57', () => {
    const r = applyTrueSolarTime({ year: 2026, month: 7, day: 1, hour: 14, minute: 10, city: '乌鲁木齐' });
    assert.equal(r.offsetMinutes, -133); // 4*(87.62-120)=-129.5 + EoT(-3.4)
    const total = r.hour * 60 + r.minute;
    assert.ok(Math.abs(total - (11 * 60 + 57)) <= 1, `真太阳时应 ≈11:57，实得 ${r.hour}:${r.minute}`);
    assert.equal(r.applied, true);
});

test('方向锚：成都 7 月钟面 13:04（≈当地太阳正午）→ 真太阳时约 11:57', () => {
    const r = applyTrueSolarTime({ year: 2026, month: 7, day: 1, hour: 13, minute: 4, city: '成都' });
    assert.equal(r.offsetMinutes, -67); // 4*(104.07-120)=-63.7 + EoT(-3.4)
    const total = r.hour * 60 + r.minute;
    assert.ok(Math.abs(total - (11 * 60 + 57)) <= 1, `真太阳时应 ≈11:57，实得 ${r.hour}:${r.minute}`);
});

test('方向锚：东经以东（上海 121.47°）真太阳时比钟面更早过中天，offset 为正', () => {
    const r = applyTrueSolarTime({ year: 2026, month: 7, day: 1, hour: 12, minute: 6, city: '上海' });
    assert.ok(r.offsetMinutes > 0, `上海偏东经 120°，offset 应为正，实得 ${r.offsetMinutes}`);
    assert.equal(r.hour * 60 + r.minute, 12 * 60 + 8); // +5.9 + EoT(-3.4) ≈ +2
});

test('跨日换算：偏西城市、均时差为负的 2 月，00:30 校正后落回前一天', () => {
    const r = applyTrueSolarTime({ year: 2026, month: 2, day: 11, hour: 0, minute: 30, city: '乌鲁木齐' });
    assert.equal(r.offsetMinutes, Math.round(4 * (87.62 - 120) + equationOfTimeMinutes(2, 11)));
    assert.ok(r.offsetMinutes < -60);
    assert.equal(r.day, 10);
    assert.ok(r.hour >= 21 && r.hour <= 23);
});

test('同一时刻两次校正结果一致（确定性）', () => {
    const a = applyTrueSolarTime({ year: 1990, month: 8, day: 16, hour: 14, minute: 30, city: '成都' });
    const b = applyTrueSolarTime({ year: 1990, month: 8, day: 16, hour: 14, minute: 30, city: '成都' });
    assert.deepEqual(a, b);
});
