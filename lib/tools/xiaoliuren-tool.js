// lib/tools/xiaoliuren-tool.js — xuanji_xiaoliuren：小六壬马前课（轻量快占，纯本地确定性）。

import { defineTool } from './define-tool.js';
import { textBlock, normalizeDate } from './common.js';
import { computeXiaoliuren } from '../engine/xiaoliuren.js';

export function defineXiaoliurenTool() {
    return defineTool({
        name: 'xuanji_xiaoliuren',
        description: [
            '小六壬（诸葛马前课，纯本地确定性）：轻量快占。mode=time 以当前时刻的农历月/日/时起课，',
            '需要指定某一天时必须同时给 hour（时辰是第三段掐指，缺了整天的落宫都一样）；mode=number 让用户',
            '随口报三个 1–99 的数起课。落宫六档：大安/留连/速喜/赤口/小吉/空亡，给吉凶与白话断语。',
            '适用：用户要快速占一下、报数问事。比梅花轻量，但口径粗——用户要正经分析时引导改用 xuanji_meihua。',
        ].join(''),
        parameters: {
            mode: { type: 'string', required: true, enum: ['time', 'number'], description: 'time=按时辰起课；number=报数起课。' },
            question: { type: 'string', description: '所问何事（建议先问清再起课）。' },
            date: { type: 'string', description: 'mode=time：日期 YYYY-MM-DD（calendar=solar 为公历；lunar 为农历），缺省今天；给了 date 必须同时给 hour。' },
            calendar: { type: 'string', enum: ['solar', 'lunar'], description: 'mode=time 且给了 date 时：输入历法，solar=公历（默认），lunar=农历。' },
            isLeapMonth: { type: 'boolean', description: 'calendar=lunar 时：是否闰月。' },
            hour: { type: 'integer', description: 'mode=time：小时 0–23，缺省取当前时刻；与 date 成对使用。' },
            num1: { type: 'integer', description: 'mode=number：第一个数（1–99，月位）。' },
            num2: { type: 'integer', description: 'mode=number：第二个数（1–99，日位）。' },
            num3: { type: 'integer', description: 'mode=number：第三个数（1–99，时位）。' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: true,
                properties: {
                    meta: { type: 'object', additionalProperties: true },
                    steps: { type: 'array', items: { type: 'string' } },
                    result: { type: 'object', additionalProperties: true },
                    sources: { type: 'array', items: { type: 'string' } },
                    disclaimer: { type: 'string' },
                },
            },
        },
        isConcurrencySafe: true,
        async execute(args) {
            // 小六壬掐指用的是农历月日，但用户报的可能是农历日期——先归一到公历，由引擎再转回农历。
            const { date } = args?.date
                ? normalizeDate(args.date, args.calendar, args.isLeapMonth)
                : { date: undefined };
            return computeXiaoliuren({ ...args, date });
        },
        render: (_args, v) => {
            const L = [];
            L.push(`【小六壬·${v.meta.mode}】${v.meta.question ? `所问：${v.meta.question}` : ''}`.trim());
            L.push(`起课依据：${v.meta.originText}`);
            L.push(`掐指三步：${v.steps.join(' → ')}`);
            L.push('');
            L.push(`落宫：${v.result.palace}（${v.result.luck}）`);
            L.push(`断语：${v.result.text}`);
            L.push('');
            L.push(`口径出处：${v.sources.join('；')}`);
            L.push(v.disclaimer);
            return textBlock(L.join('\n'));
        },
    });
}
