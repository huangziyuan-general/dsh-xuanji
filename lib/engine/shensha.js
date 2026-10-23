// lib/engine/shensha.js — 八字神煞确定性查表引擎（传统通行口径，纯本地）。
// 神煞不参与旺衰喜用判定，只作解读引导的「星煞标签」；每条带起法说明与落柱，
// 出处统一标注「传统通行查表口径」。凶煞术语输出时由工具层翻译成中性表达。

import { ZHI } from './tables.js';

/** 天乙贵人：日干/年干 → 贵人地支（「甲戊庚牛羊，乙己鼠猴乡，丙丁猪鸡位，壬癸兔蛇藏，六辛逢马虎」）。 */
const TIAN_YI = {
    甲: ['丑', '未'], 戊: ['丑', '未'], 庚: ['丑', '未'],
    乙: ['子', '申'], 己: ['子', '申'],
    丙: ['亥', '酉'], 丁: ['亥', '酉'],
    壬: ['卯', '巳'], 癸: ['卯', '巳'],
    辛: ['午', '寅'],
};

/** 文昌贵人：日干 → 地支（「甲乙巳午报君知，丙戊申宫丁己鸡，庚猪辛鼠壬逢虎，癸人见卯入云梯」）。 */
const WEN_CHANG = { 甲: '巳', 乙: '午', 丙: '申', 戊: '申', 丁: '酉', 己: '酉', 庚: '亥', 辛: '子', 壬: '寅', 癸: '卯' };

/** 羊刃（阳干帝旺位；阴干不取，免门户之争）：甲卯 丙午 戊午 庚酉 壬子。 */
const YANG_REN = { 甲: '卯', 丙: '午', 戊: '午', 庚: '酉', 壬: '子' };

/** 三合局系神煞：年支/日支所属局 → 目标支（桃花咸池/驿马/华盖/将星/劫煞/灾煞）。 */
const SANHE_STARS = {
    桃花: { 申: '酉', 子: '酉', 辰: '酉', 寅: '卯', 午: '卯', 戌: '卯', 巳: '午', 酉: '午', 丑: '午', 亥: '子', 卯: '子', 未: '子', tip: '申子辰在酉，寅午戌在卯，巳酉丑在午，亥卯未在子' },
    驿马: { 申: '寅', 子: '寅', 辰: '寅', 寅: '申', 午: '申', 戌: '申', 巳: '亥', 酉: '亥', 丑: '亥', 亥: '巳', 卯: '巳', 未: '巳', tip: '申子辰马在寅，寅午戌马在申，巳酉丑马在亥，亥卯未马在巳' },
    华盖: { 申: '辰', 子: '辰', 辰: '辰', 寅: '戌', 午: '戌', 戌: '戌', 巳: '丑', 酉: '丑', 丑: '丑', 亥: '未', 卯: '未', 未: '未', tip: '申子辰见辰，寅午戌见戌，巳酉丑见丑，亥卯未见未' },
    将星: { 申: '子', 子: '子', 辰: '子', 寅: '午', 午: '午', 戌: '午', 巳: '酉', 酉: '酉', 丑: '酉', 亥: '卯', 卯: '卯', 未: '卯', tip: '三合局中位（申子辰见子等）' },
    劫煞: { 申: '巳', 子: '巳', 辰: '巳', 寅: '亥', 午: '亥', 戌: '亥', 巳: '寅', 酉: '寅', 丑: '寅', 亥: '申', 卯: '申', 未: '申', tip: '绝位（申子辰见巳等）' },
    灾煞: { 申: '午', 子: '午', 辰: '午', 寅: '子', 午: '子', 戌: '子', 巳: '卯', 酉: '卯', 丑: '卯', 亥: '酉', 卯: '酉', 未: '酉', tip: '将星对冲（申子辰见午等）' },
    亡神: { 寅: '巳', 午: '巳', 戌: '巳', 巳: '申', 酉: '申', 丑: '申', 申: '亥', 子: '亥', 辰: '亥', 亥: '寅', 卯: '寅', 未: '寅', tip: '三合局禄位（寅午戌见巳、巳酉丑见申、申子辰见亥、亥卯未见寅）' },
};

