// lib/tools/common.js — 工具层共享小助手（xuanji 工具无状态，不碰宿主 fs）。

import { resolveDate, resolveDateStr } from '../engine/calendar.js';

/** ContentBlock 文本块（工具 render 用）。 */
export function textBlock(text) {
    return [{ type: 'text', text }];
}

/** 全工具统一免责声明（渲染尾部 + 结构化字段都带）。 */
export const DISCLAIMER = '排盘数据由本地确定性引擎计算；解读属传统文化范畴，仅供娱乐参考，不构成医疗、投资、法律建议，重大决策请以现实依据为准。';

/** 统一的缺输入错误措辞（配合 systemPrompt 的「缺先问不猜」纪律）。 */
export function missingInput(label, hint) {
    return new Error(`缺少必要输入：${label}。${hint}——按插件纪律应向用户询问确认，不要代填猜测。`);
}

/**
 * 校验年月日（分历法）。
 *
 * 早先这里只按公历口径校验：给农历生日时会出两种错——
 *  · 误拒：农历 1990 年二月三十是合法日子，公历 2 月只有 28 天，直接被当成非法日期弹回去；
 *  · 误收：农历某月只有 29 天却填了 30，按公历校验放行，历法库再静默折算到下月初一，
 *    结果用户拿到的盘看着「有模有样」，其实是另一天。
 * 两种都比报错更糟：它们让用户以为自己填对了。
 */
export function assertYmd(input) {
    return resolveDate(input);
}

/**
 * 校验 'YYYY-MM-DD' 日期串并归一到公历日期串（带历法）。
 * @returns {{ date:string, note:string|null }}
 */
export function normalizeDate(str, calendar = 'solar', isLeapMonth = false) {
    return resolveDateStr(str, calendar, isLeapMonth);
}
