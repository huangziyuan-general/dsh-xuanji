// lib/engine/shensha.js — 八字神煞确定性查表引擎（传统通行口径，纯本地）。
// 神煞不参与旺衰喜用判定，只作解读引导的「星煞标签」；每条带起法说明与落柱，
// 出处统一标注「传统通行查表口径」。宜留意类术语另附 SOFT_LABEL 中性释义，由工具层直接渲染。

import { ZHI, GAN_REN } from './tables.js';

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

/**
 * 羊刃：直接用 tables.js 的 GAN_REN（阳干帝旺位；阴干不取，免门户之争）。
 * 原本这里另写一份 {甲卯 丙午 戊午 庚酉 壬子}，而 geju.js 是按「月令本气=劫财」判阳刃——
 * 两份定义对戊/己并不等价，于是同一盘里格局说「阳刃格」、神煞说「无羊刃」（AUDIT P2-2）。
 */
const YANG_REN = GAN_REN;

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
 * 每一颗神煞的中性白话释义（全表覆盖，不留 null）。
 *
 * 为什么要这张表：discipline 第 6 条禁恐吓断语并要求「传统术语先解释再使用」，
 * README 与 bazi-tool.js 也写着「凶煞术语输出时由工具层翻译成中性表达」——但旧实现
 * 只是把 `（凶煞）` 原样打给用户，声称的转译并不存在（AUDIT P2-4）。
 * 释义放在引擎而不是散在各 render 里，是为了让工具回执、面板、REST 三条出口拿到同一份措辞。
 *
 * 措辞纪律：只说「传统谓…／主…倾向」，给术语解释而不给吉凶判决；
 * 一律不得出现「凶」「大凶」「灾」「克」「刑」「必」。连「非灾祸预言」这类**否定式免责括注**
 * 也在禁止之列——模型转述时照样会把「灾祸」这个词种进用户耳朵里，那就等于没转译。
 * 上面的正则自检用例（test/shensha.test.mjs）会把这条纪律钉住，新增星煞漏表直接抛错。
 * type 标签也从「凶煞」改成「宜留意」，避免下游模型把类型名当成断语念出去。
 */
export const SOFT_LABEL = {
    // ── 吉星 ──
    天乙贵人: '传统谓易得有力者相助，主关键时刻有人搭手的倾向',
    文昌贵人: '传统谓宜读书文具，主学习与文字方面的倾向',
    太极贵人: '传统谓好玄思义理，主钻研与沉思的倾向',
    金舆: '传统谓出行车马之便，主生活与交通条件渐佳的倾向',
    国印贵人: '传统谓掌印之象，主文书、职守与信誉方面的倾向',
    将星: '传统谓众中出色，主担当与聚拢人众的倾向',
    红鸾: '传统谓婚喜之象，主人缘与感情机会活跃的倾向',
    天喜: '传统谓喜庆之象，主宜操办喜事的倾向',
    天德贵人: '传统谓逢险易过，主化解与缓冲的倾向',
    月德贵人: '传统谓慈和利物，主与人方便的倾向',
    天德合: '传统谓天德之合，主助力来得更自然的倾向',
    月德合: '传统谓月德之合，主人际和气增分的倾向',
    // ── 中性 ──
    驿马: '传统谓奔波迁动，主出行、变动、迁移频繁的倾向',
    华盖: '传统谓孤高好艺，主独处、宗教与技艺方面的倾向',
    // ── 传统列为「宜留意」的一族 ──
    羊刃: '传统谓性刚果决、易走极端，主锐气与冲动的倾向',
    桃花: '传统谓人缘与异性缘活跃，主社交与吸引力的倾向',
    劫煞: '传统谓外缘易扰、事多反复，主节奏宜稳的提醒',
    灾煞: '传统谓宜养宜静，主留意身体与作息的提醒',
    亡神: '传统谓精力易散，主宜有专注之事的提醒',
    孤辰: '传统谓宜独立经营，主独处与自处的倾向',
    寡宿: '传统谓宜安静少欲，主自处的倾向',
};

/** 传统列为「宜留意」的一族（type 标签由「凶煞」改为此，避免被念成断语）。 */
const LIUYI_STARS = new Set(['羊刃', '桃花', '劫煞', '灾煞', '亡神', '孤辰', '寡宿']);

/**
 * 神煞查表主函数。
 * @param {{year:{gan,zhi},month:{gan,zhi},day:{gan,zhi},hour?:{gan,zhi}}} pillars
 * @returns {{name,type,hits:[{pillar,char}],rule}[]} type ∈ 吉星/中性/宜留意（不再用「凶煞」当类型名，避免被下游模型当断语念出）
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
        if (hits.length > 0) {
            const soft = SOFT_LABEL[name];
            if (!soft) throw new Error(`神煞 ${name} 缺 SOFT_LABEL 中性释义（新增星煞必须同步补表）`);
            list.push({ name, type, hits, rule, soft });
        }
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
        push('羊刃', '宜留意',
            zhiList.filter((p) => p.zhi === YANG_REN[dayGan]).map((p) => ({ pillar: PILLAR_NAMES[p.pillar], char: p.zhi })),
            `阳干${dayGan}帝旺位在${YANG_REN[dayGan]}（阴干不取）`);
    }

    // 三合局系：年支、日支各自起局，查其余柱地支（只排除锚柱自身，同支别柱照计）
    for (const [name, table] of Object.entries(SANHE_STARS)) {
        const type = LIUYI_STARS.has(name) ? '宜留意' : name === '将星' ? '吉星' : '中性';
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
    push('孤辰', '宜留意', zhiList.filter((p) => p.pillar !== 'year' && p.zhi === GU_CHEN[yearZhi]).map((p) => ({ pillar: PILLAR_NAMES[p.pillar], char: p.zhi })), `年支${yearZhi}属三会组，孤辰在${GU_CHEN[yearZhi]}`);
    push('寡宿', '宜留意', zhiList.filter((p) => p.pillar !== 'year' && p.zhi === GUA_XIU[yearZhi]).map((p) => ({ pillar: PILLAR_NAMES[p.pillar], char: p.zhi })), `年支${yearZhi}属三会组，寡宿在${GUA_XIU[yearZhi]}`);

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
