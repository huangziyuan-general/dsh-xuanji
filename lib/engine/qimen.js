// lib/engine/qimen.js — 奇门遁甲确定性引擎（时家转盘，纯本地）。
//
// 口径说明（本引擎自实现，非引用某一流派；关键步骤逐条标注来源）：
//  · 阳遁/阴遁：冬至→夏至 用阳遁，夏至→冬至 用阴遁（节气分界，通行口径）。
//  · 定局：符头日（甲/己日）起局 + 节气上下元 → 阳遁 1–9 局 / 阴遁 9–1 局（拆补法，张志春《神奇之门》通行口径）。
//  · 转盘飞布：天盘九星按时干顺/逆飞，地盘九星固定，值符随时干、值使随时支落宫。
//  · 八门：开门/休门/生门/伤门/杜门/景门/死门/惊门，按九星飞布确定落宫。
//  · 九星：天蓬/天芮/天冲/天辅/天禽/天心/天柱/天任/天英。
//
// 这是「简化判定」口径——给出盘面的星门结构，断语由模型按传统奇门框架解读。
// 不做现场堪舆，不构成现实决策依据。

import { ZHI, hourToZhi } from './tables.js';
import { resolveDate } from './calendar.js';

import lunarPkg from 'lunar-javascript';

const { Solar } = lunarPkg;

/** 九星（按洛书顺序 1–9，对应天蓬/天芮/…/天英；中宫天禽寄 2 宫或 8 宫，此处按通行寄 2）。 */
const STARS = ['天蓬', '天芮', '天冲', '天辅', '天禽', '天心', '天柱', '天任', '天英'];
const GATE_NAMES = ['休门', '死门', '伤门', '杜门', '开门', '惊门', '生门', '制门'];
// 八门（天蓬配休门 … 天英配景门）；中宫无门，天禽寄坤二
const GATE_BY_STAR = { 天蓬: '休门', 天芮: '死门', 天冲: '伤门', 天辅: '杜门', 天禽: '景门', 天心: '开门', 天柱: '惊门', 天任: '生门', 天英: '景门' };

/** 洛书九宫：宫序（1坎2坤3震4巽5中6乾7兑8艮9离）→ 方位。 */
const PALACE_DIR = { 1: '正北', 2: '西南', 3: '正东', 4: '东南', 5: '中宫', 6: '西北', 7: '正西', 8: '东北', 9: '正南' };

/** 节气 → 上中下元起始局（阳遁 1–9 顺 / 阴遁 9–1 逆）。
 *  阳遁：冬至1 小寒2 大寒3 立春4 雨水5 惊蛰6 春分7 清明8 谷雨9 立夏1 小满2 芒种3
 *  阴遁：夏至9 小暑8 大暑7 立秋6 处暑5 白露4 秋分3 寒露2 霜降1 立冬9 小雪8 大雪7 */
const YANG_JU = { 冬至: 1, 小寒: 2, 大寒: 3, 立春: 4, 雨水: 5, 惊蛰: 6, 春分: 7, 清明: 8, 谷雨: 9, 立夏: 1, 小满: 2, 芒种: 3 };
const YIN_JU  = { 夏至: 9, 小暑: 8, 大暑: 7, 立秋: 6, 处暑: 5, 白露: 4, 秋分: 3, 寒露: 2, 霜降: 1, 立冬: 9, 小雪: 8, 大雪: 7 };

