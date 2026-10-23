// test/geju.test.mjs — 八字格局判定（简化正格八格 + 建禄/阳刃俗格）。
import test from 'node:test';
import assert from 'node:assert/strict';

import { determineGeju, MONTH_BEN_QI } from '../lib/engine/geju.js';
import { computeBazi } from '../lib/engine/bazi.js';

test('MONTH_BEN_QI：十二支本气藏干齐全', () => {
    assert.equal(MONTH_BEN_QI.寅, '甲');
    assert.equal(MONTH_BEN_QI.申, '庚');
    assert.equal(Object.keys(MONTH_BEN_QI).length, 12);
});

test('七杀格透干成立：日主甲 + 月令申（庚本气克甲=七杀）+ 透庚 → 立七杀格', () => {
    const r = determineGeju({ dayMasterGan: '甲', monthZhi: '申', allGans: ['庚', '甲', '庚'] });
    assert.equal(r.primaryGod, '七杀');
    assert.equal(r.geju, '七杀格（偏官格）');
    assert.equal(r.formed, true);
});

test('七杀格候选：月令申（庚）+ 日主甲 + 无透庚 → 格弱未成（候选）', () => {
    const r = determineGeju({ dayMasterGan: '甲', monthZhi: '申', allGans: ['甲', '乙'] });
    assert.equal(r.primaryGod, '七杀'); // 申本气庚 克 甲（异性）= 七杀
    assert.equal(r.geju, '七杀格（偏官格）');
    assert.equal(r.formed, false);
    assert.match(r.note, /未透干/);
});

test('偏印格透干成立：日主丙 + 月令寅（甲本气生丙，同性=偏印/枭神）+ 透甲 → 立偏印格', () => {
    const r = determineGeju({ dayMasterGan: '丙', monthZhi: '寅', allGans: ['甲', '丙', '甲'] });
    assert.equal(r.primaryGod, '偏印');
    assert.equal(r.geju, '偏印格（枭神格）');
    assert.equal(r.formed, true);
});

test('建禄格俗格：月令甲（比肩月令）→ 建禄格，非正格', () => {
    // 日主甲，月令本气须为甲 → 寅月（本气甲）。寅对甲 = 比肩。
    const r = determineGeju({ dayMasterGan: '甲', monthZhi: '寅', allGans: ['甲', '甲'] });
    assert.equal(r.suGe, '建禄格（比肩月令，正格之外，身旺之征）');
    assert.equal(r.geju, null);
});

test('阳刃格俗格：月令午（丁）+ 日主丙（劫财月令）→ 阳刃格', () => {
    const r = determineGeju({ dayMasterGan: '丙', monthZhi: '午', allGans: ['丙', '丁'] });
    assert.equal(r.suGe?.startsWith('阳刃格'), true);
});

test('computeBazi 输出含 geju 字段（正格或俗格之一）', () => {
    const b = computeBazi({ year: 1990, month: 8, day: 16, hour: 14, minute: 30, gender: 'male' });
    assert.ok(b.geju.geju || b.geju.suGe, '应给出 geju 或 suGe');
    assert.equal(typeof b.geju.formed, 'boolean');
});

test('未知月支 fail-fast', () => {
    assert.throws(() => determineGeju({ dayMasterGan: '甲', monthZhi: 'X', allGans: [] }), /未知月支/);
});
