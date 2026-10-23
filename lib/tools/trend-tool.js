// lib/tools/trend-tool.js — xuanji_trend：人生K线（1–100 岁运势分 + ASCII 图，纯本地确定性）。

import { defineTool } from './define-tool.js';
import { textBlock, DISCLAIMER } from './common.js';
import { computeTrend } from '../engine/trend.js';

export function defineTrendTool() {
    return defineTool({
        name: 'xuanji_trend',
        description: [
            '人生K线（纯本地确定性计算）：给生辰 + 性别，按大运干支（权重高）与流年干支十神对日主的简化启发式，',
            '输出 1–100 岁逐年运势分与 K 线形态（开/收/高/低），附大运分段 ASCII 迷你图与最佳/最差年份。',
            '适用：问「人生趋势」「大运走势」「哪几年顺」。这是简化判定的可视化，不是命运断语——解读时讲趋势',
            '形态与所处大运主题，不逐年断吉凶；重大年份（转折点）建议结合流年四化（xuanji_ziwei fortune）互证。',
        ].join(''),
        parameters: {
            year: { type: 'integer', required: true, description: '出生年份。' },
            month: { type: 'integer', required: true, description: '出生月份（calendar=solar 为公历月；lunar 为农历月）。' },
            day: { type: 'integer', required: true, description: '出生日。' },
            hour: { type: 'integer', description: '出生小时（0–23），可省略（对大运流年影响极小）。' },
            minute: { type: 'integer', description: '出生分钟。' },
            gender: { type: 'string', required: true, enum: ['male', 'female'], description: '性别（大运顺逆），必填。' },
            calendar: { type: 'string', enum: ['solar', 'lunar'], description: '输入历法：solar=公历（默认），lunar=农历。' },
            isLeapMonth: { type: 'boolean', description: 'calendar=lunar 时：是否闰月。' },
            applyDST: { type: 'boolean', description: '是否自动校正 1986–1991 中国夏令时（默认 true）。' },
            city: { type: 'string', description: '出生城市（真太阳时校正用）；与 longitude 二选一，都省略则按钟面时间。' },
            longitude: { type: 'number', description: '出生地经度（东经为正，如成都 104.07）；与 city 二选一。' },
            toAge: { type: 'integer', description: '算到几岁（10–100），缺省 100。' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: true,
                properties: {
                    meta: { type: 'object', additionalProperties: true },
                    segments: { type: 'array', items: { type: 'object', additionalProperties: true } },
                    points: { type: 'array', items: { type: 'object', additionalProperties: true } },
                    highlights: { type: 'object', additionalProperties: true },
                    sparkline: { type: 'array', items: { type: 'string' } },
                    sources: { type: 'array', items: { type: 'string' } },
                    disclaimer: { type: 'string' },
                },
            },
        },
        isConcurrencySafe: true,
        async execute(args) {
            return computeTrend(args);
        },
        render: (_args, v) => {
            const L = [];
            const m = v.meta;
            L.push(`【人生K线】${m.birth}（${m.calendar}）｜日主 ${m.dayMaster}｜旺衰 ${m.strength.state}｜算至 ${m.toAge} 岁`);
            for (const note of m.notes ?? []) L.push(`ℹ ${note}`);
            L.push(`ℹ ${m.strength.note}`);
            L.push('');
            L.push('大运分段迷你图（每格一年，█高▁低）：');
            for (const line of v.sparkline) L.push(line);
            L.push('');
            L.push(`顺位年份：${v.highlights.best.join('、')}`);
            L.push(`谨慎年份：${v.highlights.worst.join('、')}`);
            L.push('');
            L.push('解读要求：只讲大趋势（大运主题、转折年龄段），不逐年断吉凶；当前年龄所在大运优先展开；末尾附免责声明。');
            L.push(DISCLAIMER);
            return textBlock(L.join('\n'));
        },
    });
}
