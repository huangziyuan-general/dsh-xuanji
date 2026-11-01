// test/daliuren.test.mjs — 大六壬引擎（实验性）：天地盘/四课结构 + 贼克法单测。
// 注意：本引擎为实验性，三传九宗门其余八法待经典对拍校准；本测试只验结构不变量与贼克法逻辑，
// 不声称与某本典籍逐字一致。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDaliuren, computeDiTianPan, computeSiKe, zeikeChuan } from '../lib/engine/daliuren.js';
import { ZHI } from '../lib/engine/tables.js';

test('天地盘：天盘为地盘的一个排列（12 支各出现一次），月将=月建六合，占时正确', () => {
    const { earth, heaven, yuejiang, zhan } = computeDiTianPan('巳', '卯');
    assert.deepEqual(earth, ZHI);
    assert.equal(heaven.length, 12);
    assert.equal(new Set(heaven).size, 12, '天盘应含 12 个不同地支');
    assert.equal(yuejiang, '申', '月建巳的月将应为申（巳申合）');
    assert.equal(zhan, '卯');
    // 天盘在占时宫应为月将
    assert.equal(heaven[ZHI.indexOf('卯')], '申');
});

test('四课：4 课，每课本/上皆为合法地支，且干上=天盘[日干寄宫]', () => {
    const { heaven } = computeDiTianPan('巳', '卯');
    const four = computeSiKe('甲', '午', heaven);
    assert.equal(four.length, 4);
    for (const k of four) {
        assert.ok(ZHI.includes(k.ben) && ZHI.includes(k.shang));
    }
    // 甲寄寅，干上 = 天盘[寅]
    assert.equal(four[0].ben, '寅');
    assert.equal(four[0].shang, heaven[ZHI.indexOf('寅')]);
});

test('贼克法：优先下克上（本克上），取行克之上神为初传', () => {
    // 课1 子→亥：水水比和（无克）；课2 寅→丑：寅木克丑土 = 下克上（优先）；课3/4 无克
    const four = [
        { ben: '子', shang: '亥' },
        { ben: '寅', shang: '丑' },
        { ben: '申', shang: '卯' },
        { ben: '辰', shang: '子' },
    ];
    assert.equal(zeikeChuan('甲', four), '丑', '应取「下克上」的寅→丑 之上神丑');
});

test('贼克法：无下克上时取上克下', () => {
    const four = [
        { ben: '子', shang: '戌' }, // 戌土克子水 = 上克下
        { ben: '卯', shang: '寅' }, // 寅木克卯木? 木木比和，非克
        { ben: '申', shang: '卯' }, // 申金克卯木 = 上克下
        { ben: '辰', shang: '酉' }, // 酉金生辰土，非克
    ];
    // 取首条上克下：子→戌 之上神 戌
    assert.equal(zeikeChuan('甲', four), '戌');
});

test('贼克法：四课无克返回 null（需昴星/遥克等，本版未实现）', () => {
    const four = [
        { ben: '子', shang: '亥' }, // 水水比和
        { ben: '寅', shang: '卯' }, // 木木
        { ben: '申', shang: '酉' }, // 金金
        { ben: '辰', shang: '丑' }, // 土土
    ];
    assert.equal(zeikeChuan('甲', four), null);
});

test('集成：公历生日 + 占时 能排出天地盘/四课/三传（结构不变量）', () => {
    const r = computeDaliuren({ year: 2026, month: 5, day: 20, hour: 10 });
    assert.equal(r.meta.experimental, true);
    assert.equal(r.earth.length, 12);
    assert.equal(r.heaven.length, 12);
    assert.equal(new Set(r.heaven).size, 12);
    assert.equal(r.four.length, 4);
    if (r.sanChuan) {
        assert.equal(r.sanChuan.length, 3);
        for (const z of r.sanChuan) assert.ok(ZHI.includes(z));
    }
});

test('集成：直给 dayGanZhi + hourZhi 也能排', () => {
    const r = computeDaliuren({ dayGanZhi: '甲午', monthZhi: '巳', hourZhi: '卯' });
    assert.equal(r.meta.dayGanZhi, '甲午');
    assert.equal(r.meta.yuejiang, '申');
});
