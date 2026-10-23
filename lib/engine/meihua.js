// lib/engine/meihua.js — 梅花易数确定性引擎：时间起卦 / 报数起卦，体用生克断吉凶。
// 起卦数与卦象全部由本地算出；模型只解读，不得改动卦象事实。

import lunarPkg from 'lunar-javascript';
import { TRIGRAMS, TRIGRAM_ORDER, hexagramByLines } from './hexagrams.js';
import { ZHI, hourToZhi } from './tables.js';

const { Solar } = lunarPkg;

/** 先天卦数取经卦：1–8 → 乾兑离震巽坎艮坤（超出取模，0 视作 8）。 */
function trigramOfCount(n) {
    const k = ((n - 1) % 8 + 8) % 8;
    return TRIGRAM_ORDER[k];
}

/** 互卦：二三四爻为下卦，三四五爻为上卦（自下而上取 lines[1..3] 与 lines[2..4]）。 */
function huGua(lines) {
    return hexagramByLines([...lines.slice(1, 4), ...lines.slice(2, 5)]);
}

/** 变卦：翻转动爻。 */
function bianGua(lines, movingIdx) {
    const flipped = lines.slice();
    flipped[movingIdx] = flipped[movingIdx] === 1 ? 0 : 1;
    return hexagramByLines(flipped);
}

/** 体用生克断语：体卦为我，用卦为事。 */
function tiYongVerdict(tiWuxing, yongWuxing) {
    const SHENG = { 木: '火', 火: '土', 土: '金', 金: '水', 水: '木' };
    const KE = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
    const reverse = (map, v) => Object.entries(map).find(([, x]) => x === v)?.[0];
    if (tiWuxing === yongWuxing) return { relation: '比和', level: '吉', text: '体用比和，彼此同气，事多顺遂，百事可为。' };
    if (SHENG[yongWuxing] === tiWuxing) return { relation: '用生体', level: '大吉', text: '用生体，外力来助，贵人与资源主动靠近，宜乘势而进。' };
    if (KE[tiWuxing] === yongWuxing) return { relation: '体克用', level: '小吉', text: '体克用，主动权在我，费力但可控，稳步推进可成。' };
    if (SHENG[tiWuxing] === yongWuxing) return { relation: '体生用', level: '小凶', text: '体生用，耗泄自身，付出多而回报迟，防精力财力外流。' };
    if (KE[yongWuxing] === tiWuxing) return { relation: '用克体', level: '凶', text: '用克体，外力相迫，事多阻力，宜守不宜攻，先避其锋。' };
    return { relation: '未知', level: '平', text: '五行关系不明，慎断。' };
}

/** 时间起卦的农历要素：年支序（子1…亥12）、月数、日数、时支序。 */
function lunarNumbers(dateStr, hour) {
    const hourNum = Number.isInteger(hour) && hour >= 0 && hour <= 23
        ? ZHI.indexOf(hourToZhi(hour)) + 1
        : null;
    const solar = dateStr
        ? Solar.fromYmdHms(...dateStr.split('-').map(Number), Number.isInteger(hour) ? hour : 12, 0, 0)
        : Solar.fromDate(new Date());
    const lunar = solar.getLunar();
    return {
        yearNum: ZHI.indexOf(lunar.getYearZhi()) + 1,
        monthNum: Math.abs(lunar.getMonth()),
        dayNum: lunar.getDay(),
        hourNum: hourNum ?? ZHI.indexOf(lunar.getTimeZhi()) + 1,
        lunarText: `${lunar.toString()} ${lunar.getTimeZhi()}时`,
        solarText: solar.toYmd(),
    };
}

/**
 * 梅花易数起卦。
 * @param {{ mode:'time'|'number', date?:string, hour?:number, num1?:number, num2?:number,
 *            hourForNumber?:number, question?:string }} input
 *  · time：以（决策当刻或指定时刻）农历年月日时起卦，date 为公历 YYYY-MM-DD，hour 0–23 可选；
 *  · number：以两个报数起卦（前数上卦、后数下卦、和数加时辰取动爻）。
 */
export function computeMeihua(input) {
    const mode = input.mode === 'number' ? 'number' : 'time';
    let upperNum, lowerNum, movingNum, originText;

    if (mode === 'time') {
        const n = lunarNumbers(input.date, input.hour);
        const sum1 = n.yearNum + n.monthNum + n.dayNum;
        upperNum = sum1;
        lowerNum = sum1 + n.hourNum;
        movingNum = lowerNum;
        originText = `${n.solarText}（${n.lunarText}）：年${n.yearNum}+月${n.monthNum}+日${n.dayNum}=${sum1} → 上卦；加时${n.hourNum} → 下卦与动爻`;
    } else {
        const n1 = Number(input.num1);
        const n2 = Number(input.num2);
        if (!Number.isInteger(n1) || !Number.isInteger(n2) || n1 <= 0 || n2 <= 0) {
            throw new Error('报数起卦需要两个正整数 num1、num2（随口报出的两位数即可）');
        }
        // 报数起卦的动爻第三项取「时辰的地支序」（子1…亥12），与时间起卦的 lunarNumbers 同源。
        // 早先误用 (小时+1)%24，除 0/1 时外全部错位（如 23 时算出 0、应为 1），会连带错到变卦与体用吉凶。
        const hourNum = Number.isInteger(input.hourForNumber) && input.hourForNumber >= 0 && input.hourForNumber <= 23
            ? ZHI.indexOf(hourToZhi(input.hourForNumber)) + 1
            : ZHI.indexOf(hourToZhi(new Date().getHours())) + 1;
        upperNum = n1;
        lowerNum = n2;
        movingNum = n1 + n2 + hourNum;
        originText = `报数 ${n1}、${n2}：前数上卦，后数下卦，${n1}+${n2}+时辰${hourNum} → 动爻`;
    }

    const upper = trigramOfCount(upperNum);
    const lower = trigramOfCount(lowerNum);
    const movingYao = ((movingNum - 1) % 6) + 1; // 1–6，自下而上

    const lines = [...TRIGRAMS[lower].lines, ...TRIGRAMS[upper].lines];
    const ben = hexagramByLines(lines);
    const hu = huGua(lines);
    const bian = bianGua(lines, movingYao - 1);

    // 体用：动爻所在之卦为「用」，无动爻之卦为「体」。
    const movingInUpper = movingYao > 3;
    const tiName = movingInUpper ? lower : upper;
    const yongName = movingInUpper ? upper : lower;
    const ti = TRIGRAMS[tiName];
    const yong = TRIGRAMS[yongName];
    const verdict = tiYongVerdict(ti.wuxing, yong.wuxing);

    return {
        meta: { mode: mode === 'time' ? '时间起卦' : '报数起卦', question: input.question ?? null, originText },
        gua: {
            ben: { ...ben },
            hu: hu ? { ...hu } : null,
            bian: bian ? { ...bian } : null,
            movingYao,
            movingWen: ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'][movingYao - 1],
        },
        tiYong: {
            ti: { name: tiName, symbol: ti.symbol, wuxing: ti.wuxing, nature: ti.nature, position: movingInUpper ? '下卦（内）' : '上卦（外）' },
            yong: { name: yongName, symbol: yong.symbol, wuxing: yong.wuxing, nature: yong.nature, position: movingInUpper ? '上卦（外）' : '下卦（内）' },
            ...verdict,
        },
        disclaimer: '卦象与生克为本地确定性计算；断语属梅花易数传统框架，仅供娱乐参考。',
    };
}

