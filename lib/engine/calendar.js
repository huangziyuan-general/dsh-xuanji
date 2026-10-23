// lib/engine/calendar.js — 历法归一：公历 / 农历（含闰月）互转与分历法校验。
//
// 为什么要有这个文件：早先全插件只有一个口径——「输入一律按公历」。
// 但农历生日用户占相当比例（老人报生日几乎只报农历），同一个 1990-08-16，
// 公历是庚午年七月廿七，农历是庚午年八月十六——四柱里月柱直接差一位，
// 整个盘从头错到尾，而旧实现连个提示都没有。
//
// 关键事实（实测 lunar-javascript 1.7.3，勿凭记忆改）：
//  · LunarYear.fromYear(y).getLeapMonth() → 闰月序号，0 表示该年无闰月（2023=2、2025=6、2026=0）
//  · LunarMonth.fromYm(y, m) → 月不存在时返回 null（闰月传负数，如 闰六月 = -6）
//  · Lunar.fromYmd(y, m, d) 对非法月/日会抛英文错误（"wrong lunar year 2023 month -6"），
//    英文不能给用户看，所以校验必须自己做一遍，把错误换成中文并给出该月实际天数
//  · Solar.fromYmd(1990,2,30) 不抛错、原样返回 1990-02-30 —— 公历侧必须自己验天数

import lunarPkg from 'lunar-javascript';

const { Solar, Lunar, LunarMonth, LunarYear } = lunarPkg;

/** 历法取值与中文标签（工具参数 enum、渲染文案、错误提示共用一份）。 */
export const CALENDAR_LABEL = { solar: '公历', lunar: '农历' };

/** 农历月序的中文名（渲染用）。 */
const MONTH_TEXT = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];

/**
 * 该农历年的闰月序号；0 = 该年无闰月。
 * @param {number} year 农历年
 * @returns {number}
 */
export function lunarLeapMonth(year) {
    try {
        return LunarYear.fromYear(year).getLeapMonth() || 0;
    } catch {
        return 0;
    }
}

/**
 * 农历某月的天数（29 或 30）；月份不存在（含该年没有这个闰月）返回 null。
 * @param {number} year 农历年
 * @param {number} month 1–12
 * @param {boolean} isLeap 是否闰月
 */
export function lunarMonthDays(year, month, isLeap = false) {
    const m = isLeap ? -Math.abs(month) : month;
    try {
        const lm = LunarMonth.fromYm(year, m);
        return lm ? lm.getDayCount() : null;
    } catch {
        return null;
    }
}

/** 农历月中文名，如「闰六月」「八月」。 */
export function lunarMonthText(month, isLeap = false) {
    const base = MONTH_TEXT[month - 1] ?? `${month}`;
    return `${isLeap ? '闰' : ''}${base}月`;
}

/** 公历某月天数（自己算，不信任 Solar.fromYmd：它接受 1990-02-30）。 */
export function solarMonthDays(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * 分历法校验年月日 → 一律归一到公历日期。
 *
 * @param {{ year:number, month:number, day:number, calendar?:'solar'|'lunar',
 *           isLeapMonth?:boolean }} input
 * @returns {{ year, month, day, calendar:'solar'|'lunar', isLeapMonth:boolean,
 *            solar:{year,month,day}, note:string|null }}
 *  · 返回里的 year/month/day 是**用户原始输入**（渲染要原样回显，不然用户以为被改了）
 *  · solar 是换算后的公历日期（引擎一律吃公历）
 *  · note 是需要告知用户的口径说明（闰月、跨公历年等），没有则为 null
 */
export function resolveDate(input) {
    const { year, month, day } = input;
    if (!Number.isInteger(year) || year < 1 || year > 9999) throw new Error('year 必须是 1–9999 的整数');
    if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('month 必须是 1–12 的整数');
    if (!Number.isInteger(day) || day < 1 || day > 31) throw new Error('day 必须是 1–31 的整数');

    const calendar = input.calendar === 'lunar' ? 'lunar' : 'solar';
    const isLeap = calendar === 'lunar' && input.isLeapMonth === true;

    if (calendar === 'solar') {
        const dim = solarMonthDays(year, month);
        if (day > dim) {
            throw new Error(`非法日期：${year} 年 ${month} 月没有 ${day} 日（该月只有 ${dim} 天）——请核对后重试，不要让我猜`);
        }
        return {
            year, month, day, calendar, isLeapMonth: false,
            solar: { year, month, day },
            note: null,
        };
    }

    // ── 农历：月/日/闰月三重校验（lunar-javascript 的英文错误不能见人，全部自己翻）──
    if (isLeap) {
        const leap = lunarLeapMonth(year);
        if (leap === 0) {
            throw new Error(`农历 ${year} 年没有闰月，请取消「闰月」勾选后重填——闰月不是每年都有`);
        }
        if (leap !== month) {
            throw new Error(`农历 ${year} 年的闰月是闰${lunarMonthText(leap)}，不是闰${lunarMonthText(month)}——请核对月份`);
        }
    }
    const dim = lunarMonthDays(year, month, isLeap);
    if (dim === null) {
        throw new Error(`农历 ${year} 年没有${lunarMonthText(month, isLeap)}——请核对月份`);
    }
    if (day > dim) {
        throw new Error(`非法日期：农历 ${year} 年${lunarMonthText(month, isLeap)}只有 ${dim} 天，没有 ${day} 日——请核对后重试，不要让我猜`);
    }

    const solar = Lunar.fromYmd(year, isLeap ? -month : month, day).getSolar();
    const out = {
        year, month, day, calendar, isLeapMonth: isLeap,
        solar: { year: solar.getYear(), month: solar.getMonth(), day: solar.getDay() },
        note: null,
    };
    if (isLeap) {
        out.note = `闰月：${lunarMonthText(month, true)}（农历 ${year} 年闰月）——用户须确认是闰月而非平月，两者四柱不同`;
    }
    if (out.solar.year !== year) {
        out.note = `农历 ${year} 年${lunarMonthText(month, isLeap)}落在公历 ${out.solar.year} 年（农历年以正月初一为界，跨公历年属正常）`;
    }
    return out;
}

/**
 * 'YYYY-MM-DD' 字符串日期 → 公历 'YYYY-MM-DD'（带历法归一）。
 * 面板/工具的 date 参数都走这里，避免各处自己 split('-') 而漏掉闰月与非法日。
 *
 * @param {string} str 日期串
 * @param {'solar'|'lunar'} calendar 输入历法
 * @param {boolean} isLeapMonth 农历闰月
 * @returns {{ date:string, note:string|null }} date 为归一化后的公历日期串
 */
export function resolveDateStr(str, calendar = 'solar', isLeapMonth = false) {
    const raw = String(str ?? '').trim();
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(raw);
    if (!m) {
        throw new Error(`日期格式请用 YYYY-MM-DD（如 2026-10-22）${calendar === 'lunar' ? '；农历输入同样按年-月-日填，闰月请勾「闰月」' : ''}`);
    }
    const r = resolveDate({
        year: Number(m[1]), month: Number(m[2]), day: Number(m[3]),
        calendar, isLeapMonth,
    });
    const pad = (n) => String(n).padStart(2, '0');
    return {
        date: `${r.solar.year}-${pad(r.solar.month)}-${pad(r.solar.day)}`,
        note: r.note,
    };
}

/** 公历日期 → 农历中文（如「一九九〇年八月十六」），渲染回显用。 */
export function solarToLunarText(year, month, day) {
    try {
        return Solar.fromYmd(year, month, day).getLunar().toString();
    } catch {
        return null;
    }
}
