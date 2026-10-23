// lib/engine/geju.js — 八字格局判定（简化正格/建禄阳刃引擎，纯本地确定性）。
//
// 取格次序（《子平真诠》通行口径的简化实现）：
//  1. 遍历月支藏干（本气 → 中气 → 余气），取**第一个十神属正格八格且透于他柱**者立格；
//     本气即八格时就是常规「月令本气取格」，本气为比劫而中/余气透干时即传统所谓「别取透干」。
//  2. 八格无可取时，退到禄刃层：月支是日主**刃位**（GAN_REN，只论阳干）立阳刃格、
//     是日主**禄位**（GAN_LU）立建禄格；两者都不是而本气仍为比劫，如实记「月令劫财」不立俗格。
//  3. 本气属八格但未透干时，只作**候选**标注、不作成格论——比传统「透干或月令坐实皆可立格」
//     的宽口径更保守，是有意为之的简化。
//
// 三条口径纪律（都是踩过的坑，见 AUDIT-2026-10-23）：
//  · 透干判定排除的是**日主那一柱**，不是「所有与日主同字的干」——年干与日主同字时它确实是
//    比肩/劫财透干，按字符删会输出「四柱天干无比肩」这种与盘面当面矛盾的话（P2-1）；
//  · 刃位一律取 tables.js 的 GAN_REN（阳干帝旺位），**不看月令本气是不是劫财**：
//    戊与丙同宫，戊 禄在巳、帝旺在午，而巳本气是丙、午本气是丁——按本气判会把
//    戊日午月错立成「正印格」、把戊日未月错立成「阳刃格」（本轮补用例时新抓出的 bug）；
//  · 刃只论阳干，与 shensha.js 羊刃同一张表；阴干一侧的措辞刻意**不出现「阳刃」二字**，
//    因为这些字段会被模型原样转述给用户，「不立阳刃格」也会被下游读成「此命带阳刃」（P2-2）。
//
// 特殊格局（从强/从弱/两气成象等）不在本引擎口径内，如实说明未判定。
// 这是「简化判定」层级——供解读引导，不冒充任何流派的定量结论。

import { tenGod, GAN, GAN_YINYANG, ZHI, ZHI_CANGGAN, GAN_LU, GAN_REN } from './tables.js';

/** 月支 → 本气藏干（用于取格主十神）。 */
export const MONTH_BEN_QI = Object.fromEntries(
    ZHI.map((z) => [z, ZHI_CANGGAN[z][0]])
);

/** 十神 → 正格名（八字正格通行八格；比肩/劫财不立正格，按建禄/阳刃俗格另注）。 */
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

const LAYER_NAME = ['本气', '中气', '余气'];

/**
 * 禄刃层的俗格名（八格取不到时才有意义）。
 * @returns {{name:string, kind:'yang刃'|'建禄'|'月令比劫'}|null}
 */
function luRenSuGe(dayMasterGan, monthZhi, benQGod) {
    const yangGan = GAN_YINYANG[GAN.indexOf(dayMasterGan)] === '阳';
    if (yangGan && GAN_REN[dayMasterGan] === monthZhi) {
        return { kind: '刃', name: '阳刃格（日主阳干帝旺之位当令，正格之外，性刚之征）' };
    }
    if (GAN_LU[dayMasterGan] === monthZhi) {
        // 本气即比肩时沿用旧措辞（多数盘的观感不变）；戊/己这类「禄位本气非本我」的盘
        // 必须改说禄位，否则「比肩月令」本身就是错的描述。
        return {
            kind: '禄',
            name: benQGod === '比肩'
                ? '建禄格（比肩月令，正格之外，身旺之征）'
                : '建禄格（日主禄位当令，正格之外，身旺之征）',
        };
    }
    if (benQGod === '比肩' || benQGod === '劫财') {
        return { kind: '比劫', name: `月令${benQGod}（非禄刃之位，本引擎不立俗格）` };
    }
    return null;
}

