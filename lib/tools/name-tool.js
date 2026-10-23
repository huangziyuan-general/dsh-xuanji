// lib/tools/name-tool.js — xuanji_name：起名（评估 + 候选生成，纯本地确定性）。

import { defineTool } from './define-tool.js';
import { textBlock, DISCLAIMER } from './common.js';
import { assessName, generateNames } from '../engine/name.js';

export function defineNameTool() {
    return defineTool({
        name: 'xuanji_name',
        description: [
            '起名（纯本地确定性计算）。action=assess（默认）：名字五行评估——给姓氏 + 名（1–2 字），可选给生辰；',
            '给生辰时复用八字引擎算喜用倾向（简化判定），逐字对照内置常用字五行字库（241 字）打分，字库未收录的',
            '字符如实标注「未收录」。action=generate：候选名生成——给姓氏 + 生辰（性别必填），按喜用五行',
            '从自建候选字库（带字义与性别倾向标注）组合候选名并确定性排序，音韵谐音不在口径内（notes 会提醒用户',
            '读念检查）。适用：问「这个名字和八字合不合」「帮我看下这个名字」「帮孩子起几个候选名」。',
        ].join(''),
        parameters: {
            action: { type: 'string', enum: ['assess', 'generate'], description: 'assess=评估已有名字（默认）；generate=生成候选名。' },
            surname: { type: 'string', required: true, description: '姓氏，如 李。' },
            givenName: { type: 'string', description: 'assess 必填：名（1–2 个汉字），如 沐宸。' },
            bYear: { type: 'integer', description: '（可选）生辰：出生年份，给出后做喜用神匹配。' },
            bMonth: { type: 'integer', description: '生辰：出生月份。' },
            bDay: { type: 'integer', description: '生辰：出生日。' },
            bHour: { type: 'integer', description: '生辰：出生小时（0–23）；缺省只排三柱。' },
            bGender: { type: 'string', enum: ['male', 'female'], description: '生辰：性别。' },
            bCalendar: { type: 'string', enum: ['solar', 'lunar'], description: '生辰：历法（缺省公历）。' },
            bIsLeapMonth: { type: 'boolean', description: '生辰：农历是否闰月。' },
            bCity: { type: 'string', description: '生辰：出生城市（真太阳时校正）。' },
            limit: { type: 'integer', description: 'action=generate：返回候选个数（1–20，缺省 10）。' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: true,
                properties: {
                    meta: { type: 'object', additionalProperties: true },
                    favor: { type: 'object', additionalProperties: true },
                    chars: { type: 'array', items: { type: 'object', additionalProperties: true } },
                    score: { type: 'integer' },
                    verdict: { type: 'object', additionalProperties: true },
                    sources: { type: 'array', items: { type: 'string' } },
                    disclaimer: { type: 'string' },
                },
            },
        },
        isConcurrencySafe: true,
        async execute(args) {
            const surname = typeof args.surname === 'string' ? args.surname.trim() : '';
            if (!surname) throw new Error('缺少必要输入：surname（姓氏）');
            const givenName = typeof args.givenName === 'string' ? args.givenName.trim() : '';
            if (args.action === 'generate') {
                if (!Number.isInteger(args.bYear) || !Number.isInteger(args.bMonth) || !Number.isInteger(args.bDay)) {
                    throw new Error('缺少必要输入：bYear/bMonth/bDay（出生年月日）——候选生成必须按八字喜用筛字，请向用户询问。');
                }
                if (!args.bGender) {
                    throw new Error('缺少必要输入：bGender（性别）——候选生成按性别筛选候选字，必填，请向用户询问，不要代填。');
                }
                return generateNames({
                    surname,
                    limit: Number.isInteger(args.limit) ? args.limit : undefined,
                    birth: {
                        year: args.bYear, month: args.bMonth, day: args.bDay,
                        ...(Number.isInteger(args.bHour) ? { hour: args.bHour } : {}),
                        gender: args.bGender,
                        ...(args.bCalendar ? { calendar: args.bCalendar } : {}),
                        ...(args.bIsLeapMonth !== undefined ? { isLeapMonth: args.bIsLeapMonth } : {}),
                        ...(args.bCity ? { city: args.bCity } : {}),
                    },
                });
            }
            if (!givenName) {
                throw new Error('缺少必要输入：givenName（要评估的名字，1–2 个汉字）——按插件纪律应向用户询问，不要代填。');
            }
            const hasBirth = Number.isInteger(args.bYear) && Number.isInteger(args.bMonth) && Number.isInteger(args.bDay);
            if (hasBirth && !args.bGender) {
                throw new Error('缺少必要输入：bGender（性别）——给生辰做喜用匹配时性别必填，请向用户询问，不要代填。');
            }
            return assessName({
                surname,
                givenName,
                ...(hasBirth ? {
                    birth: {
                        year: args.bYear, month: args.bMonth, day: args.bDay,
                        ...(Number.isInteger(args.bHour) ? { hour: args.bHour } : {}),
                        gender: args.bGender,
                        ...(args.bCalendar ? { calendar: args.bCalendar } : {}),
                        ...(args.bIsLeapMonth !== undefined ? { isLeapMonth: args.bIsLeapMonth } : {}),
                        ...(args.bCity ? { city: args.bCity } : {}),
                    },
                } : {}),
            });
        },
        render: (_args, v) => {
            if (v.candidates) return renderGenerate(v);
            const L = [];
            L.push(`【名字五行评估】${v.meta.name}`);
            for (const note of v.meta.notes ?? []) L.push(`ℹ ${note}`);
            if (v.favor) {
                L.push(`日主 ${v.meta.bazi.dayMaster.gan}（${v.meta.bazi.dayMaster.wuxing}）｜${v.favor.rule}`);
                L.push(`喜用五行：${v.favor.favorable ? v.favor.favorable.join('、') : '以调和为先'}（${v.favor.note}）`);
            } else {
                L.push('（未给生辰：仅列各字五行，补生辰后可对照喜用神）');
            }
            L.push('');
            for (const c of v.chars) {
                L.push(`· ${c.char}：五行_${c.wuxing ?? '未收录'}${c.match ? `｜${c.match}` : ''}${c.status === '未收录' ? '（字库未收录，不臆断）' : ''}`);
            }
            L.push('');
            L.push(`【${v.verdict.verdict}档】${v.verdict.text}`);
            L.push('');
            L.push(`口径出处：${v.sources.join('；')}`);
            L.push(DISCLAIMER);
            return textBlock(L.join('\n'));
        },
    });
}

