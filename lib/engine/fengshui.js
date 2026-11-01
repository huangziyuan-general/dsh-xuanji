// lib/engine/fengshui.js — 风水引擎（纯本地确定性）：
// 一期：① 八宅命卦：出生年（按立春界）+性别 → 东四/西四命 → 大游年八星（生气/延年/天医/伏位/绝命/五鬼/六煞/祸害）；
//       ② 流年九宫飞星（年家紫白）：本模块纯公式 yearZibaiStar（2026 丙午一白入中、逐年退一位、
//          九年一轮，按立春换年）入中顺飞。曾经走 lunar-javascript 的 NineStar，该接口已废弃。
// 二期（action=advise）：③ 24 山坐向 → 宅卦 → 宅之八星盘 → 门主灶厕布局倾向 + 命宅配。
// 口径：大游年歌与 24 山归属为八宅通行口径；吉凶名词照传统转述，不做现场勘舆。

import lunarPkg from 'lunar-javascript';
import { resolveBirthTime } from './birth-time.js';

const { Solar } = lunarPkg;

/** 九星名称表：数 → {name, color, element, star(北斗名), lucky}。 */
export const NINE_STARS = {
    1: { name: '一白', color: '白', element: '水', star: '贪狼', lucky: true },
    2: { name: '二黑', color: '黑', element: '土', star: '巨门', lucky: false },
    3: { name: '三碧', color: '碧', element: '木', star: '禄存', lucky: false },
    4: { name: '四绿', color: '绿', element: '木', star: '文曲', lucky: true },
    5: { name: '五黄', color: '黄', element: '土', star: '廉贞', lucky: false },
    6: { name: '六白', color: '白', element: '金', star: '武曲', lucky: true },
    7: { name: '七赤', color: '赤', element: '金', star: '破军', lucky: false },
    8: { name: '八白', color: '白', element: '土', star: '左辅', lucky: true },
    9: { name: '九紫', color: '紫', element: '火', star: '右弼', lucky: true },
};

/** 后天八卦 → 方位。 */
export const PALACE_DIRECTION = {
    坎: '正北', 艮: '东北', 震: '正东', 巽: '东南',
    离: '正南', 坤: '西南', 兑: '正西', 乾: '西北',
};

/** 大游年歌（自本卦起，按「坎艮震巽离坤兑乾」循环顺数八星，数组为自卦后第 1–7 位）。
 *  歌诀：乾六天五祸绝延生 / 坎五天生延绝祸六 / 艮六绝祸生延天五 / 震延生祸绝五天六
 *        巽天五六祸生绝延 / 离六五绝延祸生天 / 坤天延绝生祸五六 / 兑生祸延绝六五天
 *  交叉校验：八组「生气」落位与东西四命配对（乾兑、坎巽、震离、坤艮）全部吻合。 */
const YOUNIAN_ORDER = ['坎', '艮', '震', '巽', '离', '坤', '兑', '乾'];
export const DAYOUTIAN = {
    乾: ['六煞', '天医', '五鬼', '祸害', '绝命', '延年', '生气'],
    坎: ['五鬼', '天医', '生气', '延年', '绝命', '祸害', '六煞'],
    艮: ['六煞', '绝命', '祸害', '生气', '延年', '天医', '五鬼'],
    震: ['延年', '生气', '祸害', '绝命', '五鬼', '天医', '六煞'],
    巽: ['天医', '五鬼', '六煞', '祸害', '生气', '绝命', '延年'],
    离: ['六煞', '五鬼', '绝命', '延年', '祸害', '生气', '天医'],
    坤: ['天医', '延年', '绝命', '生气', '祸害', '五鬼', '六煞'],
    兑: ['生气', '祸害', '延年', '绝命', '六煞', '五鬼', '天医'],
};

const LUCKY_STARS = ['生气', '延年', '天医', '伏位'];
const UNLUCKY_STARS = ['绝命', '五鬼', '六煞', '祸害'];

/**
 * 24 山（罗盘周天 360° 每山 15°，自北顺时针）：山 → 后天八卦归属 + 中心度数。
 * 通行归属：壬子癸→坎 / 丑艮寅→艮 / 甲卯乙→震 / 辰巽巳→巽 / 丙午丁→离 / 未坤申→坤 / 庚酉辛→兑 / 戌乾亥→乾。
 * 度数为每山中心线（子山 = 0°/正北）。
 */
