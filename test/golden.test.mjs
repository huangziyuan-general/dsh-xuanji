// test/golden.test.mjs — 黄金锚例：用外部权威排盘逐字核对四柱，防止历法引擎漂移。
// 锚例来源（外部事实，非本插件实现回声）：
// ① cantian-ai/bazi-mcp README 自带示例：1998-07-31 14:10 男 → 戊寅 己未 己卯 辛未，日主己，生肖虎；
// ② 公开出版排盘（毛泽东）：1893-12-26 辰时 → 癸巳 甲子 丁酉 甲辰；
// ③ 公开出版排盘（蒋介石）：1887-10-31 午时 → 丁亥 庚戌 己巳 庚午。
import test from 'node:test';
import assert from 'node:assert/strict';

import { computeBazi } from '../lib/engine/bazi.js';
import { resolveBirthTime } from '../lib/engine/birth-time.js';

function fourPillars(input) {
    const r = computeBazi(input, {});
    const P = r.pillars;
    return {
        four: [P.year.ganZhi, P.month.ganZhi, P.day.ganZhi, P.hour?.ganZhi].join(' '),
        dayMaster: r.dayMaster.gan,
        shengXiao: r.meta.shengXiao,
        result: r,
    };
}

test('黄金锚例①：1998-07-31 14:10 男 → 戊寅 己未 己卯 辛未（cantian-ai/bazi-mcp README）', () => {
    const g = fourPillars({ year: 1998, month: 7, day: 31, hour: 14, minute: 10, gender: 'male' });
    assert.equal(g.four, '戊寅 己未 己卯 辛未');
    assert.equal(g.dayMaster, '己');
    assert.equal(g.shengXiao, '虎');
});

test('黄金锚例②：1893-12-26 辰时 男 → 癸巳 甲子 丁酉 甲辰（公开出版排盘）', () => {
    const g = fourPillars({ year: 1893, month: 12, day: 26, hour: 8, gender: 'male' });
    assert.equal(g.four, '癸巳 甲子 丁酉 甲辰');
    assert.equal(g.dayMaster, '丁');
});

test('黄金锚例③：1887-10-31 午时 男 → 丁亥 庚戌 己巳 庚午（公开出版排盘）', () => {
    const g = fourPillars({ year: 1887, month: 10, day: 31, hour: 12, gender: 'male' });
    assert.equal(g.four, '丁亥 庚戌 己巳 庚午');
    assert.equal(g.dayMaster, '己');
});

test('真太阳时天文锚：乌鲁木齐 7 月钟面 14:10 ≈ 当地太阳正午 → 真太阳时约 11:57（±1 分钟内）', () => {
    const rt = resolveBirthTime({ year: 2026, month: 7, day: 1, hour: 14, minute: 10, city: '乌鲁木齐' });
    assert.ok(rt.notes.some((n) => n.includes('真太阳时')));
    const total = rt.hour * 60 + rt.minute;
    assert.ok(Math.abs(total - (11 * 60 + 57)) <= 1, `真太阳时应 ≈11:57，实得 ${rt.hour}:${rt.minute}`);
});

test('夏令时锚：1990-08-16 钟面 14:00 → 校正后 13:00（DST 证据日期 1990-04-15–09-16）', () => {
    const rt = resolveBirthTime({ year: 1990, month: 8, day: 16, hour: 14 });
    assert.equal(rt.hour, 13);
    assert.ok(rt.notes[0].includes('1990-04-15'));
});
