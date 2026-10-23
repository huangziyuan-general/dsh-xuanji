// test/qimen.test.mjs — 奇门遁甲时家转盘（拆补法，通行口径）：确定性、盘面不变量、定义性锚点、fail-fast。
import test from 'node:test';
import assert from 'node:assert/strict';

import { computeQimen, diPanYiOf, JIEQI_JU, STARS_HOME, GATES_HOME, YI_SEQ } from '../lib/engine/qimen.js';

const RING = [1, 2, 3, 4, 6, 7, 8, 9];
const CASE = { year: 2026, month: 10, day: 23, hour: 14 };

/** 环序是否为彼此的循环移位（转盘保序判据——旧实现乱序即在此现形）。 */
function isRotationOf(a, b) {
    if (a.length !== b.length) return false;
    return b.some((_, s) => a.every((x, i) => x === b[(i + s) % b.length]));
}

test('确定性：同输入两次结果完全一致', () => {
    const a = JSON.stringify(computeQimen(CASE));
    const b = JSON.stringify(computeQimen({ ...CASE }));
    assert.equal(a, b);
});

test('定义性锚点：地盘三奇六仪（阳遁一局 / 阴遁九局逐字）', () => {
    // 阳遁一局：戊坎1 己坤2 庚震3 辛巽4 壬中5 癸乾6 丁兑7 丙艮8 乙离9
    assert.deepEqual(diPanYiOf(1, true), { 1: '戊', 2: '己', 3: '庚', 4: '辛', 5: '壬', 6: '癸', 7: '丁', 8: '丙', 9: '乙' });
    // 阴遁九局：戊离9 逆飞 己艮8 庚兑7 辛乾6 壬中5 癸巽4 丁震3 丙坤2 乙坎1
    assert.deepEqual(diPanYiOf(9, false), { 1: '乙', 2: '丙', 3: '丁', 4: '癸', 5: '壬', 6: '辛', 7: '庚', 8: '己', 9: '戊' });
});

test('定义性锚点：三元局数表与通行歌诀一致（冬至一七四 / 夏至九三六 / 大雪四七一）', () => {
    assert.deepEqual(JIEQI_JU['冬至'], [1, 7, 4]);
    assert.deepEqual(JIEQI_JU['惊蛰'], [1, 7, 4]);
    assert.deepEqual(JIEQI_JU['夏至'], [9, 3, 6]);
    assert.deepEqual(JIEQI_JU['白露'], [9, 3, 6]);
    assert.deepEqual(JIEQI_JU['大雪'], [4, 7, 1]);
    assert.deepEqual(JIEQI_JU['立秋'], [1, 4, 7]);
    for (const [jq, arr] of Object.entries(JIEQI_JU)) {
        assert.equal(arr.length, 3, `${jq} 三元缺项`);
    }
});

test('盘面不变量：地盘九仪齐全各一次、戊必在局数宫', () => {
    for (let d = 1; d <= 30; d++) {
        const r = computeQimen({ year: 2026, month: 10, day: d, hour: 14 });
        const yis = Object.values(r.diPan).sort();
        assert.deepEqual(yis, [...YI_SEQ].sort(), `第 ${d} 日地盘仪奇应有九个且不重不漏`);
        assert.equal(r.diPan[r.meta.ju.ju], '戊', `第 ${d} 日戊应落 ${r.meta.ju.ju} 宫`);
    }
});

test('盘面不变量：天盘星与门盘均为本盘的环形旋转（转盘保序——回归旧乱序 bug）', () => {
    for (const d of [3, 8, 15, 21, 27]) {
        const r = computeQimen({ year: 2026, month: 10, day: d, hour: 14 });
        const diRing = RING.map((p) => r.diPanXing[p]);
        const tianRing = RING.map((p) => r.tianPan[p]);
        assert.ok(isRotationOf(tianRing, diRing), `第 ${d} 日天盘星环序必须保持地盘相对序`);
        const gateHomeRing = RING.map((p) => GATES_HOME[p]);
        const menRing = RING.map((p) => r.men[p]);
        assert.ok(isRotationOf(menRing, gateHomeRing), `第 ${d} 日门盘环序必须保持本宫相对序`);
    }
});

test('盘面不变量：值符星落时干所临宫（时干寻地盘仪奇；甲即旬首不动）', () => {
    for (const h of [1, 5, 9, 14, 20, 23]) {
        const r = computeQimen({ year: 2026, month: 10, day: 23, hour: h });
        const tg = r.meta.ganzhi.time[0];
        if (tg === '甲') continue; // 甲不入盘，值符不动，落旬首宫
        const ganPalace = [1, 2, 3, 4, 5, 6, 7, 8, 9].find((p) => r.diPan[p] === tg);
        assert.ok(ganPalace, `时干 ${tg} 必能在地盘仪奇中找到宫位`);
        const eff = ganPalace === 5 ? 2 : ganPalace;
        // 值符星本宫（禽寄坤二时以芮宫为轮点）
        const zhiFuRingStar = STARS_HOME[r.xun.palace === 5 ? 2 : r.xun.palace];
        assert.equal(r.tianPan[eff], zhiFuRingStar, `h=${h} 值符星应落时干宫`);
    }
});