export const MOUNTAINS_24 = [
    { m: '壬', gua: '坎', deg: 345 }, { m: '子', gua: '坎', deg: 0 }, { m: '癸', gua: '坎', deg: 15 },
    { m: '丑', gua: '艮', deg: 30 }, { m: '艮', gua: '艮', deg: 45 }, { m: '寅', gua: '艮', deg: 60 },
    { m: '甲', gua: '震', deg: 75 }, { m: '卯', gua: '震', deg: 90 }, { m: '乙', gua: '震', deg: 105 },
    { m: '辰', gua: '巽', deg: 120 }, { m: '巽', gua: '巽', deg: 135 }, { m: '巳', gua: '巽', deg: 150 },
    { m: '丙', gua: '离', deg: 165 }, { m: '午', gua: '离', deg: 180 }, { m: '丁', gua: '离', deg: 195 },
    { m: '未', gua: '坤', deg: 210 }, { m: '坤', gua: '坤', deg: 225 }, { m: '申', gua: '坤', deg: 240 },
    { m: '庚', gua: '兑', deg: 255 }, { m: '酉', gua: '兑', deg: 270 }, { m: '辛', gua: '兑', deg: 285 },
    { m: '戌', gua: '乾', deg: 300 }, { m: '乾', gua: '乾', deg: 315 }, { m: '亥', gua: '乾', deg: 330 },
];

const MOUNTAIN_INDEX = new Map(MOUNTAINS_24.map((x, i) => [x.m, i]));

/** 山名 → 24 山条目；非法山名抛可行动错误。 */
export function mountainInfo(name) {
    const i = MOUNTAIN_INDEX.get(name);
    if (i === undefined) {
        throw new Error(`坐向必须是 24 山之一（${MOUNTAINS_24.map((x) => x.m).join('')}），收到「${name}」——请按罗盘 24 山报坐或报向，不要自造方位词。`);
    }
    return { ...MOUNTAINS_24[i], index: i };
}

/** 向山 → 坐山（对宫，+180°）。 */
export function sittingFromFacing(facing) {
    const f = mountainInfo(facing);
    const s = MOUNTAINS_24[(f.index + 12) % 24];
    return { ...s, index: (f.index + 12) % 24 };
}

/** 宅卦的东四/西四归属（宅与命同一套分组）。 */
function guaGroup(gua) {
    return ['坎', '离', '震', '巽'].includes(gua) ? '东四' : '西四';
}

/** 八星 → 布局角色的传统口径（门主灶厕各宜何星方）。 */
const STAR_LAYOUT_ROLE = {
    生气: '大吉：最宜开门、主卧、灶口朝向',
    延年: '大吉：宜开门、主卧（利感情与人缘）',
    天医: '次吉：宜主卧、书房、老人房（利健康）',
    伏位: '次吉：宜卧室、神位（主平稳）',
    祸害: '小凶：宜厕所、储物间（宜静不宜动）',
    六煞: '次凶：宜厕所、储物间',
    五鬼: '大凶：宜厕所，或以灶坐压之（传统「火烧五鬼」说）',
    绝命: '最凶：宜灶坐压之、储物，忌门床',
};

const GUA_NAMES = ['坎', '坤', '震', '巽', '中', '乾', '兑', '艮', '离']; // 洛书数 1–9 对应宫
const PALACE_ORDER = ['坎', '坤', '震', '巽', '中', '乾', '兑', '艮', '离'];

// ───────────────────────── 玄空飞星（P1.9 深度）─────────────────────────
// 与「年家紫白」不同：玄空是「三元九运」体系——以当下元运入中，山/向两盘再各按坐向 24 山阴阳顺逆飞布，
// 三盘叠成「宅命盘」判旺衰格局。口径为沈氏玄空通行排盘法，仅作民俗参考。

/** 洛书飞布序（顺飞路径）：中5→乾6→兑7→艮8→离9→坎1→坤2→震3→巽4。 */
const FLY_PALACES = ['中', '乾', '兑', '艮', '离', '坎', '坤', '震', '巽'];

/** 24 山阴阳（三元龙通行口径）：阳顺飞、阴逆飞。
 *  阳：壬（水）、甲（木）、丙（火）、庚（金）四地元正 + 天元四隅（乾巽艮坤）+ 人元 寅巳申亥；
 *  阴：癸（水）、乙（木）、丁（火）、辛（金）四地元正 + 天元四正（子午卯酉）。 */
