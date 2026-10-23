// lib/engine/qimen.js — 奇门遁甲确定性引擎（时家转盘·拆补法，纯本地）。
//
// 口径（通行时家转盘，关键步骤逐条标注）：
//  · 阳遁/阴遁：冬至（含）→夏至（不含）阳遁；夏至（含）→冬至（含段内）阴遁。
//  · 定局：三元局数表按通行歌诀（冬至/惊蛰一七四、小寒二八五、大寒/春分三九六、
//    雨水九六三、立春八五二、谷雨/小满五二八、清明/立夏四一七、芒种六三九、
//    夏至/白露九三六、小暑八二五、大暑/秋分七一四、立秋/处暑一四七、
//    寒露/立冬六九三、霜降/小雪五八二、大雪四七一）。
//  · 拆补法定元：上元 = 节气日所在符头段（甲/己日起的 5 天块），中/下元顺延；
//    六十甲子全局按 5 天分块（块首必为甲或己），与节气错位时「拆」尾「补」头。
//  · 地盘三奇六仪：仪序「戊己庚辛壬癸丁丙乙」；阳遁戊落局数宫顺飞，阴遁逆飞。
//  · 值符 = 旬首六仪所在宫之九星（六甲遁六仪：甲子戊/甲戌己/甲申庚/甲午辛/甲辰壬/甲寅癸）；
//    天盘 = 九星携本宫仪奇整体旋转，值符星落时干所临宫，环形相对序保持。
//  · 值使 = 旬首宫之八门；值使随时支落宫：从旬首时支起一时一宫（阳顺阴逆，中宫亦在路径，
//    落中宫寄坤二），门盘整体旋转保持相对序。
//  · 时干寻宫以地盘仪奇为准（时干不入盘者唯甲，甲即旬首，值符不动）。
//  · 天禽居中五无门，寄坤二（芮宫）；其仪与门随寄宫口径处理并在 notes 说明。
//
// 断语由模型按传统奇门框架解读；不构成现实决策依据。

import { ZHI } from './tables.js';
import { resolveDate } from './calendar.js';

import lunarPkg from 'lunar-javascript';

const { Solar } = lunarPkg;

/** 九星本宫（洛书宫序；中五天禽寄坤二）。 */
export const STARS_HOME = { 1: '天蓬', 2: '天芮', 3: '天冲', 4: '天辅', 6: '天心', 7: '天柱', 8: '天任', 9: '天英' };
/** 八门本宫（与九星本宫一一对应；天禽寄二，用芮宫死门口径）。 */
export const GATES_HOME = { 1: '休门', 2: '死门', 3: '伤门', 4: '杜门', 6: '开门', 7: '惊门', 8: '生门', 9: '景门' };

/** 转盘环（洛书宫序跳中五：1坎→2坤→3震→4巽→6乾→7兑→8艮→9离，即通行顺时针环）。 */
const RING = [1, 2, 3, 4, 6, 7, 8, 9];

/** 六仪三奇遁序（六仪在前、三奇在后）。 */
export const YI_SEQ = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'];

/** 六甲遁六仪（旬首 → 所遁之仪）。 */
const XUN_DUN_YI = { 甲子: '戊', 甲戌: '己', 甲申: '庚', 甲午: '辛', 甲辰: '壬', 甲寅: '癸' };

/** 三元局数表（通行歌诀逐字）：节气 → [上元局, 中元局, 下元局]。 */
export const JIEQI_JU = {
    冬至: [1, 7, 4], 惊蛰: [1, 7, 4],
    小寒: [2, 8, 5],
    大寒: [3, 9, 6], 春分: [3, 9, 6],
    雨水: [9, 6, 3],
    立春: [8, 5, 2],
    谷雨: [5, 2, 8], 小满: [5, 2, 8],
    清明: [4, 1, 7], 立夏: [4, 1, 7],
    芒种: [6, 3, 9],
    夏至: [9, 3, 6], 白露: [9, 3, 6],
    小暑: [8, 2, 5],
    大暑: [7, 1, 4], 秋分: [7, 1, 4],
    立秋: [1, 4, 7], 处暑: [1, 4, 7],
    寒露: [6, 9, 3], 立冬: [6, 9, 3],
    霜降: [5, 8, 2], 小雪: [5, 8, 2],
    大雪: [4, 7, 1],
};

/** 六十甲子（与 tables.js 同源，本地展开避免循环依赖）。 */
const GAN60 = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const JIAZI60 = Array.from({ length: 60 }, (_, i) => GAN60[i % 10] + ZHI[i % 12]);

/** 日干支序（0=甲子）。 */
const dayGzIndex = (gz) => JIAZI60.indexOf(gz);

/** 地盘三奇六仪：阳遁戊落局数宫顺飞，阴遁逆飞。 */
export function diPanYiOf(ju, yangDun) {
    const board = {};
    for (let p = 1; p <= 9; p++) {
        const shift = yangDun ? (p - ju) % 9 : (ju - p) % 9;
        board[p] = YI_SEQ[((shift % 9) + 9) % 9];
    }
    return board;
}

