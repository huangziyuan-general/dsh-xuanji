// lib/tools/chenggu-tool.js — xuanji_chenggu：袁天罡称骨（农历四柱骨重求和，纯本地确定性）。

import { defineTool } from './define-tool.js';
import { textBlock, DISCLAIMER, assertYmd } from './common.js';
import { computeChenggu } from '../engine/chenggu.js';
import { resolveBirthTime } from '../engine/birth-time.js';

export function defineChengguTool() {
    return defineTool({
        name: 'xuanji_chenggu',
        description: [
            '袁天罡称骨算命（纯本地确定性计算）：按农历出生年/月/日/时辰查骨重表求和（如三两九钱），',
            '并按骨重分档给白话批语。calendar=solar 时先换算成农历（自动处理春节分界）；时辰必填——',
            '给 hour（0–23）自动折算时辰，或直接给 hourZhi（子丑寅…亥）。批语为白话自撰而非原版歌诀，',
            '解读时不要冒充原文歌诀。',
        ].join(''),
        parameters: {
            year: { type: 'integer', required: true, description: '出生年份。' },
            month: { type: 'integer', required: true, description: '出生月份（calendar=solar 为公历月；lunar 为农历月）。' },
            day: { type: 'integer', required: true, description: '出生日。' },
            hour: { type: 'integer', description: '出生小时（0–23），自动折算时辰；与 hourZhi 二选一（称骨必填时辰）。' },
            hourZhi: { type: 'string', enum: ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'], description: '时辰地支；与 hour 二选一。' },
            calendar: { type: 'string', enum: ['solar', 'lunar'], description: '输入历法：solar=公历（默认，自动转农历），lunar=农历。' },
            isLeapMonth: { type: 'boolean', description: 'calendar=lunar 时：是否闰月。' },
            applyDST: { type: 'boolean', description: '是否自动校正 1986–1991 中国夏令时（默认 true）。' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: true,
                properties: {
                    meta: { type: 'object', additionalProperties: true },
                    weights: { type: 'object', additionalProperties: true },
                    total: { type: 'object', additionalProperties: true },
                    verdict: { type: 'object', additionalProperties: true },
                    disclaimer: { type: 'string' },
                },
            },
        },
        isConcurrencySafe: true,
        async execute(args) {
            assertYmd(args);
            if (args.hour === undefined && args.hourZhi === undefined) {
                throw new Error('缺少必要输入：时辰。请提供 hour（0–23）或 hourZhi（子…亥）——称骨缺时辰不可算，应向用户询问，不要代填。');
            }
            // 直接给 hourZhi 时不做时间管线（没有钟面时间可校正）；给 hour 则走统一时间管线（含夏令时）
            if (args.hourZhi !== undefined && args.hour === undefined) {
                const direct = computeChenggu(args);
                direct.meta.notes = [
                    '时辰以 hourZhi 直传为准：未做夏令时/真太阳时校正（无钟面时间可校正）；与 xuanji_bazi 给 city 排盘的时辰可能不同，属口径差异',
                ];
                return direct;
            }
            const rt = resolveBirthTime({ ...args, hour: args.hour }, { requireHour: true });
            const result = computeChenggu({
                year: rt.solar.year, month: rt.solar.month, day: rt.solar.day,
                hour: rt.hour, calendar: 'solar',
            });
            if (rt.notes.length > 0) result.meta.notes = rt.notes;
            return result;
        },
        render: (_args, v) => {
            const L = [];
            L.push(`【袁天罡称骨】${v.meta.solar}｜农历 ${v.meta.lunar}｜${v.meta.yearGanZhi}年`);
            for (const note of v.meta.notes ?? []) L.push(`ℹ ${note}`);
            L.push('');
            L.push(`骨重明细：`);
            for (const k of ['year', 'month', 'day', 'hour']) {
                L.push(`· ${v.weights[k].label}`);
            }
            L.push(`合计骨重：${v.total.label}（${v.total.qian} 钱）`);
            L.push('');
            L.push(`【${v.verdict.band}档】${v.verdict.text}`);
            L.push('');
            L.push(DISCLAIMER);
            return textBlock(L.join('\n'));
        },
    });
}
