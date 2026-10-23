// lib/engine/dst-cn.js — 中国夏令时（1986–1991）校正：纯本地确定性。
//
// 1986–1991 年中国实行夏令时，钟表拨快 1 小时：很多这六年的出生证时间
// 是「夏令时钟面时间」，不校正则时柱/时辰全错一档。
// 区间为通行口径：春季某日 02:00（拨快到 03:00）起，秋季某日 02:00（拨回 01:00）止，
// 含头不含尾（秋末 02:00–02:59 钟面回拨后实为第二次经过，此处不视作夏令时）。

/** 历年夏令时区间：[起始年月日, 结束年月日]（本地钟面时间，含头不含尾）。 */
export const DST_SPANS = {
    1986: ['1986-05-04', '1986-09-14'],
    1987: ['1987-04-12', '1987-09-13'],
    1988: ['1988-04-10', '1988-09-11'],
    1989: ['1989-04-16', '1989-09-17'],
    1990: ['1990-04-15', '1990-09-16'],
    1991: ['1991-04-14', '1991-09-15'],
};

const ORD = (y, m, d) => y * 10000 + m * 100 + d;

/**
 * 判断给定钟面时刻是否处于夏令时区间。
 * @param {{ year:number, month:number, day:number, hour:number, minute?:number }} t
 * @returns {boolean}
 */
export function inDstSpan({ year, month, day, hour, minute = 0 }) {
    const span = DST_SPANS[year];
    if (!span) return false;
    const [s, e] = span;
    const [sy, sm, sd] = s.split('-').map(Number);
    const [ey, em, ed] = e.split('-').map(Number);
    const n = ORD(year, month, day);
    if (n < ORD(sy, sm, sd) || n > ORD(ey, em, ed)) return false;
    if (n === ORD(sy, sm, sd) && hour * 60 + minute < 120) return false; // 起始日 02:00 起
    if (n === ORD(ey, em, ed) && hour * 60 + minute >= 120) return false; // 结束日 02:00 止
    return true;
}

/**
 * 夏令时校正：钟面时间减 1 小时（跨日进位）。
 * @returns {{ year, month, day, hour, minute, applied: boolean, note: string|null }}
 */
export function applyDstCorrection(t) {
    if (!inDstSpan(t)) {
        return { ...t, applied: false, note: null };
    }
    let { year, month, day, hour } = t;
    const minute = t.minute ?? 0;
    hour -= 1;
    if (hour < 0) {
        hour += 24;
        // 夏令时结束日最早为 9 月 11 日，day-1 不会跨月，无需日历回退
        day -= 1;
    }
    return {
        year, month, day, hour, minute,
        applied: true,
        note: `检出 ${year} 年夏令时（${DST_SPANS[year][0]}–${DST_SPANS[year][1]}）：出生钟面时间已减 1 小时校正`,
    };
}