/** 红鸾（年支起卯逆数一位）与天喜（红鸾对冲）。 */
const HONG_LUAN = { 子: '卯', 丑: '寅', 寅: '丑', 卯: '子', 辰: '亥', 巳: '戌', 午: '酉', 未: '申', 申: '未', 酉: '午', 戌: '巳', 亥: '辰' };

/** 孤辰/寡宿（年支三会组）：亥子丑→孤寅寡戌 等。 */
const GU_CHEN = { 亥: '寅', 子: '寅', 丑: '寅', 寅: '巳', 卯: '巳', 辰: '巳', 巳: '申', 午: '申', 未: '申', 申: '亥', 酉: '亥', 戌: '亥' };
const GUA_XIU = { 亥: '戌', 子: '戌', 丑: '戌', 寅: '丑', 卯: '丑', 辰: '丑', 巳: '辰', 午: '辰', 未: '辰', 申: '未', 酉: '未', 戌: '未' };

/** 天德贵人：月支 → 贵干/支（对照四柱任意干支）；月德贵人：月支三合局 → 贵干（对照其余柱天干）。 */
const TIAN_DE = { 寅: '丁', 卯: '申', 辰: '壬', 巳: '辛', 午: '亥', 未: '甲', 申: '癸', 酉: '寅', 戌: '丙', 亥: '乙', 子: '巳', 丑: '庚' };
const YUE_DE = { 寅: '丙', 午: '丙', 戌: '丙', 申: '壬', 子: '壬', 辰: '壬', 亥: '甲', 卯: '甲', 未: '甲', 巳: '庚', 酉: '庚', 丑: '庚' };

/** 天德合：月支天德所合之干（甲己/乙庚/丙辛/丁壬/戊癸）或六合之支。 */
const TIAN_DE_HE = { 寅: '壬', 卯: '巳', 辰: '丁', 巳: '丙', 午: '寅', 未: '己', 申: '戊', 酉: '亥', 戌: '辛', 亥: '庚', 子: '申', 丑: '乙' };

/** 月德合：月德（丙壬甲庚）所合之干（丙辛合→辛、壬丁合→丁、甲己合→己、庚乙合→乙）。 */
const YUE_DE_HE = { 寅: '辛', 午: '辛', 戌: '辛', 申: '丁', 子: '丁', 辰: '丁', 亥: '己', 卯: '己', 未: '己', 巳: '乙', 酉: '乙', 丑: '乙' };

/** 太极贵人：日干/年干 → 地支（「甲乙生人子午中，丙丁鸡兔定亨通，戊己两干临四季，庚辛寅亥禄丰隆，壬癸巳申偏喜美」）。 */
const TAI_JI = {
    甲: ['子', '午'], 乙: ['子', '午'],
    丙: ['卯', '酉'], 丁: ['卯', '酉'],
    戊: ['辰', '戌', '丑', '未'], 己: ['辰', '戌', '丑', '未'],
    庚: ['寅', '亥'], 辛: ['寅', '亥'],
    壬: ['巳', '申'], 癸: ['巳', '申'],
};

/** 金舆：日干 → 地支（「甲龙乙蛇丙戊羊，丁己猴庚犬方，辛猪壬牛癸逢虎」）；婚姻车马之星。 */
const JIN_YU = { 甲: '辰', 乙: '巳', 丙: '未', 戊: '未', 丁: '申', 己: '申', 庚: '戌', 辛: '亥', 壬: '丑', 癸: '寅' };

/** 国印贵人：日干 → 地支（通行表：甲戌 乙亥 丙丑 丁寅 戊卯 己辰 庚巳 辛午 壬未 癸申）；掌印之星。 */
const GUO_YIN = { 甲: '戌', 乙: '亥', 丙: '丑', 丁: '寅', 戊: '卯', 己: '辰', 庚: '巳', 辛: '午', 壬: '未', 癸: '申' };

const PILLAR_NAMES = { year: '年柱', month: '月柱', day: '日柱', hour: '时柱' };