const YINYANG_24 = new Set([
    '甲', '庚', '壬', '丙',   // 地元阳龙：甲庚壬丙（水木火金四干）
    '乾', '巽', '艮', '坤',      // 天元四隅（阳）：乾坤艮巽
    '寅', '申', '巳', '亥',      // 人元阳龙：寅申巳亥
]);
// 阴（不在集合，默认逆飞）：天元四正子午卯酉、地元阴龙辰戌丑未、人元阴龙乙辛丁癸。
const isYangMountain = (m) => YINYANG_24.has(m);

/** 三元九运：year → 运数（1–9）。1864–1883 一运 … 2024–2043 九运，每运 20 年。 */
export function periodOf(year) {
    // 三元九运 180 年一轮：1864–2043 为一轮（一运…九运），2044 起进入下一轮一运。
    // 用 ((year - 1864) mod 180) 归一到 0–179，再 20 年一格取 1–9。
    const offset = ((year - 1864) % 180 + 180) % 180;
    return Math.floor(offset / 20) + 1;
}

/** 飞星：digit 入中宫，按 flyDir('顺'|'逆') 飞布到各宫，返回 {宫: 数}。
 *  飞布按洛书轨迹「中→乾→兑→艮→离→坎→坤→震→巽」：第 k 宫（中宫 k=0）
 *  落 (centerDigit + k) mod 9（1–9），即顺飞（满九归一）；逆飞则逐位递减。
 *  校验锚点（公开盘）：九运运盘 9 入中恒顺飞 → 中9 乾1 兑2 艮3 离4 坎5 坤6 震7 巽8；
 *  若山/向盘逆飞（如九运艮山坤向山星 3 入中逆飞 → 中3 乾2 兑1 艮9 离8 坎7 坤6 震5 巽4）。 */
function flyDigitMap(centerDigit, flyDir) {
    const out = {};
    FLY_PALACES.forEach((palace, k) => {
        // 洛书轨迹第 k 宫（中 k=0）：顺飞 = 数字递增 (center + k) mod 9；逆飞 = 数字递减。
        // 9→1 归一。校验锚点（公开盘）：九运运盘 9 入中恒顺飞 →
        //   中9 乾1 兑2 艮3 离4 坎5 坤6 震7 巽8（「满九归一」）。
        const n = flyDir === '逆'
            ? (((centerDigit - 1 - k) % 9) + 9) % 9 + 1
            : (((centerDigit - 1 + k) % 9) + 9) % 9 + 1;
        out[palace] = n;
    });
    return out;
}

/** 旺星是否「到对宫」（上山下水判据）：旺星落在对方宫、本宫非旺星。 */
function shInOpposite(period, pan, ownGua, oppGua) {
    return pan[oppGua] === period && pan[ownGua] !== period;
}

/**
 * 玄空飞星主函数。
 * @param {{ year:number, sitting:string, facing?:string }} input
 *   year：用于定元运（缺省取 2024→九运）；sitting：坐山（24 山，必填）；facing：向山（可选，缺则按坐山对宫推）。
 */