/**
 * 格局判定主函数。
 * @param {{dayMasterGan:string, monthZhi:string, otherGans:(string|null|undefined)[]}} p
 *  otherGans：**除日柱外**其余各柱天干（时辰未知可留空位，函数会滤掉）。
 * @returns {{primaryGan:string, primaryGod:string, geju:string|null, suGe:string|null,
 *           formed:boolean, tGan:string[], note:string}}
 */
export function determineGeju(p) {
    const { dayMasterGan, monthZhi } = p;
    const benQi = MONTH_BEN_QI[monthZhi];
    if (!benQi) throw new Error(`未知月支「${monthZhi}」`);
    const others = (p.otherGans ?? []).filter(Boolean);

    /** 某十神在其余各柱的透干（去重，保持柱序）。 */
    const touGan = (god) => [...new Set(others.filter((g) => tenGod(dayMasterGan, g) === god))];

    const benQGod = tenGod(dayMasterGan, benQi);
    /** 月支藏干按 本气 → 中气 → 余气 的传统次序，附各自十神。 */
    const layers = ZHI_CANGGAN[monthZhi].map((g, i) => ({
        g, layer: LAYER_NAME[i] ?? '余气', god: tenGod(dayMasterGan, g),
    }));
    /** 第一个「属正格八格且透于他柱」的月令藏干。 */
    const pickable = layers.filter((x) => GEJU_NAME[x.god]);
    const alt = pickable.find((x) => touGan(x.god).length > 0);

    if (alt) {
        const tGan = touGan(alt.god);
        const su = (benQGod === '比肩' || benQGod === '劫财' || GAN_LU[dayMasterGan] === monthZhi
            || (GAN_YINYANG[GAN.indexOf(dayMasterGan)] === '阳' && GAN_REN[dayMasterGan] === monthZhi))
            ? luRenSuGe(dayMasterGan, monthZhi, benQGod) : null;
        const context = su && su.name ? `月令${monthZhi}本气${benQi}为日主之${benQGod}（${su.name}），` : '';
        const layerWord = alt.layer === '本气' ? '' : `${alt.layer}气`;
        return {
            primaryGan: alt.g, primaryGod: alt.god,
            geju: GEJU_NAME[alt.god], suGe: su?.name ?? null,
            formed: true, tGan,
            note: `${context}正格另取${monthZhi}中${layerWord}${alt.g}透干（见${tGan.join('、')}，${alt.god}），立${GEJU_NAME[alt.god]}`,
        };
    }

    // 八格无透干可取 → 禄刃层
    const su = luRenSuGe(dayMasterGan, monthZhi, benQGod);
    if (su) {
        const tou = touGan(benQGod);
        return {
            primaryGan: benQi, primaryGod: benQGod,
            geju: null, suGe: su.name,
            formed: su.kind === '比劫' ? false : true,
            tGan: tou,
            note: `月令${monthZhi}本气${benQi}为日主之${benQGod}，八格无可取，立${su.name}`
                + (tou.length ? `，${benQGod}又透干见${tou.join('、')}，身旺愈显` : ''),
        };
    }

    // 本气属八格但未透 → 保守口径：只作候选
    const geju = GEJU_NAME[benQGod] ?? null;
    if (!geju) {
        return {
            primaryGan: benQi, primaryGod: benQGod, geju: null, suGe: null, formed: false, tGan: [],
            note: `月令${monthZhi}本气${benQi}对日主为${benQGod}，未匹配正格八格与禄刃，按「${benQGod}」月令取格候选`,
        };
    }
    return {
        primaryGan: benQi, primaryGod: benQGod, geju, suGe: null, formed: false, tGan: [],
        note: `月令${monthZhi}本气${benQi}（${benQGod}）未透干（其余三柱天干无${benQGod}），格弱未成，按「${geju}」候选，不作成格论`,
    };
}
