// lib/engine/birth-time.js — 出生时间统一解析管线：农历/公历 → 夏令时校正 → 真太阳时校正。
// bazi / ziwei / chenggu 三个工具共用，保证「时间口径」全插件一致。

import { applyDstCorrection } from './dst-cn.js';
import { applyTrueSolarTime } from './true-solar-time.js';
import { resolveDate } from './calendar.js';

/**
 * @param {{ year, month, day, hour?, minute?, calendar?:'solar'|'lunar', isLeapMonth?:boolean,
 *            applyDST?:boolean, city?:string, longitude?:number }} input
 * @param {{ requireHour?: boolean }} opts
 * @returns {{ solar: {year,month,day}, hour:number|null, minute:number, timeKnown:boolean, notes: string[] }}
 *  · notes 按序记录夏令时/真太阳时/晚子时等口径说明（由各工具追加自己的部分）
 *  · hour 为 null 表示时辰未知（requireHour=false 时放行，工具层决定如何降级）
 */
export function resolveBirthTime(input, opts = {}) {
    const timeKnown = Number.isInteger(input.hour);
    if (!timeKnown && opts.requireHour) {
        throw new Error('缺少必要输入：hour（0–23）。按插件纪律应向用户询问确认，不要代填猜测。');
    }
    const hour = timeKnown ? input.hour : null;
    const minute = Number.isInteger(input.minute) ? input.minute : 0;
    const notes = [];

    // ① 历法归一到公历（农历走 calendar.js：闰月与月天数都要查表，
    //    直接用 Lunar.fromYmd 会把 "wrong lunar year 2023 month -6" 这种英文错误甩给用户）
    const rd = resolveDate({
        year: input.year,
        month: input.month,
        day: input.day,
        calendar: input.calendar,
        isLeapMonth: input.isLeapMonth,
    });
    if (rd.note) notes.push(rd.note);
    const solarDate = rd.solar;

    if (!timeKnown) {
        return {
            solar: { year: solarDate.year, month: solarDate.month, day: solarDate.day },
            hour: null,
            minute: 0,
            timeKnown: false,
            notes,
        };
    }

    let t = { year: solarDate.year, month: solarDate.month, day: solarDate.day, hour, minute };

    // ② 夏令时校正（默认开启；applyDST=false 显式关闭）
    if (input.applyDST !== false) {
        const dst = applyDstCorrection(t);
        if (dst.applied) notes.push(dst.note);
        t = { year: dst.year, month: dst.month, day: dst.day, hour: dst.hour, minute: dst.minute };
    }

    // ③ 真太阳时校正（给了 city 或 longitude 才启用）
    // 判空必须用 != null：REST 路由的 numParam 缺参返回 null，而上层对「未传」可能给 undefined，
    // 二者曾经被 `!== undefined` 区分对待，导致「只传了 hour」这种默认用法静默进错分支。
    if (input.city != null || input.longitude != null) {
        const ts = applyTrueSolarTime({ ...t, city: input.city, longitude: input.longitude });
        notes.push(
            `真太阳时校正（${ts.source}，经度 ${ts.longitude}°）：钟面 ${String(t.hour).padStart(2, '0')}:${String(t.minute).padStart(2, '0')}`
            + ` → 真太阳时 ${String(ts.hour).padStart(2, '0')}:${String(ts.minute).padStart(2, '0')}（经度差+均时差共 ${ts.offsetMinutes >= 0 ? '+' : ''}${ts.offsetMinutes} 分钟，其中均时差 ${ts.eotMinutes >= 0 ? '+' : ''}${ts.eotMinutes}）`,
        );
        t = { year: ts.year, month: ts.month, day: ts.day, hour: ts.hour, minute: ts.minute };
    }

    return {
        solar: { year: t.year, month: t.month, day: t.day },
        hour: t.hour,
        minute: t.minute,
        timeKnown: true,
        notes,
    };
}