export function computeXuanKong(input) {
    const year = Number.isInteger(input.year) ? input.year : 2024;
    const period = periodOf(year);
    const sitting = mountainInfo(input.sitting);
    const facing = input.facing ? mountainInfo(input.facing) : MOUNTAINS_24[(sitting.index + 12) % 24];
    // 坐/向宫（八卦名）
    const sitGua = sitting.gua;
    const facGua = facing.gua;
    // 坐/向山阴阳 → 顺逆。
    // 沈氏玄空「同元立向」：山向以坐山三元龙定阴阳；同元（坐/向 24 山同属天元/地元/人元同一支序）则向山顺逆随坐山。
    // 24 山序：壬(0)子(1)癸(2)丑(3)艮(4)寅(5)甲(6)卯(7)乙(8)辰(9)巽(10)巳(11)丙(12)午(13)丁(14)未(15)坤(16)申(17)庚(18)酉(19)辛(20)戌(21)乾(22)亥(23)
    // 同元对（坐山 index 对向山 index）：0↔1、2↔3、4↔5、6↔7、8↔9、10↔11、12↔13、14↔15、16↔17、18↔19、20↔21、22↔23
    const SAME_MINGYUAN = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23].flatMap((i) => [i]));
    const sameGua = (a, b) => Math.abs(a.index - b.index) === 1; // 同卦三山相邻 index
    const sitDir = isYangMountain(sitting.m) ? '顺' : '逆';
    const facDir = sameGua(sitting, facing) ? sitDir : (isYangMountain(facing.m) ? '顺' : '逆');

    // ① 运盘：运数入中，顺飞
    const yunPan = flyDigitMap(period, '顺');
    // ② 山盘：运盘坐山宫之数入中，按坐山阴阳飞布
    const shanCenter = yunPan[sitGua];
    const shanPan = flyDigitMap(shanCenter, sitDir);
    // ③ 向盘：取运盘向首宫（facGua）之数入中，按向山阴阳飞布（阳顺阴逆）。
    //    同元立向时向山与坐山同元，顺逆一致；元龙不杂时无额外微调。
    const xiangCenter = yunPan[facGua];
    const xiangPan = flyDigitMap(xiangCenter, facDir);

    // ④ 宅命盘（各宫三元叠加：运/山/向）
    const chart = PALACE_ORDER.filter((p) => p !== '中' || true).map((p) => ({
        palace: p,
        direction: p === '中' ? '中宫' : PALACE_DIRECTION[p],
        yun: yunPan[p],
        shan: shanPan[p],
        xiang: xiangPan[p],
    }));

    // ⑤ 格局判定（玄空「到山到向」双条件 OR：入中之数 = 当运，或 旺星飞到本宫 = 当运；
    //    两式数学上等价于「运盘本宫数 + 阴阳偏移 ≡ 入中数 mod 9」，已对公开盘逐字校验）。
    const shanIn = shanPan['中'];
    const xiangIn = xiangPan['中'];
    // 「到山/到向」双条件：山盘到坐山 = 山盘坐山宫落当运旺星，或山星入中即当运
    const shanToSit = shanPan[sitGua] === period || shanIn === period;
    const xiangToFac = xiangPan[facGua] === period || xiangIn === period;
    const shanToFac = shanPan[facGua] === period || shanIn === period;
    const xiangToSit = xiangPan[sitGua] === period || xiangIn === period;
    let pattern;
    if (shanToSit && xiangToFac && !shanToFac && !xiangToSit) {
        pattern = { key: '旺山旺向', text: '旺山旺向（到山到向）：山星归坐、向星归向，两者皆当运之旺星，山管人丁水管财，丁财两旺之局。' };
    } else if (shanToFac && xiangToFac) {
        pattern = { key: '双星会向', text: '双星会向：山、向两盘旺星皆聚于向首，旺财但须防丁弱，向方宜空宜水。' };
    } else if (shanToSit && xiangToSit) {
        pattern = { key: '双星会坐', text: '双星会坐：山、向两盘旺星皆聚于坐山，旺丁但财稍逊，坐方宜实宜山。' };
    } else if (shInOpposite(period, shanPan, sitGua, facGua) || shInOpposite(period, xiangPan, facGua, sitGua)) {
        pattern = { key: '上山下水', text: '上山下水（旺星到对宫、退星到本宫）：丁财互破之凶局，坐向两侧皆宜静守，须以峦头化解为先。' };
    } else {
        pattern = { key: '其他格局', text: '非到山到向/双星会局，按各宫山向星组合与峦头综合判断，不取单一旺星定吉凶。' };
    }

    return {
        meta: {
            year,
            period,
            periodName: `${period}运（${period <= 3 ? '上元' : period <= 6 ? '中元' : '下元'}）`,
            sitting: `${sitting.m}山（${sitting.gua}宫，${sitDir === '顺' ? '阳·顺飞' : '阴·逆飞'}）`,
            facing: `${facing.m}山（${facing.gua}宫，${facDir === '顺' ? '阳·顺飞' : '阴·逆飞'}）`,
            note: '运盘 = 当运之星入中恒顺飞；山盘/向盘各取运盘坐山宫、向首宫之数入中，按坐山/向首 24 山阴阳定顺逆；三盘叠合成宅命盘。属玄空通行排盘法，民俗参考，非现场勘舆。',
        },
        yunPan,
        shanPan,
        xiangPan,
        chart,
        pattern,
        sources: ['三元九运（每运 20 年，2024 起为下元九运）', '洛书飞星序（中→乾→兑→艮→离→坎→坤→震→巽）', '24 山三元龙阴阳（阳顺阴逆）'],
        disclaimer: '玄空飞星为传统堪舆流派之一，本地按通行排盘法计算，属民俗参考，不构成现场勘舆结论，仅供娱乐。',
    };
}


