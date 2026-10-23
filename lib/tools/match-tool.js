// lib/tools/match-tool.js — xuanji_match：八字合婚/合盘（属相关系 + 日主生克 + 年命纳音，纯本地）。

import { defineTool } from './define-tool.js';
import { textBlock, DISCLAIMER } from './common.js';
import { computeMatch } from '../engine/match.js';

/** 双方生辰参数组。 */
function sideParams(prefix, label) {
    return {
        [`${prefix}Year`]: { type: 'integer', required: true, description: `${label}出生年份。` },
        [`${prefix}Month`]: { type: 'integer', required: true, description: `${label}出生月份（calendar=solar 为公历月；lunar 为农历月）。` },
        [`${prefix}Day`]: { type: 'integer', required: true, description: `${label}出生日。` },
        [`${prefix}Hour`]: { type: 'integer', description: `${label}出生小时（0–23）；可选，只影响本人时柱，不参与合参主判。` },
        [`${prefix}Calendar`]: { type: 'string', enum: ['solar', 'lunar'], description: `${label}历法（缺省公历）。` },
        [`${prefix}IsLeapMonth`]: { type: 'boolean', description: `${label}农历是否闰月。` },
        [`${prefix}Label`]: { type: 'string', description: `${label}称呼（如「男方」「女方」「小李」），缺省用「甲方/乙方」。` },
    };
}

function sideArgs(args, prefix) {
    const side = {
        year: args[`${prefix}Year`], month: args[`${prefix}Month`], day: args[`${prefix}Day`],
        ...(Number.isInteger(args[`${prefix}Hour`]) ? { hour: args[`${prefix}Hour`] } : {}),
        ...(args[`${prefix}Calendar`] ? { calendar: args[`${prefix}Calendar`] } : {}),
        ...(args[`${prefix}IsLeapMonth`] !== undefined ? { isLeapMonth: args[`${prefix}IsLeapMonth`] } : {}),
        ...(args[`${prefix}Label`] ? { label: args[`${prefix}Label`] } : {}),
    };
    if (!Number.isInteger(side.year) || !Number.isInteger(side.month) || !Number.isInteger(side.day)) {
        throw new Error(`缺少必要输入：${prefix}Year/${prefix}Month/${prefix}Day（${prefix === 'a' ? '甲方' : '乙方'}出生年月日）——按插件纪律应向用户询问，不要代填。`);
    }
    return side;
}

export function defineMatchTool() {
    return defineTool({
        name: 'xuanji_match',
        description: [
            '八字合婚/合盘（纯本地确定性计算）：给双方出生年月日（时辰可选），输出传统通行口径的确定性关系事实——',
            '属相关系（六合/三合/六冲/六害/相刑/自刑）、日主生克与天干五合、双向十神映射（对方日干在我方盘中为',
            '何种十神）、跨盘三合/半合与跨盘六合（年支×日支交叉成局）、年命纳音生克，并给简化综合分档（上/中上/中/',
            '需磨合，吉凶象计数启发式）。只给「摩擦点在哪里、怎么相处」，绝不做「必配/必离」断言。适用：问「我俩',
            '八字合不合」「属相配不配」「合婚」。亲子/合作合盘也可用本工具看属相与日主关系，但口径以婚恋为默认。',
        ].join(''),
        parameters: {
            ...sideParams('a', '甲方'),
            ...sideParams('b', '乙方'),
            ziShi: { type: 'integer', enum: [1, 2], description: '晚子时日柱口径：1=按次日（默认）；2=按当日。与 xuanji_bazi 宿主配置一致。' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: true,
                properties: {
                    meta: { type: 'object', additionalProperties: true },
                    relations: { type: 'array', items: { type: 'object', additionalProperties: true } },
                    verdict: { type: 'object', additionalProperties: true },
                    sources: { type: 'array', items: { type: 'string' } },
                    disclaimer: { type: 'string' },
                },
            },
        },
        isConcurrencySafe: true,
        async execute(args) {
            // 晚子时口径：宿主可配 ziShi（1=次日默认 / 2=当日），与 xuanji_bazi 同源
            const ziShi = args.ziShi === 2 ? 2 : 1;
            return computeMatch({ a: sideArgs(args, 'a'), b: sideArgs(args, 'b'), ziShi });
        },
        render: (_args, v) => {
            const L = [];
            // meta 值两种形态：标题行标量（双方生辰）与备注（*Note 字符串 / *TimeNotes 数组），分开渲染——
            // 数组直接拼进标题行会变成「aTimeNotes 检出 1990 年夏令时…」。(修复于审查)
            const headline = [];
            const remarks = [];
            for (const [k, val] of Object.entries(v.meta)) {
                if (Array.isArray(val)) {
                    for (const n of val) remarks.push(`${k.replace(/TimeNotes$/, '')}：${n}`);
                } else if (k.endsWith('Note')) {
                    remarks.push(`${k.replace(/Note$/, '')}：${val}`);
                } else {
                    headline.push(`${k} ${val}`);
                }
            }
            L.push(`【八字合婚】${headline.join(' × ')}`);
            for (const r of remarks) L.push(`ℹ ${r}`);
            L.push('');
            L.push('关系事实：');
            const KIND_LABEL = { 属相: '属相', 日主: '日主', 双向十神: '十神', 跨盘三合: '跨盘合', 跨盘六合: '跨盘合', 年命纳音: '纳音' };
            for (const r of v.relations) L.push(`· [${KIND_LABEL[r.kind] ?? r.kind}] ${r.text}（${r.tone}）`);
            L.push('');
            L.push(`【${v.verdict.verdict}档】${v.verdict.text}`);
            L.push('');
            L.push(`口径出处：${v.sources.join('；')}`);
            L.push('解读要求：冲刑害一律翻译成「摩擦点/留意处」的中性表达，绝不用恐吓断语；落点放在第③层现实建议（相处方式）；末尾附免责声明。');
            L.push(DISCLAIMER);
            return textBlock(L.join('\n'));
        },
    });
}