test('盘面不变量：值使门随时支落宫（门盘旋转后值使门在其宫位）', () => {
    for (const h of [1, 5, 9, 14, 20, 23]) {
        const r = computeQimen({ year: 2026, month: 10, day: 23, hour: h });
        const effPalace = r.zhiShi.palace === 5 ? 2 : r.zhiShi.palace;
        assert.equal(r.men[effPalace], r.zhiShi.gate, `h=${h} 值使门应在其落宫`);
    }
});

test('结构：阳遁/局数/元/值符/值使/旬空齐全，九宫均有仪奇、天盘星与门（中宫门为 null）', () => {
    const r = computeQimen(CASE);
    assert.equal(typeof r.meta.ju.yangDun, 'boolean');
    assert.ok(r.meta.ju.ju >= 1 && r.meta.ju.ju <= 9, '局数 1–9');
    assert.ok(['上元', '中元', '下元'].includes(r.meta.ju.yuan));
    assert.equal(typeof r.zhiFu, 'string');
    assert.equal(typeof r.zhiShi.gate, 'string');
    assert.ok(r.zhiShi.palace >= 1 && r.zhiShi.palace <= 9);
    assert.equal(r.kongWang.length, 2);
    for (const p of [1, 2, 3, 4, 5, 6, 7, 8, 9]) {
        assert.ok(typeof r.diPan[p] === 'string', `宫 ${p} 应有地盘仪奇`);
        assert.ok(typeof r.tianPan[p] === 'string', `宫 ${p} 应有天盘星`);
        assert.ok(typeof r.tianPanYi[p] === 'string', `宫 ${p} 应有天盘携仪`);
        assert.ok(r.men[p] === null || typeof r.men[p] === 'string', `宫 ${p} 八门应为 null(中宫) 或字符串`);
    }
    assert.equal(r.diPanXing[5], '天禽', '中宫寄天禽');
    assert.equal(r.men[5], null, '中宫无门');
});

test('旬空与时柱旬一致（独立复算对照）', () => {
    const r = computeQimen(CASE);
    const GAN60 = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
    const ZHI60 = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    const jz = Array.from({ length: 60 }, (_, i) => GAN60[i % 10] + ZHI60[i % 12]);
    const idx = jz.indexOf(r.meta.ganzhi.time);
    const start = idx - (idx % 10);
    assert.deepEqual(r.kongWang, [ZHI60[(start + 10) % 12], ZHI60[(start + 11) % 12]]);
});

test('缺时辰 fail-fast（奇门缺时干整盘不可排，不代填）', () => {
    assert.throws(() => computeQimen({ year: 2026, month: 10, day: 23 }), /hour/);
});

test('阳遁与阴遁分界：2026-01-05（冬至后）阳遁；2026-07-01（夏至后）阴遁；2026-12-25（冬至后）阳遁', () => {
    assert.equal(computeQimen({ year: 2026, month: 1, day: 5, hour: 8 }).meta.ju.yangDun, true, '冬至后应为阳遁');
    assert.equal(computeQimen({ year: 2026, month: 7, day: 1, hour: 8 }).meta.ju.yangDun, false, '夏至后应为阴遁');
    assert.equal(computeQimen({ year: 2026, month: 12, day: 25, hour: 10 }).meta.ju.yangDun, true, '冬至后应转阳遁');
});

test('不同时辰值符/天盘/门盘会变化（转盘真实旋转，非全盘恒定）', () => {
    const a = computeQimen({ year: 2026, month: 10, day: 23, hour: 4 });
    const b = computeQimen({ year: 2026, month: 10, day: 23, hour: 14 });
    const diffCount = RING.filter((p) => a.tianPan[p] !== b.tianPan[p]).length;
    assert.ok(diffCount > 0, '两时辰天盘应有差异（转盘旋转）');
    const menDiff = RING.filter((p) => a.men[p] !== b.men[p]).length;
    assert.ok(menDiff > 0, '两时辰门盘应有差异（值使随时支）');
});

test('局数与元在 1–9 / 三元范围内（拆补法不越界）', () => {
    for (let d = 1; d <= 30; d++) {
        const r = computeQimen({ year: 2026, month: 10, day: d, hour: 14 });
        assert.ok(r.meta.ju.ju >= 1 && r.meta.ju.ju <= 9, `第 ${d} 日局数越界`);
        assert.ok(['上元', '中元', '下元'].includes(r.meta.ju.yuan), `第 ${d} 日元越界`);
    }
});
