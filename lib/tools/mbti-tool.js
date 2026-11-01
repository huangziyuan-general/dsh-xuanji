// lib/tools/mbti-tool.js — xuanji_mbti：MBTI 十六型人格（本地确定性问卷，纯本地）。
//
// 两种用法：
//   · 不给 answers → 返回 24 题问卷（模型据此向用户逐题发问，不代填）；
//   · 给 answers（24 个 0/1，逗号分隔串或数组）→ 确定性计分，返回类型 + 四维 + 档案。

import { defineTool } from './define-tool.js';
import { textBlock, DISCLAIMER } from './common.js';
import { computeMbti, mbtiQuestions, PROFILES, DIMENSIONS } from '../engine/mbti.js';

/** 把 answers 解析为数字数组（接受 "0,1,0" 串或 [0,1,0] 数组）。 */
function parseAnswers(raw) {
    if (Array.isArray(raw)) return raw.map((x) => Number(x));
    if (typeof raw === 'string' && raw.trim() !== '') {
        return raw.split(/[\s,]+/).map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
    }
    return [];
}

export function defineMbtiTool() {
    return defineTool({
        name: 'xuanji_mbti',
        description: [
            'MBTI 十六型人格（本地确定性问卷，纯本地计算，零模型推理）：共 24 题，每题二选一。',
            '不给 answers 时返回问卷（模型据此逐题问用户，绝不代填）；给了 answers（24 个 0/1，逗号分隔串或数组）',
            '则返回十六型结果（如 INTJ）、四维倾向与白话档案。结果由问卷确定性计分得出，同日同答案永远一致，',
            '仅作性格倾向参考，不构成心理诊断。适用：用户点名 MBTI / 十六型人格 / 想知道自己是什么型。',
        ].join(''),
        parameters: {
            answers: { type: 'string', description: '24 题答案：每题 0（A 选项）或 1（B 选项），逗号分隔，如 "0,1,0,..."；不给则返回问卷。' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: true,
                properties: {
                    meta: { type: 'object', additionalProperties: true },
                    type: { type: 'string' },
                    dimensions: { type: 'object', additionalProperties: true },
                    profile: { type: 'string' },
                    questions: { type: 'array', items: { type: 'object', additionalProperties: true } },
                    sources: { type: 'array', items: { type: 'string' } },
                    disclaimer: { type: 'string' },
                },
            },
        },
        isConcurrencySafe: true,
        async execute(args) {
            if (args?.answers === undefined || args?.answers === null || args?.answers === '') {
                // 问卷模式：返回题目，让模型逐题问用户
                return {
                    meta: { mode: 'quiz' },
                    questions: mbtiQuestions(),
                    sources: ['MBTI 十六型问卷：本地确定性计分（24 题二选一）'],
                    disclaimer: DISCLAIMER,
                };
            }
            const answers = parseAnswers(args.answers);
            return computeMbti({ answers });
        },
        render: (_args, v) => {
            if (v.meta?.mode === 'quiz') {
                const L = ['【MBTI·十六型人格】问卷（共 24 题，请逐题回复选项编号）'];
                for (const q of v.questions) {
                    L.push(`${q.id}. ${q.text}`);
                    L.push(`   A. ${q.options[0]}`);
                    L.push(`   B. ${q.options[1]}`);
                }
                L.push('');
                L.push('把 24 题的 A/B 选择按题号顺序告诉我（如「1A 2B 3A…」或「0,1,0,…」），我帮你算类型。');
                return textBlock(L.join('\n'));
            }
            const L = [];
            L.push(`【MBTI·十六型人格】${v.type ?? '（题目不完整）'}`);
            if (v.dimensions) {
                for (const [dim, d] of Object.entries(v.dimensions)) {
                    const [p0, p1] = d.names;
                    const win = d.pole;
                    L.push(`· ${dim}（${d.label}）：${p0}${win === d.pole && d.pole === DIMENSIONS[dim].poles[0] ? '✓' : ''} / ${p1}${win === DIMENSIONS[dim].poles[1] ? '✓' : ''}　计分 ${d.score[0]}:${d.score[1]}`);
                }
            }
            if (v.meta?.ties) L.push('（有维度平票，已按首极取舍并标注）');
            if (v.profile) L.push('', `画像：${v.profile}`);
            L.push('', `口径出处：${v.sources.join('；')}`, v.disclaimer);
            return textBlock(L.join('\n'));
        },
    });
}
