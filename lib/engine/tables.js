// lib/engine/tables.js — 命理共享表：天干地支、五行、藏干、十神、六十甲子、时辰。
// 纯数据 + 纯函数，零依赖零 IO；所有引擎（bazi/meihua/almanac/chenggu/star）共用。

/** 天干（序 0–9）。 */
export const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
/** 地支（序 0–11）。 */
export const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/** 天干五行：甲乙木 丙丁火 戊己土 庚辛金 壬癸水。 */
export const GAN_WUXING = ['木', '木', '火', '火', '土', '土', '金', '金', '水', '水'];
/** 天干阴阳：奇位阳干，偶位阴干。 */
export const GAN_YINYANG = ['阳', '阴', '阳', '阴', '阳', '阴', '阳', '阴', '阳', '阴'];

/** 地支五行（本气）：寅卯木 巳午火 申酉金 亥子水 辰戌丑未土。 */
export const ZHI_WUXING = ['水', '土', '木', '木', '土', '火', '火', '土', '金', '金', '土', '水'];

/** 地支藏干（本气在前）：子藏癸、丑藏己癸辛…… 依《渊海子平》通行口诀。 */
export const ZHI_CANGGAN = {
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

/** 五行相生：木→火→土→金→水→木。 */
export const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
/** 五行相克：木克土、土克水、水克火、火克金、金克木。 */
export const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };

const ELEMENT_ORDER = { 木: 0, 火: 1, 土: 2, 金: 3, 水: 4 };

/**
 * 十神：以日干为我，看另一天干与我五行的生克关系与阴阳同异。
 * 同我→比肩/劫财；我生→食神/伤官；我克→偏财/正财；克我→七杀/正官；生我→偏印/正印。
 * 同性（阴阳相同）取前者的偏类，异性取正类。
 */
export function tenGod(dayGan, otherGan) {
    const dEl = GAN_WUXING[GAN.indexOf(dayGan)];
    const oEl = GAN_WUXING[GAN.indexOf(otherGan)];
    const samePolarity = GAN_YINYANG[GAN.indexOf(dayGan)] === GAN_YINYANG[GAN.indexOf(otherGan)];
    const diff = (ELEMENT_ORDER[oEl] - ELEMENT_ORDER[dEl] + 5) % 5;
    switch (diff) {
        case 0: return samePolarity ? '比肩' : '劫财';
        case 1: return samePolarity ? '食神' : '伤官';
        case 2: return samePolarity ? '偏财' : '正财';
        case 3: return samePolarity ? '七杀' : '正官';
        case 4: return samePolarity ? '偏印' : '正印';
        default: return null;
    }
}

/** 六十甲子（甲子起）。 */
export const JIAZI = Array.from({ length: 60 }, (_, i) => GAN[i % 10] + ZHI[i % 12]);

/** 公历年份 → 干支（立春前的「_exact」口径不在此处理，此函数为通用年干支）。 */
export function yearGanZhi(year) {
    return JIAZI[(((year - 4) % 60) + 60) % 60];
}

/** 24 小时制小时 → 时辰地支：23:00–00:59 子时，每两小时一支。 */
export function hourToZhi(hour) {
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
    return ZHI[Math.floor(((hour + 1) % 24) / 2)];
}

/** 时辰地支 → 中文时段描述（如「子时 23:00–00:59」）。 */
export function zhiHourRange(zhi) {
    const i = ZHI.indexOf(zhi);
    const start = (i * 2 + 23) % 24;
    const end = (start + 1) % 24;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(start)}:00–${pad(end)}:59`;
}

/** 五行统计的中文汇总，如「金2 木3 水1 火1 土1」。 */
export function wuxingSummary(counts) {
    return ['金', '木', '水', '火', '土'].map((e) => `${e}${counts[e] ?? 0}`).join(' ');
}

/** 十二生肖（与地支一一对应，子鼠…亥猪）。 */
export const SHENGXIAO = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

/**
 * 干支旬空（每一柱自己的旬空，只取决于该柱干支在六十甲子中的位置，无历法口径分歧）：
 * 例：癸丑在第 50 位（甲辰旬）→ 空亡寅卯。
 * @param {string} ganZhi 如 '癸丑'
 * @returns {string} 如 '寅卯'
 */
export function xunKongOf(ganZhi) {
    const idx = JIAZI.indexOf(ganZhi);
    if (idx < 0) return '';
    const start = idx - (idx % 10);
    return ZHI[(start + 10) % 12] + ZHI[(start + 11) % 12];
}
