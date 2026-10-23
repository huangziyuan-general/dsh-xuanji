// test/external-anchors.test.mjs — 外部真值锚点（与 regression-lock.test.mjs 相对）。
//
// 为什么要单独一个文件：test/regression-lock.test.mjs（原名 golden.test.mjs）的
// 1000+500+300 组「语料」本质是「同输入跑两遍比 JSON」，它守得住「改动破坏了自洽」，
// 守不住「算错了」。实测把 tables.js 里寅的藏干「戊」删掉，全量 271 用例照绿。
// 本文件补的就是那一半：**断言里的事实全部在这里独立重述一遍**（照通行典籍/公开表逐字敲，
// 不从被测模块 import、也不用被测模块的函数推导），于是改坏任一张表就会红。
//
// 维护约定：这里只做「抄写并核对」，不要图省事改成 `Object.entries(CHAR_WUXING)` 那种
// 从实现反推的写法——那等于把锚点又交回给被测代码，测试立刻退回恒真。

import test from 'node:test';
import assert from 'node:assert/strict';

import {
    GAN, ZHI, GAN_WUXING, GAN_YINYANG, ZHI_WUXING, ZHI_CANGGAN,
    tenGod, JIAZI, yearGanZhi, xunKongOf, hourToZhi, CHANG_SHENG, GAN_LU, GAN_REN,
} from '../lib/engine/tables.js';
import { computeBazi } from '../lib/engine/bazi.js';
import { computeQimen, STARS_HOME, GATES_HOME, diPanYiOf, JIEQI_JU, YI_SEQ } from '../lib/engine/qimen.js';
import { DAYOUTIAN, mingGua, yearZibaiStar, yearlyFlying } from '../lib/engine/fengshui.js';
import { YEAR_WEIGHT, MONTH_WEIGHT, DAY_WEIGHT, HOUR_WEIGHT } from '../lib/engine/chenggu.js';
import { computeChenggu } from '../lib/engine/chenggu.js';