/** 环旋转：把 ring[fromPos] 的元素搬到 toPos，其余保持相对序。 */
function rotateRing(ring, fromPos, toPos) {
    const offset = ((toPos - fromPos) % ring.length + ring.length) % ring.length;
    return ring.map((_, t) => ring[((t - offset) % ring.length + ring.length) % ring.length]);
}

/**
 * 奇门遁甲主函数。
 * @param {{ year, month, day, hour, calendar?, isLeapMonth?, applyDST?, city?, longitude? }} input
 *  时辰必填（奇门按时干支飞布，缺时干整盘不可排——fail-fast 不猜）。
 */
export function computeQimen(input) {
    const hour = Number.isInteger(input.hour) ? input.hour : null;
    if (hour === null) {
        throw new Error('缺少必要输入：hour（0–23）——奇门遁甲按时干支飞布，缺时辰整盘不可排，按插件纪律应向用户询问确认。');
    }
    const rd = resolveDate({ year: input.year, month: input.month, day: input.day, calendar: input.calendar, isLeapMonth: input.isLeapMonth });
    const solar = Solar.fromYmdHms(rd.solar.year, rd.solar.month, rd.solar.day, hour, 0, 0);
    const lunar = solar.getLunar();

    // ① 阳遁/阴遁：冬至（含）→次年夏至（不含）为阳遁；夏至（含）→当年冬至（含段内）为阴遁。
    //    节气表按「lunar 年」取键：当年 6 月样本恒取当年夏至；下半年取次年 12 月样本得当年冬至。
    const today = solar.toYmd();
    const xiazhi = String(Solar.fromYmd(rd.solar.year, 6, 25).getLunar().getJieQiTable()['夏至']);
    const inSecondHalf = today >= `${rd.solar.year}-07-01`;
    const dongzhi = String(Solar.fromYmd(inSecondHalf ? rd.solar.year + 1 : rd.solar.year, 12, 25).getLunar().getJieQiTable()['冬至']);
    const isYang = today < xiazhi ? true : today >= dongzhi ? true : false;

    // ② 当前节气（prevJq 含起始日期）与三元局数
    const prevJq = lunar.getPrevJieQi();
    const jqName = prevJq.getName();
    const sanYuan = JIEQI_JU[jqName];
    if (!sanYuan) throw new Error(`未知节气「${jqName}」——三元局数表缺项，请检查 JIEQI_JU 表。`);

    // ③ 拆补法定元：上元 = 节气日所在符头段（六十甲子全局按 5 天分块，块首必为甲/己）。
    const jqStartYmd = String(prevJq.getSolar().toYmd());
    const jqStartGz = Solar.fromYmdHms(...jqStartYmd.split('-').map(Number), 12, 0, 0).getLunar().getDayInGanZhi();
    const jqStartIdx = dayGzIndex(jqStartGz);
    const todayIdx = dayGzIndex(lunar.getDayInGanZhi());
    const jqBlockStart = jqStartIdx - (jqStartIdx % 5);
    // 日干支序跨六十甲子回卷（如节气尾跨甲子回 0），步长必须先归一到 0–59 再数块。
    const stepDays = ((todayIdx - jqBlockStart) % 60 + 60) % 60;
    const yuan = Math.floor(stepDays / 5) % 3; // 0=上元 1=中元 2=下元（跨节气日自然换节）
    const ju = sanYuan[yuan];
    const fuTou = jqBlockStart % 10 === 0 ? '甲' : '己'; // 块首天干（idx%10==0 甲 / ==5 己）

    // ④ 地盘三奇六仪（阳遁顺飞 / 阴遁逆飞）与地盘九星（本宫固定）
    const diPanYi = diPanYiOf(ju, isYang);
    const diPanXing = { ...STARS_HOME, 5: '天禽' };

    // ⑤ 时干支与旬首
    const timeGanZhi = lunar.getTimeInGanZhi();
    const timeGan = timeGanZhi[0];
    const timeZhi = timeGanZhi[1];
    const timeIdx = dayGzIndex(timeGanZhi);
    const xunStartIdx = timeIdx - (timeIdx % 10);
    const xunName = JIAZI60[xunStartIdx];
    const dunYi = XUN_DUN_YI[xunName];

    // ⑥ 旬首宫（遁仪所在宫；中五寄坤二）与时干所临宫（时干寻地盘仪奇；甲即旬首不动）
    const palaceOfYi = (yi) => [1, 2, 3, 4, 5, 6, 7, 8, 9].find((p) => diPanYi[p] === yi);
    const xunPalace = palaceOfYi(dunYi);
    const xunPalaceEff = xunPalace === 5 ? 2 : xunPalace;
    const zhiFu = xunPalace === 5 ? '天禽' : STARS_HOME[xunPalace];
    const targetPalace = timeGan === '甲' ? xunPalace : palaceOfYi(timeGan);
    const targetEff = targetPalace === 5 ? 2 : targetPalace;

    // ⑦ 天盘九星：环上把值符星搬到时干宫，其余保持相对序（星携本宫仪奇）。
    const ringStars = RING.map((p) => STARS_HOME[p]);
    const zhiFuPos = RING.indexOf(xunPalaceEff);
    const targetPos = RING.indexOf(targetEff);
    const tianRing = rotateRing(ringStars, zhiFuPos, targetPos);
    const homeOfStar = Object.fromEntries(RING.map((p) => [STARS_HOME[p], p]));
    const tianPan = {};
    const tianPanYi = {};
    RING.forEach((p, t) => {
        tianPan[p] = tianRing[t];
        tianPanYi[p] = diPanYi[homeOfStar[tianRing[t]]];
    });
    tianPan[5] = '天禽';
    tianPanYi[5] = diPanYi[5];

    // ⑧ 值使门与门盘：值使 = 旬首宫之门；随时支一时一宫（阳顺阴逆，九宫路径，落中寄二）。
    const zhiShiGate = GATES_HOME[xunPalaceEff];
    const xunZhiIdx = ZHI.indexOf(xunName[1]);
    const curZhiIdx = ZHI.indexOf(timeZhi);
    const steps = ((curZhiIdx - xunZhiIdx) % 12 + 12) % 12;
    const rawPalace = isYang
        ? ((xunPalaceEff - 1 + steps) % 9) + 1
        : ((xunPalaceEff - 1 - steps) % 9 + 9) % 9 + 1;
    const zhiShiPalace = rawPalace === 5 ? 2 : rawPalace;
    const zhiShiZhuEr = rawPalace === 5;
    const ringGates = RING.map((p) => GATES_HOME[p]);
    const gateFrom = RING.indexOf(xunPalaceEff);
    const gateTo = RING.indexOf(zhiShiPalace);
    const menRing = rotateRing(ringGates, gateFrom, gateTo);
    const men = {};
    RING.forEach((p, t) => { men[p] = menRing[t]; });
    men[5] = null;

    // ⑨ 旬空（时柱旬空：奇门用时家旬空）
    const kongWang = [ZHI[(xunStartIdx + 10) % 12], ZHI[(xunStartIdx + 11) % 12]];

    const PALACE_DIR = { 1: '正北', 2: '西南', 3: '正东', 4: '东南', 5: '中宫', 6: '西北', 7: '正西', 8: '东北', 9: '正南' };
    const notes = [
        `奇门遁甲（时家转盘·拆补法）：${isYang ? '阳遁' : '阴遁'} ${ju} 局，${jqName}${['上元', '中元', '下元'][yuan]}，符头${fuTou}（节气日起于 ${JIAZI60[jqBlockStart]}）`,
        `时柱 ${timeGanZhi}（${xunName}旬，遁${dunYi}），值符 ${zhiFu}${xunPalace === 5 ? '（寄坤二）' : ''} 落${PALACE_DIR[targetPalace]}，值使 ${zhiShiGate} 落${PALACE_DIR[rawPalace]}${zhiShiZhuEr ? '（寄坤二）' : ''}`,
        `旬空 ${kongWang.join('、')}（时家）；天禽居中五寄坤二，中宫仪奇随寄宫口径并入盘面`,
    ];

    return {
        meta: {
            solar: solar.toYmdHms().slice(0, 16),
            lunar: lunar.toString(),
            ganzhi: { day: lunar.getDayInGanZhi(), time: timeGanZhi },
            ju: { yangDun: isYang, jq: jqName, yuan: ['上元', '中元', '下元'][yuan], ju, fuTou, dayGan: lunar.getDayInGanZhi()[0], timeGan, timeZhi },
            notes,
        },
        diPan: diPanYi,      // 地盘三奇六仪（随局落宫——奇门「地盘」的本义）
        diPanXing,           // 地盘九星本宫（静态参照）
        tianPan,             // 天盘九星（携仪旋转，环形相对序保持）
        tianPanYi,           // 天盘各宫所携仪奇（星之本宫地盘仪）
        men,                 // 八门落宫（门盘旋转，值使门随时支）
        zhiFu,               // 值符星（旬首宫之九星；禽寄坤二时为天禽）
        zhiShi: { gate: zhiShiGate, palace: rawPalace, zhuKunEr: zhiShiZhuEr }, // 值使门与落宫
        xun: { name: xunName, dunYi, palace: xunPalace },
        kongWang,
        palaces: Object.fromEntries(
            [1, 2, 3, 4, 5, 6, 7, 8, 9].map((p) => [PALACE_DIR[p], {
                palace: p,
                direction: PALACE_DIR[p],
                di: diPanYi[p],
                tian: tianPan[p],
                tianYi: tianPanYi[p],
                men: men[p],
            }])
        ),
        disclaimer: '奇门遁甲盘面为本地确定性计算（时家转盘·拆补法，通行歌诀三元表）；断语属传统奇门框架，仅供娱乐参考，不构成现实决策依据。',
    };
}