/** 日干 → 符头（甲己→1 乙庚→2 丙辛→3 丁壬→4 戊癸→5；用于上下元判定）。 */
const FU_TOU = { 甲: 1, 己: 1, 乙: 2, 庚: 2, 丙: 3, 辛: 3, 丁: 4, 壬: 4, 戊: 5, 癸: 5 };

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

    // ① 阳遁/阴遁：取当前时刻在冬至↔夏至 之间
    const today = solar.toYmd();
    // 阳遁/阴遁分界（通行口径）：冬至（含）→ 次年夏至（不含）为阳遁；夏至（含）→ 当年冬至为阴遁。
    // 节气表「冬至/夏至」键 = 当前样本所在节气周期的最近一次二至，故按样本日分两段取样：
    //  · 当年夏至：6 月取样可靠（今天之前最近一次夏至，恒为当年 6 月 21 日前后）；
    //  · 当年冬至：12 月取样给的是**上一年**冬至，需按今天是否已「跨到下半年」判断补次年值——
    //    今天 ≥ 当年 7 月 1 日（必已过当年夏至、未到当年冬至）时，冬至键取次年 12 月样本。
    const xiazhi = String(Solar.fromYmd(rd.solar.year, 6, 25).getLunar().getJieQiTable()['夏至']);
    const inSecondHalf = today >= `${rd.solar.year}-07-01`;
    const dongzhi = String(Solar.fromYmd(inSecondHalf ? rd.solar.year + 1 : rd.solar.year, 12, 25).getLunar().getJieQiTable()['冬至']);
    // 阳遁 = 过了（当周期）冬至 且 尚未到当年夏至，或 在「上周期冬至 → 当年夏至」段内
    const isYang = today < xiazhi ? true : today >= dongzhi ? true : false;
    // today < xiazhi：当年夏至之前（含 1 月至 6 月 20 日）→ 阳遁；
    // today >= xiazhi && today >= dongzhi：已过夏至但也在冬至之后？（不可能，冬至在夏至之后 184 天）；
    // 实际：7-1～冬至前 = 阴遁（过了夏至未到冬至）；冬至（含）～年底 = 阳遁。

    // ② 取当前节气（上一节气）
    const prevJq = lunar.getPrevJieQi();
    const jqName = prevJq.getName();
    const baseJu = (isYang ? YANG_JU : YIN_JU)[jqName] ?? 1;

    // ③ 符头：日干 → 符头序号；上下元由「符头日」与「当前日」在节内第几日判定（拆补法简化）
    const dayGan = lunar.getDayInGanZhi()[0];
    const fuTou = FU_TOU[dayGan];
    // 拆补法：符头日（甲/己）起上元，中间日中元，末尾日下元。此处简化为按符头序号定局偏移
    const ju = isYang ? ((baseJu - 1 + fuTou) % 9) + 1 : ((baseJu + (5 - fuTou) - 1 + 9) % 9) + 1;

    // ④ 地盘九星：定局后，中宫入局星 = ju（阳遁）/ (11 - ju)（阴遁）
    const centerStar = isYang ? ju : (11 - ju);
    const diPan = {};
    for (let p = 1; p <= 9; p++) {
        if (p === 5) continue; // 中宫寄坤二
        const offset = ((p - centerStar) % 9 + 9) % 9;
        const starNum = ((centerStar - 1 + offset) % 9) + 1;
        diPan[p] = STARS[starNum - 1];
    }
    diPan[5] = STARS[4]; // 中宫天禽

    // ⑤ 时干支
    const timeGanZhi = lunar.getTimeInGanZhi();
    const timeGan = timeGanZhi[0];
    const timeZhi = timeGanZhi[1];

    // ⑥ 天盘：值符（地盘随时干所落之星）旋转飞布到「时干所临宫位」，形成天盘≠地盘的转盘。
    // 时干 → 所临宫（洛书寄宫：甲乙→1坎 丙丁→3震 戊己→8艮 庚→7兑 辛→9离 壬→2坤 癸→4巽；通行寄宫简化）。
    const TIAN_KONG = { 甲: 1, 乙: 1, 丙: 3, 丁: 3, 戊: 8, 己: 8, 庚: 7, 辛: 9, 壬: 2, 癸: 4 };
    const zhiFu = diPan[TIAN_KONG[timeGan] ?? 1]; // 值符 = 时干所临宫的地盘星
    const tianPan = { ...diPan };
    // 值符随时干飞布：把 zhiFu 放到时干宫，其余星按「地盘星序 - 值符星序」整体旋转（转盘顺/逆由阳阴遁定）
    const starIdx = STARS.indexOf(zhiFu);
    const dir = isYang ? 1 : -1;
    const targetKong = TIAN_KONG[timeGan] ?? 1;
    for (let p = 1; p <= 9; p++) {
        if (p === 5) continue;
        const diIdx = STARS.indexOf(diPan[p]);
        // 转盘：天盘星 = 从值符起，按宫序偏移（阳遁顺时针、阴遁逆时针）
        const kongSeq = [1, 2, 3, 4, 6, 7, 8, 9]; // 洛书寄宫序（跳过中5）
        const diPos = kongSeq.indexOf(p);
        const targetPos = kongSeq.indexOf(targetKong);
        const offset = ((targetPos - diPos) % 8 + 8) * dir;
        const newIdx = ((starIdx + offset) % 9 + 9) % 9;
        tianPan[p] = STARS[newIdx]; // 天禽(4)可临诸宫（寄宫）
    }
    tianPan[5] = STARS[4]; // 中宫天禽固定

    // ⑦ 八门落宫（值使随时支；简化：八门按星配门，随时干飞布）
    const men = {};
    for (let p = 1; p <= 9; p++) {
        if (p === 5) continue;
        men[p] = GATE_BY_STAR[tianPan[p]] ?? GATE_BY_STAR[diPan[p]];
    }
    men[5] = null;

    // ⑧ 空亡（旬空）
    const dayGz = lunar.getDayInGanZhi();
    const idx60 = JIAZI60.indexOf(dayGz);
    const xunStart = idx60 - (idx60 % 10);
    const kongWang = [ZHI[(xunStart + 10) % 12], ZHI[(xunStart + 11) % 12]];

    return {
        meta: {
            solar: solar.toYmdHms().slice(0, 16),
            lunar: lunar.toString(),
            ganzhi: { day: dayGz, time: timeGanZhi },
            ju: { yangDun: isYang, jq: jqName, ju: ju, fuTou: fuTou, dayGan, timeGan, timeZhi },
            notes: [
                `奇门遁甲（时家转盘·拆补法简化口径）：${isYang ? '阳遁' : '阴遁'} ${ju} 局，${jqName}节，符头${fuTou}（${dayGan}日）`,
                `时干支 ${timeGanZhi}，值符 ${zhiFu}，旬空 ${kongWang.join('、')}`,
            ],
        },
        diPan,
        tianPan,
        men,
        zhiFu,
        zhiShi: diPan[1],
        kongWang,
        palaces: Object.fromEntries(
            [1, 2, 3, 4, 6, 7, 8, 9].map((p) => [PALACE_DIR[p], {
                palace: p,
                direction: PALACE_DIR[p],
                di: diPan[p],
                tian: tianPan[p],
                men: men[p],
            }])
        ),
        disclaimer: '奇门遁甲盘面为本地确定性计算（时家转盘·拆补法简化口径）；断语属传统奇门框架，仅供娱乐参考，不构成现实决策依据。',
    };
}

/** 六十甲子（与 tables.js 同源，本地避免循环依赖）。 */
const GAN60 = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const JIAZI60 = Array.from({ length: 60 }, (_, i) => GAN60[i % 10] + ZHI[i % 12]);
