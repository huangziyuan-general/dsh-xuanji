// lib/tools/star-tool.js — xuanji_star：星座档案 + 当日娱乐向基调（日期哈希确定性）。

import { defineTool } from './define-tool.js';
import { textBlock, DISCLAIMER, normalizeDate } from './common.js';
import { computeStar } from '../engine/star.js';

export function defineStarTool() {
    return defineTool({
        name: 'xuanji_star',
        description: [
            '星座运势（本地确定性）：给定公历日期（缺省今天），返回该日期的太阳星座档案（四象、守护星、性格',
            '关键词、契合星座）与当日四维基调（事业/感情/财运/健康 1–5 星 + 幸运色/幸运数字）。当日基调由日期',
            '哈希确定性生成——同一天、同一星座，结果永远一致（不是随机数，也不是模型编的）。纯娱乐向，解读时',
            '语气轻松即可，不要包装成命运断言。',
            '日历法：星座按太阳过宫，本质是公历（阳历）体系；date 默认按公历，calendar=lunar 时先换算成公历。',
        ].join(''),
        parameters: {
            date: { type: 'string', description: '日期 YYYY-MM-DD（calendar=solar 为公历；lunar 为农历），缺省为今天。' },
            calendar: { type: 'string', enum: ['solar', 'lunar'], description: '输入历法：solar=公历（默认），lunar=农历。' },
            isLeapMonth: { type: 'boolean', description: 'calendar=lunar 时：是否闰月。' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: true,
                properties: {
                    meta: { type: 'object', additionalProperties: true },
                    sign: { type: 'object', additionalProperties: true },
                    daily: { type: 'object', additionalProperties: true },
                    disclaimer: { type: 'string' },
                },
            },
        },
        isConcurrencySafe: true,
        async execute(args) {
            // 星座看太阳过宫，本质是阳历体系：给农历日期必须先换成公历，否则整个星座都错。
            const { date } = args?.date ? normalizeDate(args.date, args.calendar, args.isLeapMonth) : { date: undefined };
            const result = computeStar(date);
            if (args?.calendar === 'lunar' && args?.date) {
                result.meta.inputCalendar = '农历';
                result.meta.inputDate = args.date;
            }
            return result;
        },
        render: (_args, v) => {
            const L = [];
            L.push(`【星座·${v.sign.name}】${v.meta.date}｜${v.sign.range}`);
            L.push(`${v.sign.element}象｜守护星 ${v.sign.planet}｜关键词：${v.sign.keywords}｜契合：${v.sign.compatible}`);
            L.push('');
            L.push(`今日基调：${v.daily.tone}`);
            for (const d of v.daily.dims) {
                L.push(`· ${d.name}：${'★'.repeat(d.stars)}${'☆'.repeat(5 - d.stars)}　${d.text}`);
            }
            L.push(`幸运色：${v.daily.luckyColor}｜幸运数字：${v.daily.luckyNumber}`);
            L.push('');
            L.push(DISCLAIMER);
            return textBlock(L.join('\n'));
        },
    });
}