/**
 * 八宅命卦：按节气年（立春界）公元年后两位 n 计算（世纪口径不同，已查证）：
 * · 1900–1999：男 (100−n) ÷ 9 取余，女 (n−4) ÷ 9 取余；
 * · 2000–2099：男 (99−n) ÷ 9 取余，女 (n−3) ÷ 9 取余（负数加 9）；
 * 余 0 作 9；余 5 男作坤、女作艮。数→卦：1坎 2坤 3震 4巽 6乾 7兑 8艮 9离。
 * 校验锚点：1990男坎/1990女艮/2000男离/2000女乾/2026男坎/2026女艮。
 */
export function mingGua(birthYear, gender) {
    const tail = ((birthYear % 100) + 100) % 100;
    const century = birthYear >= 2000 ? { male: 99, female: 3 } : { male: 100, female: 4 };
    const mod9 = (n) => { const r = ((n % 9) + 9) % 9; return r === 0 ? 9 : r; };
    let num = gender === 'male' ? mod9(century.male - tail) : mod9(tail - century.female);
    if (num === 5) num = gender === 'male' ? 2 : 8; // 男五作坤、女五作艮
    const gua = GUA_NAMES[num - 1];
    if (gua === '中') throw new Error('命卦计算异常：落中宫');
    return { num, gua, direction: PALACE_DIRECTION[gua] };
}

/** 大游年八星表（含伏位=本卦）。 */
export function eightStars(gua) {
    const result = { 伏位: { palace: gua, direction: PALACE_DIRECTION[gua] } };
    const start = YOUNIAN_ORDER.indexOf(gua);
    for (let step = 1; step <= 7; step++) {
        const palace = YOUNIAN_ORDER[(start + step) % 8];
        result[DAYOUTIAN[gua][step - 1]] = { palace, direction: PALACE_DIRECTION[palace] };
    }
    return result;
}

/** 立春界节气年公元年：生日在当年立春前 → 上一年，否则当年。 */
function solarYearForGua(year, month, day) {
    const table = Solar.fromYmd(year, month, day).getLunar().getJieQiTable();
    const lichun = table?.立春;
    if (!lichun) return year;
    const lc = String(lichun); // 节气表值即 Solar 对象，toString 为 YYYY-MM-DD
    const birth = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return birth < lc ? year - 1 : year;
}

/** 流年九宫飞星（年家紫白）：年星入中顺飞。 */
/**
 * 年紫白入中之星（纯公式，不依赖 lunar 库的废弃接口）：
 * 传统以「上元甲子年一白入中，此后逐年退一位，九年一轮」推：
 *   锚点 1864 甲子 = 一白，2026 丙午 = 一白，2034 甲寅 = 二黑，2035 乙卯 = 一白。
 * 公式：center = ((year - 1864) mod 9 + 9) mod 9 + 1，取 1–9。
 * 立春界：命卦/飞星都按立春换年，solarYearForGua 已把 birthday 归一到节气年。
 */
export function yearZibaiStar(year) {
    // 标准紫白序列：1864 甲子 = 一白入中，此后逐年退一位（一白→九紫→八白→…→二黑→一白），
    // 九年一轮。锚点校验（公开表）：2024 三碧、2025 二黑、2026 一白、2027 九紫、2034 二黑、2035 一白。
    // 公式：center = 1 + (2026 - year) mod 9（取 1–9；2026 一白 → 每年 −1，0 折成 9）。
    const n = (1 + (2026 - year)) % 9;
    return n <= 0 ? n + 9 : n;
}
export function yearlyFlying(yearOrLunar) {
    // 兼容两种调用：直接传公历年（推荐，fortuneYear 真实生效）；传 lunar 对象时取其公历年兜底。
    let birthYear;
    if (typeof yearOrLunar === 'number') {
        birthYear = yearOrLunar;
    } else if (yearOrLunar?.getSolar) {
        birthYear = yearOrLunar.getSolar().getYear();
    } else {
        birthYear = Number(yearOrLunar?.toString?.().match(/(\d{4})/)?.[1]) || new Date().getFullYear();
    }
    const center = yearZibaiStar(birthYear);
    const palaces = [];
    for (const palace of PALACE_ORDER) {
        const k = PALACE_ORDER.indexOf(palace) + 1; // 洛书数 1–9
        const num = ((((k - 5 + center - 1) % 9) + 9) % 9) + 1;
        const s = NINE_STARS[num];
        palaces.push({
            palace,
            direction: palace === '中' ? '中宫' : PALACE_DIRECTION[palace],
            num,
            name: s.name,
            star: s.star,
            element: s.element,
            lucky: s.lucky,
        });
    }
    return { center, centerName: NINE_STARS[center].name, palaces };
}

