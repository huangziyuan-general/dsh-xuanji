// lib/tools/numerology-tool.js — xuanji_numerology：生命数字（西方数字学，纯本地确定性）。

import { defineTool } from './define-tool.js';
import { textBlock, DISCLAIMER, assertYmd } from './common.js';
import { computeNumerology } from '../engine/numerology.js';
import { lunarMonthText } from '../engine/calendar.js';

export function defineNumerologyTool() {
    return defineTool({
        name: 'xuanji_numerology',
        description: [
            '生命数字（纯本地确定性计算，西方数字学体系）：给出生年月日，算生命路径数、生日数、态度数',
            '（11/22/33 主数保留），每个数给白话数义（倾向与课题）。与八字/紫微完全不同口径，用户混问时要提醒',
            '两套不可互相印证。适用：用户点名「生命数字」「生命灵数」「数字命理」。',
            '日历法：默认按公历生日；calendar=lunar 时先换算成公历再算（西方体系以公历日期为准，',
            '农历生日必须换算，否则整组数字全错）。',
        ].join(''),
        parameters: {
            year: { type: 'integer', required: true, description: '出生年份（calendar=solar 为公历年；lunar 为农历年）。' },
            month: { type: 'integer', required: true, description: '出生月份（calendar=solar 为公历月；lunar 为农历月）。' },
            day: { type: 'integer', required: true, description: '出生日。' },
            calendar: { type: 'string', enum: ['solar', 'lunar'], description: '输入历法：solar=公历（默认），lunar=农历。' },
            isLeapMonth: { type: 'boolean', description: 'calendar=lunar 时：是否闰月。' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: true,
                properties: {
                    meta: { type: 'object', additionalProperties: true },
                    numbers: { type: 'array', items: { type: 'object', additionalProperties: true } },
                    notes: { type: 'array', items: { type: 'string' } },
                    sources: { type: 'array', items: { type: 'string' } },
                    disclaimer: { type: 'string' },
                },
            },
        },
        isConcurrencySafe: true,
        async execute(args) {
            const rd = assertYmd(args);
            const result = computeNumerology({
                year: rd.solar.year, month: rd.solar.month, day: rd.solar.day,
            });
            result.meta.inputCalendar = rd.calendar === 'lunar' ? '农历' : '公历';
            // 西方体系按公历日期算：农历生日必须换算，否则整组数字全错——
            // 换算过的要在结果里写明，用户才有得核对。
            if (rd.calendar === 'lunar') {
                const pad = (n) => String(n).padStart(2, '0');
                result.notes = [
                    ...(result.notes ?? []),
                    `农历 ${rd.year} 年${lunarMonthText(rd.month, rd.isLeapMonth)}${rd.day} 日`
                        + ` → 公历 ${rd.solar.year}-${pad(rd.solar.month)}-${pad(rd.solar.day)}：`
                        + '生命数字是西方体系，一律按公历生日计算',
                ];
            }
            return result;
        },
        render: (_args, v) => {
            const L = [];
            L.push(`【生命数字】${v.meta.birth}（西方数字学体系${v.meta.inputCalendar ? ` · ${v.meta.inputCalendar}输入` : ''}）`);
            L.push('');
            for (const n of v.numbers) {
                L.push(`· ${n.name}：${n.number}${n.master ? '（主数）' : ''}——${n.meaning}`);
                L.push(`  计算式：${n.formula}`);
            }
            L.push('');
            for (const note of v.notes) L.push(`※ ${note}`);
            L.push('');
            L.push(`口径出处：${v.sources.join('；')}`);
            L.push(DISCLAIMER);
            return textBlock(L.join('\n'));
        },
    });
}