/**
 * 神煞查表主函数。
 * @param {{year:{gan,zhi},month:{gan,zhi},day:{gan,zhi},hour?:{gan,zhi}}} pillars
 * @returns {{name,type,hits:[{pillar,char}],rule}[]} type ∈ 吉星/中性/凶煞
 */
export function computeShenShaStars(pillars) {
    const list = [];
    const zhiList = Object.entries(pillars).map(([k, p]) => ({ pillar: k, gan: p.gan, zhi: p.zhi }));
    const dayGan = pillars.day.gan;
    const yearGan = pillars.year.gan;
    const yearZhi = pillars.year.zhi;
    const dayZhi = pillars.day.zhi;
    const monthZhi = pillars.month.zhi;

    const push = (name, type, hits, rule) => {
        if (hits.length > 0) list.push({ name, type, hits, rule });
    };

    // 天乙贵人：日干、年干查四柱地支（不含锚干所在柱自身要求；通行查任意支）
    for (const [anchorKey, gan] of [['日干', dayGan], ['年干', yearGan]]) {
        const targets = TIAN_YI[gan];
        const hits = zhiList.filter((p) => targets.includes(p.zhi))
            .map((p) => ({ pillar: PILLAR_NAMES[p.pillar], char: p.zhi }));
        if (hits.length > 0 && !list.some((x) => x.name === '天乙贵人')) {
            push('天乙贵人', '吉星', hits, `${anchorKey}${gan}见${targets.join('/')}（甲戊庚牛羊，乙己鼠猴乡…）`);
        }
    }

    // 文昌贵人：日干查四柱地支
    push('文昌贵人', '吉星',
        zhiList.filter((p) => p.zhi === WEN_CHANG[dayGan]).map((p) => ({ pillar: PILLAR_NAMES[p.pillar], char: p.zhi })),
        `日干${dayGan}见${WEN_CHANG[dayGan]}`);

    // 太极贵人：日干、年干查四柱地支（先命中先记，与天乙同构）
    for (const [anchorKey, gan] of [['日干', dayGan], ['年干', yearGan]]) {
        const targets = TAI_JI[gan];
        const hits = zhiList.filter((p) => targets.includes(p.zhi))
            .map((p) => ({ pillar: PILLAR_NAMES[p.pillar], char: p.zhi }));
        if (hits.length > 0 && !list.some((x) => x.name === '太极贵人')) {
            push('太极贵人', '吉星', hits, `${anchorKey}${gan}见${targets.join('/')}（甲乙子午、丙丁卯酉、戊己四季、庚辛寅亥、壬癸巳申）`);
        }
    }

    // 金舆：日干查四柱地支
    push('金舆', '吉星',
        zhiList.filter((p) => p.zhi === JIN_YU[dayGan]).map((p) => ({ pillar: PILLAR_NAMES[p.pillar], char: p.zhi })),
        `日干${dayGan}见${JIN_YU[dayGan]}（甲辰乙巳丙戊未、丁申己申庚戌、辛亥壬丑癸寅）`);

    // 国印贵人：日干查四柱地支
    push('国印贵人', '吉星',
        zhiList.filter((p) => p.zhi === GUO_YIN[dayGan]).map((p) => ({ pillar: PILLAR_NAMES[p.pillar], char: p.zhi })),
        `日干${dayGan}见${GUO_YIN[dayGan]}（甲戌乙亥丙丑丁寅、戊卯己辰庚巳、辛午壬未癸申）`);

    // 羊刃：仅阳干，查四柱地支
    if (YANG_REN[dayGan]) {
        push('羊刃', '凶煞',
            zhiList.filter((p) => p.zhi === YANG_REN[dayGan]).map((p) => ({ pillar: PILLAR_NAMES[p.pillar], char: p.zhi })),
            `阳干${dayGan}帝旺位在${YANG_REN[dayGan]}（阴干不取）`);
    }

    // 三合局系：年支、日支各自起局，查其余柱地支（只排除锚柱自身，同支别柱照计）
    for (const [name, table] of Object.entries(SANHE_STARS)) {
        const type = name === '将星' ? '吉星' : name === '驿马' || name === '华盖' ? '中性' : '凶煞';
        const hits = [];
        for (const anchorKey of ['year', 'day']) {
            const target = table[pillars[anchorKey].zhi];
            for (const p of zhiList) {
                if (p.pillar === anchorKey) continue; // 只排除锚柱自身（自坐不计）
                if (p.zhi === target) {
                    const key = `${PILLAR_NAMES[p.pillar]}${p.zhi}`;
                    if (!hits.some((h) => `${h.pillar}${h.char}` === key)) hits.push({ pillar: PILLAR_NAMES[p.pillar], char: p.zhi });
                }
            }
        }
        push(name, type, hits, `${table.tip}（按年支或日支起局，查其余支）`);
    }

    // 红鸾/天喜：年支查四柱地支（对冲 = 红鸾 + 6 位）
    const hongLuan = HONG_LUAN[yearZhi];
    const tianXi = ZHI[(ZHI.indexOf(hongLuan) + 6) % 12];
    push('红鸾', '吉星', zhiList.filter((p) => p.zhi === hongLuan).map((p) => ({ pillar: PILLAR_NAMES[p.pillar], char: p.zhi })), `年支${yearZhi}起卯逆数，红鸾在${hongLuan}`);
    push('天喜', '吉星', zhiList.filter((p) => p.zhi === tianXi).map((p) => ({ pillar: PILLAR_NAMES[p.pillar], char: p.zhi })), `红鸾对冲，天喜在${tianXi}`);

    // 孤辰/寡宿：年支三会组查其余柱地支
    push('孤辰', '凶煞', zhiList.filter((p) => p.pillar !== 'year' && p.zhi === GU_CHEN[yearZhi]).map((p) => ({ pillar: PILLAR_NAMES[p.pillar], char: p.zhi })), `年支${yearZhi}属三会组，孤辰在${GU_CHEN[yearZhi]}`);
    push('寡宿', '凶煞', zhiList.filter((p) => p.pillar !== 'year' && p.zhi === GUA_XIU[yearZhi]).map((p) => ({ pillar: PILLAR_NAMES[p.pillar], char: p.zhi })), `年支${yearZhi}属三会组，寡宿在${GUA_XIU[yearZhi]}`);

    // 天德贵人：月支查四柱任意干支
    const tianDe = TIAN_DE[monthZhi];
    push('天德贵人', '吉星',
        zhiList.filter((p) => p.gan === tianDe || p.zhi === tianDe).map((p) => ({ pillar: PILLAR_NAMES[p.pillar], char: tianDe })),
        `${monthZhi}月天德在${tianDe}（对照四柱干支）`);

    // 月德贵人：月支三合局查其余柱天干（含月干——月德常以月干自坐论）
    const yueDe = YUE_DE[monthZhi];
    push('月德贵人', '吉星',
        zhiList.filter((p) => p.gan === yueDe).map((p) => ({ pillar: PILLAR_NAMES[p.pillar], char: yueDe })),
        `${monthZhi}月属局，月德在${yueDe}（对照四柱天干）`);

    // 天德合：月支天德所合之干/六合之支，对照四柱任意干支
    const tianDeHe = TIAN_DE_HE[monthZhi];
    push('天德合', '吉星',
        zhiList.filter((p) => p.gan === tianDeHe || p.zhi === tianDeHe).map((p) => ({ pillar: PILLAR_NAMES[p.pillar], char: tianDeHe })),
        `${monthZhi}月天德在${TIAN_DE[monthZhi]}，其合为${tianDeHe}（对照四柱干支）`);

    // 月德合：月德所合之干，对照四柱天干
    const yueDeHe = YUE_DE_HE[monthZhi];
    push('月德合', '吉星',
        zhiList.filter((p) => p.gan === yueDeHe).map((p) => ({ pillar: PILLAR_NAMES[p.pillar], char: yueDeHe })),
        `${monthZhi}月月德在${yueDe}，其合为${yueDeHe}（对照四柱天干）`);

    // 去重（同柱同星只留一条已由 push 上游保证；这里防将星/华盖等同目标撞车重复行）
    return list.filter((row, i) => list.findIndex((x) => x.name === row.name) === i);
}