/** action=generate 渲染：候选名清单。 */
function renderGenerate(v) {
    const L = [];
    L.push(`【起名候选】${v.meta.surname}姓 · ${v.meta.gender}宝`);
    for (const note of v.meta.notes ?? []) L.push(`ℹ ${note}`);
    L.push(`${v.favor.rule}`);
    L.push(`喜用五行：${v.favor.favorable ? v.favor.favorable.join('、') : '以调和为先（不按五行强筛）'}（${v.favor.note}）`);
    L.push(`候选字池：${v.poolSize} 字（合喜用筛选后）`);
    L.push('');
    v.candidates.forEach((c, i) => {
        L.push(`${i + 1}. ${c.name}｜${c.match}`);
        L.push(`   ${c.chars.map((x) => `${x.char}（${x.wuxing}·${x.meaning}）`).join(' ')}`);
    });
    L.push('');
    for (const n of v.notes) L.push(`※ ${n}`);
    L.push('');
    L.push(`口径出处：${v.sources.join('；')}`);
    L.push('解读要求：候选按喜用与字义讲「为什么入选」，明确提醒音韵谐音要用户自己读念把关；不渲染「改运」效果；末尾附免责声明。');
    L.push(DISCLAIMER);
    return textBlock(L.join('\n'));
}
