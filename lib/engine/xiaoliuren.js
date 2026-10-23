// lib/engine/xiaoliuren.js — 小六壬（诸葛马前课）确定性引擎：月/日/时（或报三数）掐指落宫。
// 六宫：大安、留连、速喜、赤口、小吉、空亡。口径为通行掌诀，断语为白话提炼。

import lunarPkg from 'lunar-javascript';
import { ZHI } from './tables.js';
import { lunarClock } from './calendar.js';

const { Solar } = lunarPkg;

/** 六宫定义：吉凶 + 断语（白话提炼自通行马前课口诀，非原文照录）。 */
export const PALACES = {
    大安: { luck: '吉', text: '事事昌顺，宜静守不宜妄动；所问之事根基稳，缓一缓更妥。' },
    留连: { luck: '凶', text: '事多牵扯反复，暗中有耗；宜守不宜进，防拖延与口舌。' },
    速喜: { luck: '吉', text: '喜事将至，行动宜快；所问之事三日内外见分晓。' },
    赤口: { luck: '凶', text: '口舌是非、官讼之象；宜谨言慎行，凡事留凭证。' },
    小吉: { luck: '吉', text: '小有助力，慢慢来能成；合作与人际有贵人。' },
    空亡: { luck: '凶', text: '落空之象，谋事多不成；宜停一停，改期再议。' },
};

export const PALACE_ORDER = ['大安', '留连', '速喜', '赤口', '小吉', '空亡'];

/** 数 → 落宫（1–6 循环，大安起）。 */
const pick = (n) => PALACE_ORDER[(((n - 1) % 6) + 6) % 6];

/**
 * 农历月/日/时序数（月份 1–12，日 1–30，时支 1–12）。
 * date 与 hour 必须成对给：小六壬是「月→日→时」三段掐指，第三段若缺，
 * 同一天任何时刻的落宫都会完全一样——那等于静默代填了一个时辰，违反「缺输入先问」纪律。
 */
function lunarNumbers(dateStr, hour) {
    const c = lunarClock(dateStr, hour, { requireHourWithDate: true });
    return {
        month: Math.abs(c.lunar.getMonth()),
        day: c.lunar.getDay(),
        hour: c.hourNum,
        lunarText: c.lunarText,
    };
}

/**
 * 小六壬主函数。
 * @param {{ mode:'time'|'number', date?:string, hour?:number, num1?:number, num2?:number, num3?:number, question?:string }} input
 *  · time：以（今天的）当前时刻或指定的 date+hour 起课——date 与 hour 必须同时给；
 *  · number：随口报三个数（1–99），依次按月/日/时位掐算。
 */
export function computeXiaoliuren(input) {
    const mode = input.mode === 'number' ? 'number' : 'time';
    let m, d, h, originText;

    if (mode === 'time') {
        const n = lunarNumbers(input.date, input.hour);
        m = n.month; d = n.day; h = n.hour;
        originText = `农历${n.lunarText}：月${m} → 日${d} → 时${h} 掐指落宫`;
    } else {
        const nums = [input.num1, input.num2, input.num3].map(Number);
        if (nums.some((x) => !Number.isInteger(x) || x < 1 || x > 99)) {
            throw new Error('报数起课需要三个 1–99 的正整数（随口报即可）——缺数请向用户索要，不要代填。');
        }
        [m, d, h] = nums;
        originText = `报数 ${m}、${d}、${h}：依次按月/日/时位掐指落宫`;
    }

    const p1 = pick(m);
    // 传统掌诀：从月落宫起，数到日；再从日落宫起，数到时。逐段累进：
    const p2b = pick(PALACE_ORDER.indexOf(p1) + 1 + d - 1);
    const p3 = pick(PALACE_ORDER.indexOf(p2b) + 1 + h - 1);

    const final = p3;
    const info = PALACES[final];

    return {
        meta: { mode: mode === 'time' ? '时间起课' : '报数起课', question: input.question ?? null, originText },
        steps: [p1, p2b, p3],
        result: {
            palace: final,
            luck: info.luck,
            text: info.text,
        },
        sources: ['掌诀口径：通行马前课（白话提炼，非原文照录）'],
        disclaimer: '小六壬为轻量快占，属民俗娱乐参考；重要事项请综合现实信息判断。',
    };
}
