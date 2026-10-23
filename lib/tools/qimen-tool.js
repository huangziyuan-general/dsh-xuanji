// lib/tools/qimen-tool.js — xuanji_qimen：奇门遁甲时家转盘（纯本地确定性计算）。

import { defineTool } from './define-tool.js';
import { textBlock, DISCLAIMER } from './common.js';
import { computeQimen } from '../engine/qimen.js';

export function defineQimenTool() {
    return defineTool({
        name: 'xuanji_qimen',
        description: [
            '奇门遁甲（纯本地确定性计算，时家转盘·拆补法简化口径）：给公历或农历日期 + 时辰（0–23，必填，缺时辰整盘不可排），',
            '返回阳遁/阴遁、节气局数、符头、时干支、值符、旬空，以及八宫（坎坤震巽中乾兑艮离）的地盘九星、天盘九星与八门落宫。',
            '八门：休死伤杜开惊生景；九星：天蓬天芮天冲天辅天禽天心中天柱天任天英。盘面是唯一事实来源——解读必须引用本工具',
            '返回值，绝不自行推演星门落宫。适用：问「某时某事该往哪个方位」「奇门怎么看这件事」「开市/出行/修造择时」。',
        ].join(''),
        parameters: {
            year: { type: 'integer', required: true, description: '日期年份，如 2026。' },
            month: { type: 'integer', required: true, description: '日期月份（calendar=solar 为公历月；lunar 为农历月）。' },
            day: { type: 'integer', required: true, description: '日期日。' },
            hour: { type: 'integer', required: true, description: '时辰小时（0–23，必填；奇门缺时辰不可排）。' },
            calendar: { type: 'string', enum: ['solar', 'lunar'], description: '输入历法：solar=公历（默认），lunar=农历。' },
            isLeapMonth: { type: 'boolean', description: 'calendar=lunar 时：是否闰月。' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: true,
                properties: {
                    meta: { type: 'object', additionalProperties: true },
                    diPan: { type: 'object', additionalProperties: true },
                    tianPan: { type: 'object', additionalProperties: true },
                    men: { type: 'object', additionalProperties: true },
                    zhiFu: { type: 'string' },
                    kongWang: { type: 'array', items: { type: 'string' } },
                    palaces: { type: 'object', additionalProperties: true },
                    disclaimer: { type: 'string' },
                },
            },
        },
        isConcurrencySafe: true,
        async execute(args) {
            return computeQimen(args);
        },
        render: (_args, v) => {
            const L = [];
            const m = v.meta;
            L.push(`【奇门遁甲】${m.solar}（${m.lunar}）｜日 ${m.ganzhi.day}｜时 ${m.ganzhi.time}`);
            for (const note of m.notes ?? []) L.push(`ℹ ${note}`);
            L.push('');
            L.push(`局：${m.ju.yangDun ? '阳遁' : '阴遁'} ${m.ju.ju} 局（${m.ju.jq}节，符头${m.ju.fuTou}）｜值符 ${v.zhiFu}｜旬空 ${v.kongWang.join('、')}`);
            L.push('');
            L.push('八宫星门（地盘星/天盘星/八门）：');
            for (const [dir, p] of Object.entries(v.palaces)) {
                L.push(`· ${dir}（${p.palace}宫）：地_${p.di} 天_${p.tian} 门_${p.men ?? '—'}`);
            }
            L.push('');
            L.push('解读要求：先复述盘面事实（局数/值符/八宫星门），再按传统奇门框架给现实行动建议，末尾附免责声明。');
            L.push(DISCLAIMER);
            return textBlock(L.join('\n'));
        },
    });
}
