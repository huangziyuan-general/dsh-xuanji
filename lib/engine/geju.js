// lib/engine/geju.js — 八字格局判定（简化正格/杂格引擎，纯本地确定性）。
//
// 口径（《子平真诠》通行正格 + 简化取格法）：
//  · 取格以月令（月支本气藏干）对日主的十神为主——月令本气为何十神，即为何格候选；
//  · 正格八种：正官格 / 七杀格（偏官格）/ 正印格 / 偏印格（枭神格）/ 正财格 / 偏财格 / 食神格 / 伤官格；
//  · 成格条件（简化，实现口径）：主十神「透干」（四柱他干见同十神）方立格；
//    未透干时只作候选标注、不作成格论——比传统「透干或月令坐实皆可立格」的宽口径更保守；
//  · 未立正格时按「格局未成（杂格/从格候选）」如实标注，不硬立格，不臆断。
//  · 特殊格局（从强/从弱/两气成象等）不在本引擎口径内，如实说明未判定。
//
// 这是「简化判定」层级——供模型解读引导，不冒充任何流派的定量结论。

import { tenGod, GAN, ZHI, ZHI_CANGGAN } from './tables.js';

/** 月支 → 本气藏干（用于取格主十神）。 */
export const MONTH_BEN_QI = Object.fromEntries(
    ZHI.map((z) => [z, ZHI_CANGGAN[z][0]])
);

/** 十神 → 正格名（八字正格通行八格；比肩/劫财不立正格，按「建禄/阳刃格」俗格另注）。 */
const GEJU_NAME = {
    正官: '正官格',
    七杀: '七杀格（偏官格）',
    正印: '正印格',
    偏印: '偏印格（枭神格）',
    正财: '正财格',
    偏财: '偏财格',
    食神: '食神格',
    伤官: '伤官格',
};

/** 建禄/阳刃俗格（比肩/劫财月令，正格八格之外，单独标注）。 */
const SU_GE = {
    比肩: '建禄格（比肩月令，正格之外，身旺之征）',
    劫财: '阳刃格（劫财月令，正格之外，性刚之征）',
};

/**
 * 格局判定主函数。
 * @param {{dayMasterGan:string, monthZhi:string, allGans:string[]}} p
 *  allGans：四柱全部天干（含日干本身，用于透干判定，排除日干自身）。
 * @returns {{primaryGan:string, primaryGod:string, geju:string|null, suGe:string|null,
 *           formed:boolean, tGan:string[], note:string}}
 */
export function determineGeju(p) {
    const { dayMasterGan, monthZhi, allGans } = p;
    const benQi = MONTH_BEN_QI[monthZhi];
    if (!benQi) throw new Error(`未知月支「${monthZhi}」`);
    const god = tenGod(dayMasterGan, benQi); // 月令本气对日主的十神
    const nonSelf = allGans.filter((g) => g !== dayMasterGan);
    const tGan = nonSelf.filter((g) => g === benQi || tenGod(dayMasterGan, g) === god);

    let geju = GEJU_NAME[god] ?? null;
    let suGe = SU_GE[god] ?? null;
    let formed = tGan.length > 0;

    if (!geju && !suGe) {
        // 月令本气为比劫之外的十神必落在八格之一；此处兜底
        geju = '月令十神格（未匹配正格八格，按「' + god + '」月令取格候选）';
    }

    const note = formed
        ? `月令${monthZhi}本气${benQi}（${god}）${tGan.length > 0 ? `透干见${tGan.join('、')}` : '坐实'}，立${geju ?? suGe}`
        : `月令${monthZhi}本气${benQi}（${god}）未透干（四柱天干无${god}），${geju ? '格弱未成，按「' + geju + '」候选，不作成格论' : '不立正格'}`;

    return { primaryGan: benQi, primaryGod: god, geju, suGe, formed, tGan, note };
}
