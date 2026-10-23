// test/trend.test.mjs — 人生K线引擎：结构、分数域、确定性、ASCII 图。
import test from 'node:test';
import assert from 'node:assert/strict';

import { computeTrend } from '../lib/engine/trend.js';

const CASE = { year: 1990, month: 8, day: 16, hour: 14, gender: 'male', calendar: 'solar' };

test('结构：100 个年龄点、大运分段连续、逐年有十神与K线', () => {
    const t = computeTrend(CASE);
    assert.equal(t.points.length, 100);
    assert.equal(t.points[0].age, 1);
    assert.equal(t.points[99].age, 100);
    for (const p of t.points) {
        assert.match(p.ganZhi, /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/);
        assert.ok(['正印', '偏印', '比肩', '劫财', '食神', '伤官', '偏财', '正财', '正官', '七杀'].includes(p.shiShenGan));
        const { open, close, high, low } = p.kline;
        assert.ok(open >= 0 && open <= 100 && close >= 0 && close <= 100);
        assert.ok(high >= close && low <= close);
    }
    // 大运分段覆盖 1–100 岁无断档
    let covered = 0;
    for (const s of t.segments) covered += s.endAge - s.startAge + 1;
    assert.ok(covered >= 100);
});

test('分数域：0–100 内且不大量贴边（±10 分数域放宽后）', () => {
    const t = computeTrend(CASE);
    const scores = t.points.map((p) => p.score);
    assert.ok(Math.min(...scores) >= 2 && Math.max(...scores) <= 99);
    assert.ok(scores.filter((s) => s >= 98).length <= 10, '99 分不应大量出现');
    assert.ok(scores.filter((s) => s <= 4).length <= 10);
});

test('K线连续性：当年开盘 = 上年收盘', () => {
    const t = computeTrend(CASE);
    for (let i = 1; i < t.points.length; i++) {
        assert.equal(t.points[i].kline.open, t.points[i - 1].kline.close);
    }
});

test('确定性：同输入两次结果一致', () => {
    assert.deepEqual(computeTrend(CASE), computeTrend(CASE));
});

test('sparkline：每行一个大运段（起运前单独一行），块字符合法', () => {
    const t = computeTrend(CASE);
    assert.ok(t.sparkline.length >= 9);
    for (const line of t.sparkline) {
        assert.match(line, /^(?:[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]|起运前)（\d+–\d+岁）：[▁▂▃▄▅▆▇█]+$/);
    }
    assert.ok(t.sparkline[0].startsWith('起运前（1–'), '起运前应单独成段且在最前');
});

test('缺性别 fail-fast；toAge 边界钳制', () => {
    assert.throws(() => computeTrend({ ...CASE, gender: undefined }), /gender/);
    const t = computeTrend({ ...CASE, toAge: 500 });
    assert.equal(t.meta.toAge, 100);
    assert.equal(t.points.length, 100);
});

test('时间管线：applyDST/city 真实生效（DST 减一小时 + 真太阳时 notes，城市改变旺衰与走势）', () => {
    const base = { year: 1990, month: 8, day: 16, hour: 16, gender: 'male', calendar: 'solar' };
    const t1 = computeTrend(base);
    const t2 = computeTrend({ ...base, city: '乌鲁木齐' });
    assert.ok(t1.meta.notes.some((n) => n.includes('夏令时')), 'DST 校正留 notes');
    assert.ok(t2.meta.notes.some((n) => n.includes('真太阳时')), '真太阳时校正留 notes');
    // 钟面 16:00（申时）经乌鲁木齐真太阳时校正后跨入未时 → 时柱变 → 旺衰与逐年分数随之变
    assert.notEqual(t1.meta.strength.state, t2.meta.strength.state, '真太阳时改变时辰 → 旺衰判定应变化');
    assert.notDeepEqual(t1.points, t2.points, '逐年分数应随排盘变化');
    // 关闭 DST 后无夏令时 note（无口径说明时 notes 整个省略）
    const t3 = computeTrend({ ...base, applyDST: false });
    assert.ok(!(t3.meta.notes ?? []).some((n) => n.includes('夏令时')));
});
