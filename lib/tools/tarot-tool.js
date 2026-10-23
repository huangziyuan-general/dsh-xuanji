// lib/tools/tarot-tool.js — xuanji_tarot：每日塔罗 + 三牌阵（确定性抽牌，纯本地）。

import { defineTool } from './define-tool.js';
import { textBlock, normalizeDate } from './common.js';
import { computeTarot } from '../engine/tarot.js';

export function defineTarotTool() {
    return defineTool({
        name: 'xuanji_tarot',
        description: [
            '塔罗（纯本地确定性抽牌）：mode=daily 每日一牌（同日同牌同正逆位）；mode=three 三牌阵（过去/现在/未来），',
            '需先问清所问何事并传入 question（同一问题同一天结果可复现，换天可重抽）。22 张大阿卡纳 + 通行关键词',
            '白话释义。适用：用户点名塔罗、要抽牌、问每日指引。牌面不预示命运，解读以引导自省为主。',
        ].join(''),
        parameters: {
            mode: { type: 'string', required: true, enum: ['daily', 'three'], description: 'daily=每日一牌；three=三牌阵。' },
            question: { type: 'string', description: '所问何事（three 必填；daily 可省略）。' },
            date: { type: 'string', description: '抽牌日期 YYYY-MM-DD（calendar=solar 为公历；lunar 为农历），缺省今天。' },
            calendar: { type: 'string', enum: ['solar', 'lunar'], description: '输入历法：solar=公历（默认），lunar=农历。' },
            isLeapMonth: { type: 'boolean', description: 'calendar=lunar 时：是否闰月。' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: true,
                properties: {
                    meta: { type: 'object', additionalProperties: true },
                    card: { type: 'object', additionalProperties: true },
                    cards: { type: 'array', items: { type: 'object', additionalProperties: true } },
                    sources: { type: 'array', items: { type: 'string' } },
                    disclaimer: { type: 'string' },
                },
            },
        },
        isConcurrencySafe: true,
        async execute(args) {
            const { date } = args?.date
                ? normalizeDate(args.date, args.calendar, args.isLeapMonth)
                : { date: undefined };
            return computeTarot({ ...args, date });
        },
        render: (_args, v) => {
            const L = [];
            L.push(`【塔罗·${v.meta.mode === 'three' ? '三牌阵' : '每日一牌'}】${v.meta.date}${v.meta.question ? `｜所问：${v.meta.question}` : ''}`);
            L.push('');
            if (v.card) {
                L.push(`🂠 ${v.card.name}（${v.card.orientation}）`);
                L.push(`关键词：${v.card.keyword}`);
                L.push(`牌意：${v.card.text}`);
            } else {
                for (const c of v.cards) {
                    L.push(`· ${c.position}：${c.name}（${c.orientation}）——${c.keyword}｜${c.text}`);
                }
                L.push('');
                L.push('解读要求：三牌连成一条时间线讲（过去铺垫→当下处境→未来走向），落点放在「现在」这张牌的可行动建议上，末尾附免责声明。');
            }
            L.push('');
            L.push(`口径出处：${v.sources.join('；')}`);
            L.push(v.disclaimer);
            return textBlock(L.join('\n'));
        },
    });
}