// ───────────────────── 干支 / 五行 / 阴阳 ─────────────────────
test('锚：天干地支次序与五行、阴阳归属（《渊海子平》通行表独立重述）', () => {
    assert.deepEqual(GAN, ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']);
    assert.deepEqual(ZHI, ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']);
    assert.deepEqual(GAN_WUXING, ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水']);
    assert.deepEqual(GAN_YINYANG, ['阳', '阴', '阳', '阴', '阳', '阴', '阳', '阴', '阳', '阴']);
    // 地支本气五行：子水 丑土 寅木 卯木 辰土 巳火 午火 未土 申金 酉金 戌土 亥水
    assert.deepEqual(ZHI_WUXING, ['水', '土', '木', '木', '土', '火', '火', '土', '金', '金', '土', '水']);
});

test('锚：地支藏干十二支逐字（本气在前，删/改任意一字本用例会红）', () => {
    const EXPECT = {
        子: ['癸'],
        丑: ['己', '癸', '辛'],
        寅: ['甲', '丙', '戊'],
        卯: ['乙'],
        辰: ['戊', '乙', '癸'],
        巳: ['丙', '庚', '戊'],
        午: ['丁', '己'],
        未: ['己', '丁', '乙'],
        申: ['庚', '壬', '戊'],
        酉: ['辛'],
        戌: ['戊', '辛', '丁'],
        亥: ['壬', '甲'],
    };
    assert.deepEqual(ZHI_CANGGAN, EXPECT);
});

test('锚：十神（用另一套等价判据「生克+同异」独立重算 100 组）', () => {
    // 独立实现：先定关系（同我/我生/我克/克我/生我），再按阴阳同异定偏正。
    const WX = { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' };
    const YY = { 甲: '阳', 乙: '阴', 丙: '阳', 丁: '阴', 戊: '阳', 己: '阴', 庚: '阳', 辛: '阴', 壬: '阳', 癸: '阴' };
    const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
    const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
    const rel = (a, b) => (a === b ? '同' : SHENG[a] === b ? '我生' : KE[a] === b ? '我克' : KE[b] === a ? '克我' : SHENG[b] === a ? '生我' : '?');
    const NAME = {
        同: ['比肩', '劫财'], 我生: ['食神', '伤官'], 我克: ['偏财', '正财'], 克我: ['七杀', '正官'], 生我: ['偏印', '正印'],
    };
    for (const d of GAN) {
        for (const o of GAN) {
            const r = rel(WX[d], WX[o]);
            const idx = YY[d] === YY[o] ? 0 : 1; // 同性取偏类，异性取正类
            assert.equal(tenGod(d, o), NAME[r][idx], `${d} 见 ${o}（${r}）`);
        }
    }
});

test('锚：六十甲子、年干支（1984=甲子）、时辰地支、旬空六旬逐字', () => {
    assert.equal(JIAZI[0], '甲子');
    assert.equal(JIAZI[59], '癸亥');
    assert.equal(JIAZI.length, 60);
    assert.equal(yearGanZhi(1984), '甲子');
    assert.equal(yearGanZhi(1990), '庚午');
    assert.equal(yearGanZhi(2026), '丙午');
    assert.equal(yearGanZhi(4), '甲子');
    // 时辰：23、0 点均子时，两小时一支
    assert.equal(hourToZhi(23), '子');
    assert.equal(hourToZhi(0), '子');
    assert.equal(hourToZhi(1), '丑');
    assert.equal(hourToZhi(3), '寅');
    assert.equal(hourToZhi(22), '亥');
    assert.equal(hourToZhi(24), null);
    // 六旬旬空：甲子戌亥 / 甲戌申酉 / 甲申午未 / 甲午辰巳 / 甲辰寅卯 / 甲寅子丑
    assert.equal(xunKongOf('甲子'), '戌亥');
    assert.equal(xunKongOf('甲戌'), '申酉');
    assert.equal(xunKongOf('甲申'), '午未');
    assert.equal(xunKongOf('甲午'), '辰巳');
    assert.equal(xunKongOf('甲辰'), '寅卯');
    assert.equal(xunKongOf('甲寅'), '子丑');
    assert.equal(xunKongOf('癸丑'), '寅卯', '癸丑在甲辰旬');
});

test('锚：十二长生十行逐字（阳顺阴逆，起于各家长生位）', () => {
    const STAGES = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];
    const EXPECT = {
        甲: { 亥: '长生', 子: '沐浴', 丑: '冠带', 寅: '临官', 卯: '帝旺', 辰: '衰', 巳: '病', 午: '死', 未: '墓', 申: '绝', 酉: '胎', 戌: '养' },
        乙: { 午: '长生', 巳: '沐浴', 辰: '冠带', 卯: '临官', 寅: '帝旺', 丑: '衰', 子: '病', 亥: '死', 戌: '墓', 酉: '绝', 申: '胎', 未: '养' },
        丙: { 寅: '长生', 卯: '沐浴', 辰: '冠带', 巳: '临官', 午: '帝旺', 未: '衰', 申: '病', 酉: '死', 戌: '墓', 亥: '绝', 子: '胎', 丑: '养' },
        丁: { 酉: '长生', 申: '沐浴', 未: '冠带', 午: '临官', 巳: '帝旺', 辰: '衰', 卯: '病', 寅: '死', 丑: '墓', 子: '绝', 亥: '胎', 戌: '养' },
        戊: { 寅: '长生', 卯: '沐浴', 辰: '冠带', 巳: '临官', 午: '帝旺', 未: '衰', 申: '病', 酉: '死', 戌: '墓', 亥: '绝', 子: '胎', 丑: '养' },
        己: { 酉: '长生', 申: '沐浴', 未: '冠带', 午: '临官', 巳: '帝旺', 辰: '衰', 卯: '病', 寅: '死', 丑: '墓', 子: '绝', 亥: '胎', 戌: '养' },
        庚: { 巳: '长生', 午: '沐浴', 未: '冠带', 申: '临官', 酉: '帝旺', 戌: '衰', 亥: '病', 子: '死', 丑: '墓', 寅: '绝', 卯: '胎', 辰: '养' },
        辛: { 子: '长生', 亥: '沐浴', 戌: '冠带', 酉: '临官', 申: '帝旺', 未: '衰', 午: '病', 巳: '死', 辰: '墓', 卯: '绝', 寅: '胎', 丑: '养' },
        壬: { 申: '长生', 酉: '沐浴', 戌: '冠带', 亥: '临官', 子: '帝旺', 丑: '衰', 寅: '病', 卯: '死', 辰: '墓', 巳: '绝', 午: '胎', 未: '养' },
        癸: { 卯: '长生', 寅: '沐浴', 丑: '冠带', 子: '临官', 亥: '帝旺', 戌: '衰', 酉: '病', 申: '死', 未: '墓', 午: '绝', 巳: '胎', 辰: '养' },
    };
    for (const g of GAN) {
        assert.equal(Object.keys(CHANG_SHENG[g]).length, 12, `${g} 长生表不全`);
        for (const [zhi, stage] of Object.entries(EXPECT[g])) {
            assert.equal(CHANG_SHENG[g][zhi], stage, `${g} 见 ${zhi} 应为${stage}`);
        }
        assert.deepEqual(Object.values(CHANG_SHENG[g]).sort(), [...STAGES].sort(), `${g} 十二阶段应不重不漏`);
    }
    // 干禄与阳刃（阳干帝旺）独立重述
    assert.deepEqual(
        GAN.map((g) => GAN_LU[g]),
        ['寅', '卯', '巳', '午', '巳', '午', '申', '酉', '亥', '子'],
        '干禄表：甲寅乙卯丙戊巳丁己午庚申辛酉壬亥癸子',
    );
    assert.deepEqual(GAN_REN, { 甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子' }, '阳刃只论阳干、即其帝旺位');
});

// ───────────────────── 八字排盘：外部盘例 ─────────────────────
test('锚：1990-08-16 14:30 男 → 庚午 甲申 癸丑 己未（市面通行盘，含纳音/十神/藏干逐字）', () => {
    const b = computeBazi({ year: 1990, month: 8, day: 16, hour: 14, minute: 30, gender: 'male' });
    const P = b.pillars;
    assert.deepEqual(['year', 'month', 'day', 'hour'].map((k) => P[k].ganZhi), ['庚午', '甲申', '癸丑', '己未']);
    assert.deepEqual(['year', 'month', 'day', 'hour'].map((k) => P[k].naYin), ['路旁土', '泉中水', '桑柘木', '天上火']);
    assert.deepEqual(['year', 'month', 'day', 'hour'].map((k) => P[k].shiShenGan), ['正印', '伤官', '日主', '七杀']);
    assert.deepEqual(['year', 'month', 'day', 'hour'].map((k) => P[k].xunKong), ['戌亥', '午未', '寅卯', '子丑']);
    // 星运（日主癸对各支）与自坐（本柱天干对本支）分别独立重述
    assert.deepEqual(['year', 'month', 'day', 'hour'].map((k) => P[k].xingYun), ['绝', '死', '冠带', '墓']);
    assert.deepEqual(['year', 'month', 'day', 'hour'].map((k) => P[k].ziZuo), ['沐浴', '绝', '冠带', '冠带'],
        '时柱己未自坐：己土长生酉逆行，未为冠带（README 旧示例误作「墓」，那是星运不是自坐）');
    assert.deepEqual(P.year.cangGan.map((c) => `${c.gan}${c.shiShen}`), ['丁偏财', '己七杀']);
    assert.deepEqual(P.month.cangGan.map((c) => `${c.gan}${c.shiShen}`), ['庚正印', '壬劫财', '戊正官']);
    assert.deepEqual(P.day.cangGan.map((c) => `${c.gan}${c.shiShen}`), ['己七杀', '癸比肩', '辛偏印']);
    assert.deepEqual(P.hour.cangGan.map((c) => `${c.gan}${c.shiShen}`), ['己七杀', '丁偏财', '乙食神']);
    assert.equal(b.meta.shengXiao, '马');
    assert.equal(b.meta.lunar, '一九九〇年六月廿六');
});

test('锚：立春界与春节界窗口（1990-01-30 年柱己巳而民俗生肖马，两者并列且不自相矛盾）', () => {
    const b = computeBazi({ year: 1990, month: 1, day: 30, hour: 10, gender: 'male' });
    assert.equal(b.pillars.year.ganZhi, '己巳', '1990 立春在 2/4，此前年柱仍作己巳');
    assert.equal(b.meta.shengXiao, '马', '生肖按春节界（1990 春节 1/27）');
    assert.ok(b.meta.yearScopeNote, '窗口内必须给出口径说明');
    assert.match(b.meta.yearScopeNote, /立春界/);
    assert.match(b.meta.yearScopeNote, /春节界/);
});

test('锚：晚子时两派口径（1990-08-16 23:30，ziShi=1 次日甲寅 / ziShi=2 当日癸丑）', () => {
    const a = computeBazi({ year: 1990, month: 8, day: 16, hour: 23, minute: 30, gender: 'male' }, { ziShi: 1 });
    const c = computeBazi({ year: 1990, month: 8, day: 16, hour: 23, minute: 30, gender: 'male' }, { ziShi: 2 });
    assert.equal(a.pillars.day.ganZhi, '甲寅');
    assert.equal(c.pillars.day.ganZhi, '癸丑');
    assert.equal(a.pillars.hour.ganZhi, '甲子', '甲日起甲子时（五鼠遁）');
    // sect=2 是「夜子时派」：日柱不翻、时柱仍按**次日**子时起，故仍是甲子而非壬子。
    // 这不是不一致——日不翻时翻本就是该派的定义；本行钉住语义，防止日后被「顺手统一」。
    assert.equal(c.pillars.hour.ganZhi, '甲子', '夜子时派：日柱当日、时柱按次日子时');
});

test('锚：大运（1990-08-16 未时女命 → 逆行癸未/壬午/辛巳，起运 2 年 10 月）', () => {
    const b = computeBazi({ year: 1990, month: 8, day: 16, hour: 14, gender: 'female' });
    assert.equal(b.qiYun.years, 2);
    assert.equal(b.qiYun.months, 10);
    assert.deepEqual(b.daYun.slice(0, 3).map((d) => d.ganZhi), ['癸未', '壬午', '辛巳']);
    assert.deepEqual(b.daYun.slice(0, 3).map((d) => d.startAge), [4, 14, 24], '起运岁按虚岁计');
    assert.equal(b.daYun[0].startYear, 1993);
    assert.equal(b.daYun[0].endYear, 2002);
});

// ───────────────────── 奇门遁甲：完整盘锚 ─────────────────────
// 判据依据：地盘按洛书数序「飞布」（阳遁递增/阴遁递减，戊必落局数宫）；
// 天盘九星与八门是**刚性盘沿后天八卦方位环**旋转（值符随时干、值使门落宫后整盘同转）。
// 方位环自坎北顺时针：坎1→艮8→震3→巽4→离9→坤2→兑7→乾6。
const SPATIAL = [1, 8, 3, 4, 9, 2, 7, 6];

test('锚：本宫盘（九星/八门配九宫）逐字 —— 转盘正确性的地基', () => {
    assert.deepEqual(STARS_HOME, { 1: '天蓬', 2: '天芮', 3: '天冲', 4: '天辅', 6: '天心', 7: '天柱', 8: '天任', 9: '天英' });
    assert.deepEqual(GATES_HOME, { 1: '休门', 2: '死门', 3: '伤门', 4: '杜门', 6: '开门', 7: '惊门', 8: '生门', 9: '景门' });
    // 沿方位环读出的次序必须是 蓬任冲辅英芮柱心 / 休生伤杜景死惊开
    assert.deepEqual(SPATIAL.map((p) => STARS_HOME[p]), ['天蓬', '天任', '天冲', '天辅', '天英', '天芮', '天柱', '天心']);
    assert.deepEqual(SPATIAL.map((p) => GATES_HOME[p]), ['休门', '生门', '伤门', '杜门', '景门', '死门', '惊门', '开门']);
});

test('锚：地盘三奇六仪（阳遁一局 / 阴遁九局 / 阳遁四局逐宫）', () => {
    assert.deepEqual(diPanYiOf(1, true), { 1: '戊', 2: '己', 3: '庚', 4: '辛', 5: '壬', 6: '癸', 7: '丁', 8: '丙', 9: '乙' });
    assert.deepEqual(diPanYiOf(9, false), { 1: '乙', 2: '丙', 3: '丁', 4: '癸', 5: '壬', 6: '辛', 7: '庚', 8: '己', 9: '戊' });
    assert.deepEqual(diPanYiOf(4, true), { 4: '戊', 5: '己', 6: '庚', 7: '辛', 8: '壬', 9: '癸', 1: '丁', 2: '丙', 3: '乙' });
    assert.equal(YI_SEQ.join(''), '戊己庚辛壬癸丁丙乙');
});

test('锚：三元局数表 24 节气逐字（阳遁歌 + 阴遁歌原文抄录）', () => {
    const EXPECT = {
        冬至: [1, 7, 4], 小寒: [2, 8, 5], 大寒: [3, 9, 6], 立春: [8, 5, 2], 雨水: [9, 6, 3], 惊蛰: [1, 7, 4],
        春分: [3, 9, 6], 清明: [4, 1, 7], 谷雨: [5, 2, 8], 立夏: [4, 1, 7], 小满: [5, 2, 8], 芒种: [6, 3, 9],
        夏至: [9, 3, 6], 小暑: [8, 2, 5], 大暑: [7, 1, 4], 立秋: [1, 4, 7], 处暑: [1, 4, 7], 白露: [9, 3, 6],
        秋分: [7, 1, 4], 寒露: [6, 9, 3], 霜降: [5, 8, 2], 立冬: [6, 9, 3], 小雪: [5, 8, 2], 大雪: [4, 7, 1],
    };
    assert.deepEqual(JIEQI_JU, EXPECT);
});

test('锚：阳遁十二节气集（判遁只看节气，逐条独立列出）', () => {
    const YANG_EXPECT = ['冬至', '小寒', '大寒', '立春', '雨水', '惊蛰', '春分', '清明', '谷雨', '立夏', '小满', '芒种'];
    assert.deepEqual(YANG_EXPECT.filter((j) => Object.keys(JIEQI_JU).includes(j)), YANG_EXPECT);
    // 抽两盘验「节气→遁向」不再依赖日期字符串比较
    assert.equal(computeQimen({ year: 2026, month: 6, day: 25, hour: 12 }).meta.ju.yangDun, false, '夏至后必须阴遁');
    assert.equal(computeQimen({ year: 2026, month: 12, day: 25, hour: 12 }).meta.ju.yangDun, true, '冬至后必须阳遁');
});

test('锚：转盘刚性 + 值符随时干 + 天盘携仪（逐宫独立复算，6 盘）', () => {
    for (const c of [
        { year: 2024, month: 3, day: 15, hour: 14 },
        { year: 2026, month: 11, day: 8, hour: 20 },
        { year: 2025, month: 12, day: 21, hour: 9 },
        { year: 2026, month: 6, day: 25, hour: 10 },
        { year: 2000, month: 2, day: 5, hour: 0 },
        { year: 1990, month: 8, day: 16, hour: 23 },
    ]) {
        const r = computeQimen(c);
        const xun = r.xun.palace === 5 ? 2 : r.xun.palace;
        const tg = r.meta.ganzhi.time[0];
        const gp = tg === '甲' ? r.xun.palace : [1, 2, 3, 4, 5, 6, 7, 8, 9].find((p) => r.diPan[p] === tg);
        const starTo = gp === 5 ? 2 : gp;
        const gateTo = r.zhiShi.palace === 5 ? 2 : r.zhiShi.palace;
        const kS = ((SPATIAL.indexOf(starTo) - SPATIAL.indexOf(xun)) % 8 + 8) % 8;
        const kG = ((SPATIAL.indexOf(gateTo) - SPATIAL.indexOf(xun)) % 8 + 8) % 8;
        for (let i = 0; i < 8; i++) {
            const from = SPATIAL[i];
            assert.equal(r.tianPan[SPATIAL[(i + kS) % 8]], STARS_HOME[from], `${JSON.stringify(c)} 星盘宫${from}`);
            assert.equal(r.men[SPATIAL[(i + kG) % 8]], GATES_HOME[from], `${JSON.stringify(c)} 门盘宫${from}`);
            assert.equal(r.tianPanYi[SPATIAL[(i + kS) % 8]], r.diPan[from], `${JSON.stringify(c)} 星携本宫仪`);
        }
        assert.equal(r.diPan[r.meta.ju.ju], '戊', '戊必落局数宫');
        assert.equal(r.men[5], null, '中宫无门');
    }
});

// ───────────────────── 八宅大游年 / 年紫白 ─────────────────────
test('锚：《八宅明镜》游年歌八行逐字 + 方位环次序（独立抄录）', () => {
    // 歌诀后一律跟「自本卦起、按 乾坎艮震巽离坤兑 循环去掉本卦」的七卦序
    const GE = {
        乾: ['坎', '艮', '震', '巽', '离', '坤', '兑'], 坎: ['艮', '震', '巽', '离', '坤', '兑', '乾'],
        艮: ['震', '巽', '离', '坤', '兑', '乾', '坎'], 震: ['巽', '离', '坤', '兑', '乾', '坎', '艮'],
        巽: ['离', '坤', '兑', '乾', '坎', '艮', '震'], 离: ['坤', '兑', '乾', '坎', '艮', '震', '巽'],
        坤: ['兑', '乾', '坎', '艮', '震', '巽', '离'], 兑: ['乾', '坎', '艮', '震', '巽', '离', '坤'],
    };
    const SONG = {
        乾: '六天五祸绝延生', 坎: '五天生延绝祸六', 艮: '六绝祸生延天五', 震: '延生祸绝五天六',
        巽: '天五六祸生绝延', 离: '六五绝延祸生天', 坤: '天延绝生祸五六', 兑: '生祸延绝六五天',
    };
    const FULL = { 六: '六煞', 天: '天医', 五: '五鬼', 祸: '祸害', 绝: '绝命', 延: '延年', 生: '生气' };
    const EAST = ['坎', '离', '震', '巽'];
    for (const gua of Object.keys(GE)) {
        // ① 逐字对比歌诀：DAYOUTIAN[gua][i] 应等于第 i 个方位的星名
        GE[gua].forEach((palace, i) => {
            assert.equal(DAYOUTIAN[gua][i], FULL[SONG[gua][i]], `${gua}宅 ${palace}宫应为${FULL[SONG[gua][i]]}`);
        });
        // ② 结构性校验：东四命的三吉必在东四方、四凶必在西四方（西四命反之）
        const places = Object.fromEntries(GE[gua].map((p, i) => [FULL[SONG[gua][i]], p]));
        const eastFour = EAST.includes(gua);
        for (const s of ['生气', '天医', '延年']) {
            assert.equal(EAST.includes(places[s]), eastFour, `${gua} 吉星${s}落${places[s]}，与东西四分组矛盾`);
        }
        for (const s of ['绝命', '五鬼', '六煞', '祸害']) {
            assert.equal(EAST.includes(places[s]), !eastFour, `${gua} 凶星${s}落${places[s]}，与东西四分组矛盾`);
        }
    }
});

test('锚：八宅命卦公式（1900s / 2000s 两套世纪口径 + 五入中寄卦）', () => {
    const EXPECT = { '1990|male': '坎', '1990|female': '艮', '2000|male': '离', '2000|female': '乾', '2026|male': '坎', '2026|female': '艮' };
    for (const [k, gua] of Object.entries(EXPECT)) {
        const [y, g] = k.split('|');
        assert.equal(mingGua(Number(y), g).gua, gua, `命卦 ${k}`);
    }
    // 五入中寄卦：男作坤、女作艮。1959 男 tail=59 → (100−59)=41 → 41%9=5 → 寄坤(2)
    assert.equal(mingGua(1959, 'male').gua, '坤');
    // 1959 女 → (59−4)=55 → 55%9=1 → 1 坎（不寄，余数非 5）
    assert.equal(mingGua(1959, 'female').gua, '坎');
    // 再独立复算一组「女命余数恰为 5」的年：tail−4 ≡ 5 (mod 9) → tail=18/27/36/45/54/63/72/81/90
    assert.equal(mingGua(1990, 'female').gua, '艮'); // 90−4=86 → 86%9=5 → 女五作艮(8)
});

test('锚：年紫白入中（公开表 2024–2040 逐年）', () => {
    const EXPECT = { 2024: 3, 2025: 2, 2026: 1, 2027: 9, 2028: 8, 2029: 7, 2030: 6, 2031: 5, 2032: 4, 2033: 3, 2034: 2, 2035: 1, 2040: 5 };
    for (const [y, s] of Object.entries(EXPECT)) assert.equal(yearZibaiStar(Number(y)), s, `${y} 年入中星`);
});

test('锚：流年飞星顺飞九宫（一白入中 → 坎六白、乾二黑；五黄/二黑落宫）', () => {
    const f = yearlyFlying(2026);
    assert.equal(f.center, 1);
    const at = (name) => f.palaces.find((p) => p.palace === name).num;
    assert.equal(at('中'), 1);
    assert.equal(at('乾'), 2);
    assert.equal(at('兑'), 3);
    assert.equal(at('艮'), 4);
    assert.equal(at('离'), 5);
    assert.equal(at('坎'), 6);
    assert.equal(at('坤'), 7);
    assert.equal(at('震'), 8);
    assert.equal(at('巽'), 9);
    assert.equal(f.palaces.length, 9, '九宫齐全');
    assert.deepEqual([...f.palaces.map((p) => p.num)].sort(), [1, 2, 3, 4, 5, 6, 7, 8, 9], '九星入宫不重不漏');
});

// ───────────────────── 称骨：四张表独立重述 ─────────────────────
test('锚：称骨年/月/日/时四张表逐字（通行本，抄录自公开表）', () => {
    assert.deepEqual(YEAR_WEIGHT, [
        12, 9, 6, 7, 12, 9, 8, 7, 7, 12,
        15, 9, 16, 8, 8, 19, 12, 9, 8, 7,
        15, 15, 6, 16, 7, 7, 9, 12, 12, 7,
        15, 6, 5, 14, 14, 9, 9, 7, 9, 12,
        8, 7, 13, 5, 14, 5, 9, 9, 5, 7,
        12, 8, 8, 6, 19, 6, 7, 15, 6, 6,
    ]);
    assert.deepEqual(MONTH_WEIGHT, [6, 7, 18, 9, 5, 16, 9, 15, 17, 8, 9, 5]);
    assert.deepEqual(DAY_WEIGHT, [
        5, 10, 8, 15, 10, 15, 8, 16, 8, 16,
        10, 9, 8, 16, 10, 8, 9, 16, 8, 9,
        12, 9, 8, 9, 15, 10, 8, 8, 17, 6,
    ]);
    assert.deepEqual(HOUR_WEIGHT, { 子: 16, 丑: 6, 寅: 7, 卯: 10, 辰: 9, 巳: 16, 午: 10, 未: 8, 申: 8, 酉: 9, 戌: 6, 亥: 6 });
});

test('锚：称骨手算三例（公历/农历两制输入结果必须一致，缺省按公历）', () => {
    const solar = computeChenggu({ year: 1990, month: 8, day: 16, hourZhi: '未' });
    const lunar = computeChenggu({ year: 1990, month: 6, day: 26, hourZhi: '未', calendar: 'lunar' });
    assert.equal(solar.meta.solar, '1990-08-16');
    assert.equal(solar.total.qian, lunar.total.qian, '同一生日的公历/农历输入应同骨重');
    assert.equal(solar.total.label, '四两二钱');
    assert.equal(computeChenggu({ year: 1984, month: 1, day: 1, hourZhi: '子', calendar: 'lunar' }).total.qian, 39);
    assert.equal(computeChenggu({ year: 1985, month: 1, day: 15, hourZhi: '子', calendar: 'lunar' }).total.qian, 41);
    assert.equal(solar.weights.year.label, '庚午年 八钱');
});