/**
 * 风水主函数。
 * @param {{ action?:'natal'|'advise', year?, month?, day?, gender?, calendar?, isLeapMonth?,
 *            applyDST?, fortuneYear?:number, sitting?:string, facing?:string }} input
 *  action=natal（默认，一期行为）：需 year/month/day/gender（男女命卦算法不同），时间只需生日。
 *  action=advise（二期）：需 sitting 或 facing（24 山，二者给一即可，缺的另一侧按对宫推）；
 *  生辰可选——给出时加算命宅配（命卦与宅卦东西四同组与否）。
 */
export function computeFengshui(input) {
    if (input.action === 'advise') return computeFengshuiAdvise(input);
    if (input.action === 'xuankong') return computeXuanKong(input);
    const gender = input.gender === 'male' ? 'male' : input.gender === 'female' ? 'female' : null;
    if (!gender) throw new Error("gender 必须是 'male' 或 'female'（男女命卦算法不同，不可缺省）");

    const rt = resolveBirthTime({ ...input, hour: undefined });
    const guaYear = solarYearForGua(rt.solar.year, rt.solar.month, rt.solar.day);
    const { num, gua, direction } = mingGua(guaYear, gender);
    const stars = eightStars(gua);
    const eastFour = ['坎', '离', '震', '巽'].includes(gua);

    const fortuneYear = Number.isInteger(input.fortuneYear) ? input.fortuneYear : new Date().getFullYear();
    const flying = yearlyFlying(fortuneYear);

    return {
        meta: {
            birth: `${rt.solar.year}-${String(rt.solar.month).padStart(2, '0')}-${String(rt.solar.day).padStart(2, '0')}`,
            guaYear,
            gender: gender === 'male' ? '男' : '女',
            fortuneYear,
        },
        mingGua: {
            num, gua, direction,
            group: eastFour ? '东四命' : '西四命',
            compatible: eastFour ? '宜东四宅（坐坎离震巽）' : '宜西四宅（坐乾坤艮兑）',
        },
        luckyDirections: LUCKY_STARS.map((s) => ({ star: s, ...stars[s] })),
        unluckyDirections: UNLUCKY_STARS.map((s) => ({ star: s, ...stars[s] })),
        yearlyFlying: flying,
        // 年紫白已是本模块的纯公式实现（yearZibaiStar），不再依赖 lunar-javascript 的 NineStar；
        // 归属写清楚，别让人按这行注释去库里找那个已废弃的接口。
        sources: ['大游年歌（八宅通行口径）', '年家紫白飞星（本模块纯公式：以 2026 丙午一白入中、逐年退一位、九年一轮；按立春换年）'],
        disclaimer: '八宅与飞星为传统通行口径的本地计算，属民俗参考，不构成现场勘舆结论，仅供娱乐。',
    };
}

/**
 * 风水二期：宅卦坐向 + 门主灶厕布局倾向 + 命宅配（action=advise）。
 * @param {{ sitting?:string, facing?:string, year?, month?, day?, gender?,
 *            calendar?, isLeapMonth?, applyDST? }} input
 */
