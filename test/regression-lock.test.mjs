// test/golden.test.mjs — 排盘确定性金标准（大规模回归语料）。
//
// 目标：对「已知公开锚点」做逐字校验，并跑 1000 组伪随机输入验证确定性
// 与结构完整性。锚点选自已发布的历法事实（立春界/农历/节气），
// 与「简化判定/白话自撰」层无关——那些层只验证「结构稳定」，不验证「数值」。

import test from 'node:test';
import assert from 'node:assert/strict';

import { computeBazi } from '../lib/engine/bazi.js';
import { computeQimen } from '../lib/engine/qimen.js';
import { computeMatch } from '../lib/engine/match.js';
import { computeChenggu } from '../lib/engine/chenggu.js';
import { yearZibaiStar, yearlyFlying } from '../lib/engine/fengshui.js';
import { Lunar, Solar } from 'lunar-javascript';

// ────────────────────────── 公开锚点（逐字校验）──────────────────────────

test('锚点：1990-08-16 14:30 男 → 四柱 庚午 甲申 癸丑 己未（市面通行盘）', () => {
    const b = computeBazi({ year: 1990, month: 8, day: 16, hour: 14, minute: 30, gender: 'male' });
    assert.deepEqual(Object.fromEntries(Object.entries(b.pillars).map(([k, v]) => [k, v.ganZhi])),
        { year: '庚午', month: '甲申', day: '癸丑', hour: '己未' });
});

test('锚点：2024-02-05（立春当日）属甲辰年，2024-02-03 属癸卯年（立春界）', () => {
    const after = computeBazi({ year: 2024, month: 2, day: 5, hour: 12, gender: 'male' });
    assert.equal(after.pillars.year.ganZhi, '甲辰', '立春（2024-02-04 16:27）后属甲辰');
    const before = computeBazi({ year: 2024, month: 2, day: 3, hour: 12, gender: 'male' });
    assert.equal(before.pillars.year.ganZhi, '癸卯', '立春前仍属癸卯');
});

test('锚点：年紫白公式 2024-2040 与公开表一致', () => {
    const expect = { 2024: 3, 2025: 2, 2026: 1, 2027: 9, 2028: 8, 2034: 2, 2035: 1, 2040: 5 };
    for (const [y, star] of Object.entries(expect)) {
        assert.equal(yearZibaiStar(y), star, `${y} 应 ${star}`);
    }
});

test('锚点：称骨 1990-08-16（农历六月廿六）未时 → 骨重可复现', () => {
    const a = computeChenggu({ year: 1990, month: 6, day: 26, hourZhi: '未', calendar: 'lunar' });
    const b = computeChenggu({ year: 1990, month: 6, day: 26, hourZhi: '未', calendar: 'lunar' });
    assert.deepEqual(a, b, '称骨确定性');
    assert.ok(a.total.qian >= 10 && a.total.qian <= 70, '骨重合理区间');
});

// ────────────────────────── 1000 组伪随机输入确定性 ──────────────────────

// 确定性伪随机（同种子同序列），不引入 Math.random
function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function randomBirth(rand, yearMin = 1900, yearMax = 2030) {
    const year = yearMin + Math.floor(rand() * (yearMax - yearMin + 1));
    const month = 1 + Math.floor(rand() * 12);
    const maxDay = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
    const day = 1 + Math.floor(rand() * maxDay);
    const hour = Math.floor(rand() * 24);
    const gender = rand() > 0.5 ? 'male' : 'female';
    return { year, month, day, hour, gender };
}

test('1000 组伪随机八字：确定性（两次同输入同输出）+ 四柱齐全', () => {
    const rand = mulberry32(20260101);
    for (let i = 0; i < 1000; i++) {
        const b1 = randomBirth(rand);
        const a = JSON.stringify(computeBazi(b1, { ziShi: 1 }));
        const b = JSON.stringify(computeBazi({ ...b1 }, { ziShi: 1 }));
        assert.equal(a, b, `case ${i} 确定性`);
        const r = JSON.parse(a);
        assert.equal(Object.keys(r.pillars).length, 4, `case ${i} 四柱齐全`);
        assert.ok(r.geju?.geju || r.geju?.suGe, `case ${i} 应给格局或俗格`);
    }
});

test('500 组伪随机奇门：确定性 + 局数 1–9 + 九宫仪奇齐全 + 转盘保序不变量', () => {
    const rand = mulberry32(20260102);
    // 后天八卦方位环（不是洛书数字环）。旧版在这里抄了实现的数字环，
    // 于是「转盘转错」也满足同构 —— 参见 test/qimen.test.mjs 的 P1-1 回归组。
    const RING = [1, 8, 3, 4, 9, 2, 7, 6];
    const isRotationOf = (a, b) => b.some((_, s) => a.every((x, i) => x === b[(i + s) % b.length]));
    for (let i = 0; i < 500; i++) {
        const y = 2000 + Math.floor(rand() * 25);
        const m = 1 + Math.floor(rand() * 12);
        const d = 1 + Math.floor(rand() * 28);
        const h = Math.floor(rand() * 24);
        const input = { year: y, month: m, day: d, hour: h };
        const a = JSON.stringify(computeQimen(input));
        const b = JSON.stringify(computeQimen({ ...input }));
        assert.equal(a, b, `qimen ${i} 确定性`);
        const r = JSON.parse(a);
        assert.ok(r.meta.ju.ju >= 1 && r.meta.ju.ju <= 9, `qimen ${i} 局数越界`);
        assert.equal(r.diPan[r.meta.ju.ju], '戊', `qimen ${i} 戊应落局数宫`);
        const diRing = RING.map((p) => r.diPanXing[p]);
        const tianRing = RING.map((p) => r.tianPan[p]);
        assert.ok(isRotationOf(tianRing, diRing), `qimen ${i} 天盘星环序必须保持地盘相对序`);
        for (const p of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
            assert.ok(r.diPan[p] && r.tianPan[p], `qimen ${i} 宫 ${p} 缺仪/星`);
        }
        if (r.meta.ganzhi.time[0] !== '甲') {
            const ganPalace = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((p) => r.diPan[p] === r.meta.ganzhi.time[0]);
            const eff = ganPalace === 5 ? 2 : ganPalace;
            // 值符星取其本宫（禽寄坤二时轮点为芮宫）——取地盘本宫序，勿取旋转后天盘
            const zhiFuStar = diRing[RING.indexOf(r.xun.palace === 5 ? 2 : r.xun.palace)];
            assert.equal(r.tianPan[eff], zhiFuStar, `qimen ${i} 值符应落时干宫`);
        }
    }
});

test('300 组伪随机合婚：确定性 + 关系事实非空', () => {
    const rand = mulberry32(20260103);
    for (let i = 0; i < 300; i++) {
        const a = randomBirth(rand);
        const b = randomBirth(rand);
        const input = { a, b };
        const ra = JSON.stringify(computeMatch(input));
        const rb = JSON.stringify(computeMatch({ a: { ...a }, b: { ...b } }));
        assert.equal(ra, rb, `match ${i} 确定性`);
        const parsed = JSON.parse(ra);
        assert.ok(parsed.relations.length >= 1, `match ${i} 至少 1 条关系`);
    }
});
