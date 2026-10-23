// lib/engine/chenggu.js — 袁天罡称骨确定性引擎（农历年/月/日/时辰四柱骨重求和）。
// 骨重表为通行本口径；批语按骨重分档给出白话解读（不冒充原版称骨歌诀原文）。

import lunarPkg from 'lunar-javascript';
import { ZHI, hourToZhi } from './tables.js';

const { Solar, Lunar } = lunarPkg;

/** 六十甲子年骨重（两+钱，单位：钱；如 12 = 一两二钱）。索引 = ((年-4)%60)。 */
export const YEAR_WEIGHT = [
    12, 9, 6, 7, 12, 9, 8, 7, 7, 12, // 甲子…癸酉
    15, 9, 16, 8, 8, 19, 12, 9, 8, 7, // 甲戌…癸未
    15, 15, 6, 16, 7, 7, 9, 12, 12, 7, // 甲申…癸巳
    15, 6, 5, 14, 14, 9, 9, 7, 9, 12, // 甲午…癸卯
    8, 7, 13, 5, 14, 5, 9, 9, 5, 7, // 甲辰…癸丑
    12, 8, 8, 6, 19, 6, 7, 15, 6, 6, // 甲寅…癸亥
];

/** 农历月骨重（正月…腊月，单位：钱）。 */
export const MONTH_WEIGHT = [6, 7, 18, 9, 5, 16, 9, 15, 17, 8, 9, 5];

/** 农历日骨重（初一…三十，单位：钱）。 */
export const DAY_WEIGHT = [
    5, 10, 8, 15, 10, 15, 8, 16, 8, 16,
    10, 9, 8, 16, 10, 8, 9, 16, 8, 9,
    12, 9, 8, 9, 15, 10, 8, 8, 17, 6,
];

/** 时辰骨重（按地支，单位：钱）。 */
export const HOUR_WEIGHT = { 子: 16, 丑: 6, 寅: 7, 卯: 10, 辰: 9, 巳: 16, 午: 10, 未: 8, 申: 8, 酉: 9, 戌: 6, 亥: 6 };

const LIANG_LABEL = ['一', '二', '三', '四', '五', '六', '七'];
const QIAN_LABEL = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];

/** 钱 → 「X两Y钱」（不足一两只写钱数，如「八钱」）。 */
function formatWeight(qian) {
    const liang = Math.floor(qian / 10);
    const rem = qian % 10;
    const liangPart = liang > 0 ? `${LIANG_LABEL[liang - 1]}两` : '';
    const remPart = rem > 0 ? `${QIAN_LABEL[rem - 1]}钱` : liang > 0 ? '整' : '零';
    return `${liangPart}${remPart}`;
}

/** 骨重分档批语（白话自撰，非原版歌诀；带出处标注供模型转述）。 */
function bandVerdict(qian) {
    if (qian >= 55) return { band: '上上', text: '骨重沉实，根基深厚，一生多逢贵人，谋事易成；守正持重，福泽可久。', source: '白话自撰（原版称骨歌诀可自行对照）' };
    if (qian >= 45) return { band: '上', text: '骨重充实，中年前后渐入佳境，事业家宅两旺；忌骄忌躁，善守即善成。', source: '白话自撰（原版称骨歌诀可自行对照）' };
    if (qian >= 35) return { band: '中上', text: '骨重适中，先劳后逸，凭本事立身；中年转运之象，稳扎稳打自见分晓。', source: '白话自撰（原版称骨歌诀可自行对照）' };
    if (qian >= 25) return { band: '中', text: '骨重平平，成败多靠自身经营；宜有一技傍身、广结善缘，勤则补拙。', source: '白话自撰（原版称骨歌诀可自行对照）' };
    return { band: '中下', text: '骨重较轻，早年多磨，凡事宜稳不宜急；积跬步以至千里，晚景反可安宁。', source: '白话自撰（原版称骨歌诀可自行对照）' };
}

/**
 * 称骨计算。
 * @param {{ year, month, day, hour?, hourZhi?, calendar?:'solar'|'lunar', isLeapMonth?:boolean }} input
 *  称骨以农历为准：calendar 为 solar 时先换算成农历；时辰给 hour（0–23）自动折算，
 *  或直接给 hourZhi（'子'…'亥'）。
 */
export function computeChenggu(input) {
    let lunar;
    if (input.calendar === 'solar') {
        lunar = Solar.fromYmd(input.year, input.month, input.day).getLunar();
    } else {
        const m = input.isLeapMonth ? -Math.abs(input.month) : input.month;
        lunar = Lunar.fromYmd(input.year, m, input.day);
    }

    const yearGz = lunar.getYearInGanZhi();
    const jiaziIdx = (((lunar.getYear() - 4) % 60) + 60) % 60;
    const lunarMonth = Math.abs(lunar.getMonth());
    const lunarDay = lunar.getDay();

    const hourZhi = input.hourZhi ?? hourToZhi(input.hour);
    if (!hourZhi || !ZHI.includes(hourZhi)) {
        throw new Error('时辰缺失：请给 hour（0–23）或 hourZhi（子丑寅…亥）——称骨四柱缺时辰不可算');
    }

    const wYear = YEAR_WEIGHT[jiaziIdx];
    const wMonth = MONTH_WEIGHT[lunarMonth - 1];
    const wDay = DAY_WEIGHT[lunarDay - 1];
    const wHour = HOUR_WEIGHT[hourZhi];
    if ([wYear, wMonth, wDay, wHour].some((x) => x === undefined)) {
        throw new Error(`称骨表缺项：年${wYear} 月${wMonth} 日${wDay} 时${wHour}`);
    }

    const total = wYear + wMonth + wDay + wHour;
    const verdict = bandVerdict(total);

    return {
        meta: {
            inputCalendar: input.calendar === 'solar' ? '公历' : '农历',
            solar: lunar.getSolar().toYmd(),
            lunar: `${lunar.toString()} ${hourZhi}时`,
            yearGanZhi: yearGz,
        },
        weights: {
            year: { qian: wYear, label: `${yearGz}年 ${formatWeight(wYear)}` },
            month: { qian: wMonth, label: `农历${lunarMonth}月 ${formatWeight(wMonth)}` },
            day: { qian: wDay, label: `农历${lunarDay}日 ${formatWeight(wDay)}` },
            hour: { qian: wHour, label: `${hourZhi}时 ${formatWeight(wHour)}` },
        },
        total: { qian: total, label: formatWeight(total) },
        verdict,
        disclaimer: '骨重为通行本称骨表口径；批语为白话自撰（非原版称骨歌诀原文，原版歌诀可自行对照）；仅供娱乐参考。',
    };
}
