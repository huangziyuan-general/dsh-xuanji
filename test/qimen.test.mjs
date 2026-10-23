// test/qimen.test.mjs — 奇门遁甲时家转盘（拆补法，通行口径）：确定性、盘面不变量、定义性锚点、fail-fast。
import test from 'node:test';
import assert from 'node:assert/strict';

import lunarPkg from 'lunar-javascript';
import { computeQimen, diPanYiOf, JIEQI_JU, STARS_HOME, GATES_HOME, YI_SEQ, YANG_JIEQI } from '../lib/engine/qimen.js';

const CASE = { year: 2026, month: 10, day: 23, hour: 14 };

// 后天八卦**方位**环（自坎北起顺时针）：坎1 → 艮8东北 → 震3东 → 巽4东南 → 离9南
// → 坤2西南 → 兑7西 → 乾6西北。这条常量是照方位图独立写出来的，不是从实现里抄的。
// ——旧测试抄的是实现用的数字环 [1,2,3,4,6,7,8,9]，于是「转错盘」被当成了不变量锁死：
//    断言恒真、76% 的盘天盘与八门其实都错位（见 AUDIT-2026-10-23 P1-1）。
const SPATIAL = [1, 8, 3, 4, 9, 2, 7, 6];

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

test('盘面不变量：天盘星与门盘均为本宫盘沿方位环的旋转（转盘保序——回归旧乱序 bug）', () => {
    for (const d of [3, 8, 15, 21, 27]) {
        const r = computeQimen({ year: 2026, month: 10, day: d, hour: 14 });
        // 环常量必须是方位环 SPATIAL。旧测试在这里用了实现抄来的数字环 [1,2,3,4,6,7,8,9]，
        // 于是「转错盘」也照样满足同构——恒真的不变量等于没有不变量（AUDIT P1-1）。
        const diRing = SPATIAL.map((p) => r.diPanXing[p]);
        const tianRing = SPATIAL.map((p) => r.tianPan[p]);
        assert.ok(isRotationOf(tianRing, diRing), `第 ${d} 日天盘星环序必须保持地盘相对序`);
        const gateHomeRing = SPATIAL.map((p) => GATES_HOME[p]);
        const menRing = SPATIAL.map((p) => r.men[p]);
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

// ── P1-2 回归：阴阳遁必须由「当前节气」判，不能由公历日期字符串比较判。
// 旧实现拿 Solar.fromYmd(year,12,25) 的节气表取「冬至」，而 lunar-javascript 的
// getJieQiTable() 按**农历年**给表 —— 上半年的样本取到的是**上一年**的冬至，
// 于是 6/22–6/30（夏至后、但 today >= 去年冬至）被整段判成阳遁，局数对、遁向反，
// 地盘三奇六仪全镜像。旧边界用例只测 1/5、7/1、12/25，全落在故障窗外。
test('阴阳遁：夏至当日交节后到 6 月底这扇窗口不能判成阳遁（2026-06-22…06-30）', () => {
    for (let d = 22; d <= 30; d++) {
        const r = computeQimen({ year: 2026, month: 6, day: d, hour: 12 });
        assert.equal(r.meta.ju.jq, '夏至', `6-${d} 当前节气应为夏至`);
        assert.equal(r.meta.ju.yangDun, false, `6-${d} 夏至后必须阴遁，实际判成阳遁`);
    }
});

test('阴阳遁：2026 全年逐日与「当前节气所属遁」一致（不靠日期字符串比较）', () => {
    const YANG = new Set(['冬至', '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种']);
    const { Solar } = lunarPkg;
    const bad = [];
    for (let i = 0; i < 365; i++) {
        const s = Solar.fromYmd(2026, 1, 1).nextDay(i);
        const jq = Solar.fromYmdHms(s.getYear(), s.getMonth(), s.getDay(), 12, 0, 0).getLunar().getPrevJieQi().getName();
        const r = computeQimen({ year: s.getYear(), month: s.getMonth(), day: s.getDay(), hour: 12 });
        if (r.meta.ju.jq !== jq) bad.push(`${s.toYmd()} 节气名不符 ${r.meta.ju.jq}/${jq}`);
        if (r.meta.ju.yangDun !== YANG.has(jq)) bad.push(`${s.toYmd()} ${jq} 判成${r.meta.ju.yangDun ? '阳' : '阴'}遁`);
    }
    assert.deepEqual(bad, [], `全年不一致的天：\n${bad.join('\n')}`);
});

test('阴阳遁节气集与三元局数表互斥且覆盖全部 24 节气（单一真相自检）', () => {
    assert.equal(YANG_JIEQI.size, 12, '阳遁节气应 12 个');
    assert.equal(Object.keys(JIEQI_JU).length, 24, '局数表应覆盖 24 节气');
    // 判遁集合必须是局数表的子集，且两侧各 12、不重不漏——防止以后加节气只改一处。
    for (const jq of YANG_JIEQI) assert.ok(jq in JIEQI_JU, `阳遁节气「${jq}」不在局数表里`);
    const yin = Object.keys(JIEQI_JU).filter((jq) => !YANG_JIEQI.has(jq));
    assert.equal(yin.length, 12, `阴遁节气应恰好 12 个，实际 ${yin.join(' ')}`);
    assert.equal(Object.entries(JIEQI_JU).filter(([jq]) => YANG_JIEQI.has(jq)).length, 12);
    for (const [, ju] of Object.entries(JIEQI_JU)) {
        assert.equal(ju.length, 3);
        assert.ok(ju.every((n) => Number.isInteger(n) && n >= 1 && n <= 9), `${ju} 局数越界`);
    }
});

test('不同时辰值符/天盘/门盘会变化（转盘真实旋转，非全盘恒定）', () => {
    const a = computeQimen({ year: 2026, month: 10, day: 23, hour: 4 });
    const b = computeQimen({ year: 2026, month: 10, day: 23, hour: 14 });
    const diffCount = SPATIAL.filter((p) => a.tianPan[p] !== b.tianPan[p]).length;
    assert.ok(diffCount > 0, '两时辰天盘应有差异（转盘旋转）');
    const menDiff = SPATIAL.filter((p) => a.men[p] !== b.men[p]).length;
    assert.ok(menDiff > 0, '两时辰门盘应有差异（值使随时支）');
});

test('局数与元在 1–9 / 三元范围内（拆补法不越界）', () => {
    for (let d = 1; d <= 30; d++) {
        const r = computeQimen({ year: 2026, month: 10, day: d, hour: 14 });
        assert.ok(r.meta.ju.ju >= 1 && r.meta.ju.ju <= 9, `第 ${d} 日局数越界`);
        assert.ok(['上元', '中元', '下元'].includes(r.meta.ju.yuan), `第 ${d} 日元越界`);
    }
});

// ── P1-1 回归：转盘必须沿「后天八卦方位环」做刚体旋转 ──────────────────────
test('外部事实锚：本宫盘沿空间环读出的九星序与八门序（通行盘面，不依赖实现）', () => {
    assert.deepEqual(SPATIAL.map((p) => STARS_HOME[p]),
        ['天蓬', '天任', '天冲', '天辅', '天英', '天芮', '天柱', '天心'],
        '九星本宫沿空间环必须是 蓬任冲辅英芮柱心（数字序会读成 蓬芮冲辅心柱任英，那不是任何方位排布）');
    assert.deepEqual(SPATIAL.map((p) => GATES_HOME[p]),
        ['休门', '生门', '伤门', '杜门', '景门', '死门', '惊门', '开门'],
        '八门本宫沿空间环必须是 休生伤杜景死惊开');
});

test('转盘刚性：天盘九星必须是本宫盘沿空间环的整体位移（6 组日期 × 12 时辰扫描）', () => {
    const home = SPATIAL.map((p) => STARS_HOME[p]);
    const bad = [];
    for (const [mo, d] of [[3, 15], [3, 16], [10, 23], [1, 20], [6, 10], [12, 25]]) {
        for (const h of [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]) {
            const r = computeQimen({ year: 2024, month: mo, day: d, hour: h });
            const got = SPATIAL.map((p) => r.tianPan[p]);
            if (!isRotationOf(got, home)) {
                bad.push(`${mo}-${d} ${h}时: ${got.join('')}`);
            }
        }
    }
    assert.deepEqual(bad, [], `天盘不是刚体旋转的盘：\n${bad.join('\n')}`);
});

test('转盘刚性：八门同理必须沿空间环整体位移', () => {
    const home = SPATIAL.map((p) => GATES_HOME[p]);
    const bad = [];
    for (let d = 1; d <= 28; d++) {
        for (const h of [3, 9, 15, 21]) {
            const r = computeQimen({ year: 2024, month: 5, day: d, hour: h });
            const got = SPATIAL.map((p) => r.men[p]);
            if (!isRotationOf(got, home)) bad.push(`5-${d} ${h}时: ${got.join('')}`);
        }
    }
    assert.deepEqual(bad, [], `门盘不是刚体旋转的盘：\n${bad.join('\n')}`);
});

test('值符随时干、值使随时支：两盘各自沿空间环刚转，逐宫显式断言', () => {
    // 注意：星盘与门盘的位移量**一般不同**（值符随时干宫、值使门按洛书数序数到时支宫），
    // 但两者都必须是自己那张本宫盘的刚体旋转。旧实现两个盘都在数字环上转，
    // 于是「同构」成立而「方位」全错——所以这里不用环序同构，而是逐宫算出落点。
    for (const CASE2 of [{ year: 2024, month: 3, day: 15, hour: 14 }, { year: 2026, month: 11, day: 8, hour: 20 }, { year: 2025, month: 12, day: 21, hour: 9 }]) {
        const r = computeQimen(CASE2);
        const xunEff = r.xun.palace === 5 ? 2 : r.xun.palace;
        const tg = r.meta.ganzhi.time[0];
        const ganPalace = tg === '甲' ? r.xun.palace : [1, 2, 3, 4, 5, 6, 7, 8, 9].find((p) => r.diPan[p] === tg);
        const starTarget = ganPalace === 5 ? 2 : ganPalace;
        const gateTarget = r.zhiShi.palace === 5 ? 2 : r.zhiShi.palace;
        const kStar = ((SPATIAL.indexOf(starTarget) - SPATIAL.indexOf(xunEff)) % 8 + 8) % 8;
        const kGate = ((SPATIAL.indexOf(gateTarget) - SPATIAL.indexOf(xunEff)) % 8 + 8) % 8;
        for (let i = 0; i < 8; i++) {
            const from = SPATIAL[i];
            assert.equal(r.tianPan[SPATIAL[(i + kStar) % 8]], STARS_HOME[from],
                `${JSON.stringify(CASE2)}：本宫${from}的 ${STARS_HOME[from]} 应沿空间环转 ${kStar} 格`);
            assert.equal(r.men[SPATIAL[(i + kGate) % 8]], GATES_HOME[from],
                `${JSON.stringify(CASE2)}：宫${from}的 ${GATES_HOME[from]} 应沿空间环转 ${kGate} 格`);
            assert.equal(r.tianPanYi[SPATIAL[(i + kStar) % 8]], r.diPan[from],
                `星 ${STARS_HOME[from]} 应携其本宫${from}的地盘仪 ${r.diPan[from]}`);
        }
    }
});