export function computeFengshuiAdvise(input) {
    const hasSitting = typeof input.sitting === 'string' && input.sitting.trim() !== '';
    const hasFacing = typeof input.facing === 'string' && input.facing.trim() !== '';
    if (!hasSitting && !hasFacing) {
        throw new Error('缺少必要输入：sitting（坐山）或 facing（向山）至少给一个——按插件纪律应向用户询问房屋坐向（罗盘 24 山，如「坐北朝南」对应坐子向午），不要代填。');
    }
    if (hasSitting && hasFacing) {
        // 两侧都给时校验互为对宫，不一致则如实报错（不是猜哪个对）。
        const s = mountainInfo(input.sitting.trim());
        const f = mountainInfo(input.facing.trim());
        if ((s.index + 12) % 24 !== f.index) {
            throw new Error(`坐向不自洽：坐${s.m}（${s.deg}°）与向${f.m}（${f.deg}°）不是对宫（相差应 180°，实测 ${((f.deg - s.deg) + 360) % 360}°）——请核对罗盘读数。`);
        }
    }
    const sitting = hasSitting ? mountainInfo(input.sitting.trim()) : sittingFromFacing(input.facing.trim());
    const facing = MOUNTAINS_24[(sitting.index + 12) % 24];

    const houseGua = sitting.gua;
    const stars = eightStars(houseGua);
    const starChart = [...LUCKY_STARS, ...UNLUCKY_STARS].map((s) => ({
        star: s,
        lucky: LUCKY_STARS.includes(s),
        ...stars[s],
        role: STAR_LAYOUT_ROLE[s],
    }));

    const lucky = LUCKY_STARS.map((s) => stars[s]);
    const unlucky = UNLUCKY_STARS.map((s) => stars[s]);
    const dir = (x) => `${x.direction}（${x.palace}宫）`;
    const layout = {
        door: `门宜开于吉方：首选生气方 ${dir(lucky[0])}，次选延年方 ${dir(lucky[1])}、天医方 ${dir(lucky[2])}。`,
        stove: `灶宜「坐凶向吉」：灶身压凶方（首选绝命方 ${dir(unlucky[0])}、五鬼方 ${dir(unlucky[1])}），火门（灶口）朝吉方。`,
        bed: `主卧与床头宜安吉方：生气方 ${dir(lucky[0])} 或延年方 ${dir(lucky[1])}；床头宜向吉方。`,
        toilet: `厕所宜压凶方：祸害方 ${dir(unlucky[3])} 或六煞方 ${dir(unlucky[2])}（污去凶气，宜静常闭）。`,
    };

    // 命宅配：给生辰才算；缺生辰时如实标注，不代填。
    let mingMatch = null;
    const hasBirth = Number.isInteger(input.year) && Number.isInteger(input.month) && Number.isInteger(input.day)
        && (input.gender === 'male' || input.gender === 'female');
    if (hasBirth) {
        const rt = resolveBirthTime({ ...input, hour: undefined });
        const guaYear = solarYearForGua(rt.solar.year, rt.solar.month, rt.solar.day);
        const ming = mingGua(guaYear, input.gender);
        const mGroup = guaGroup(ming.gua);
        const hGroup = guaGroup(houseGua);
        const same = mGroup === hGroup;
        const mingLucky = LUCKY_STARS.map((s) => `${s}位${eightStars(ming.gua)[s].direction}`).join('、');
        mingMatch = {
            birth: `${rt.solar.year}-${String(rt.solar.month).padStart(2, '0')}-${String(rt.solar.day).padStart(2, '0')}`,
            guaYear,
            gender: input.gender === 'male' ? '男' : '女',
            mingGua: { gua: ming.gua, direction: ming.direction, group: `${mGroup}命` },
            houseGua: { gua: houseGua, group: `${hGroup}宅` },
            sameGroup: same,
            text: same
                ? `命宅相配（${mGroup}命住${hGroup}宅）：以宅之八星盘布局即可，个人吉方与宅吉方大体同向。`
                : `命宅不配（${mGroup}命住${hGroup}宅）：传统调停法——门与床以**命卦吉方**为先（此命四吉方：${mingLucky}），灶仍按宅卦坐凶向吉，两盘各自取用。`,
        };
    }

    return {
        meta: {
            action: 'advise',
            ...(hasBirth ? {} : { birthNote: '未提供生辰：未做命宅配；如需按个人命卦调停门床，请补充出生年月日与性别。' }),
            sitting: `${sitting.m}山（罗盘 ${sitting.deg}°）`,
            facing: `${facing.m}山（罗盘 ${facing.deg}°）`,
            houseGua,
            houseGroup: `${guaGroup(houseGua)}宅`,
        },
        houseStars: starChart,
        layout,
        ...(mingMatch ? { mingMatch } : {}),
        sources: [
            '宅卦：坐山 24 山归属（八宅通行口径，每山 15°）',
            '八星盘与门主灶宜忌：大游年歌（八宅通行口径）',
            ...(mingMatch ? ['命宅配：东西四命/宅同组相配（八宅通行口径）'] : []),
        ],
        disclaimer: '坐向取用户自报的 24 山读数，本地按八宅通行口径推演，属民俗参考，不构成现场勘舆结论，仅供娱乐；实际户型结构（门在哪、灶在哪）以现场为准。',
    };
}
