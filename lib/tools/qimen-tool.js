// lib/tools/qimen-tool.js — xuanji_qimen：奇门遁甲时家转盘（纯本地确定性计算）。

import { defineTool } from './define-tool.js';
import { textBlock, DISCLAIMER } from './common.js';
import { computeQimen } from '../engine/qimen.js';

export function defineQimenTool() {
    return defineTool({
        name: 'xuanji_qimen',
        description: [
            '奇门遁甲（纯本地确定性计算，时家转盘·拆补法，通行歌诀三元表）：给公历或农历日期 + 时辰（0–23，必填，缺时辰整盘不可排），',
            '返回阳遁/阴遁、节气三元与局数、时干支、旬首（六甲遁六仪）、值符星、值使门及其落宫、旬空，',
            '以及九宫的地盘三奇六仪（随局落宫）、天盘九星（携本宫仪奇、保持环形相对序旋转）、八门落宫。',
            '地盘即仪奇盘（diPan）；天盘星携仪见 tianPanYi；值使门与落宫见 zhiShi。盘面是唯一事实来源——解读必须引用本工具',
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
                    diPanXing: { type: 'object', additionalProperties: true },
                    tianPan: { type: 'object', additionalProperties: true },
                    tianPanYi: { type: 'object', additionalProperties: true },
                    men: { type: 'object', additionalProperties: true },
                    zhiFu: { type: 'string' },
                    zhiShi: { type: 'object', additionalProperties: true },
                    xun: { type: 'object', additionalProperties: true },
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
            L.push(`局：${m.ju.yangDun ? '阳遁' : '阴遁'} ${m.ju.ju} 局（${m.ju.jq}${m.ju.yuan}）｜值符 ${v.zhiFu}｜值使 ${v.zhiShi?.gate}｜旬空 ${v.kongWang.join('、')}`);
            L.push('');
            L.push('九宫（地盘仪奇/天盘星(携仪)/八门）：');
            for (const [dir, p] of Object.entries(v.palaces)) {
                L.push(`· ${dir}（${p.palace}宫）：地_${p.di} 天_${p.tian}(${p.tianYi}) 门_${p.men ?? '—'}`);
            }
            L.push('');
            L.push('解读要求：先复述盘面事实（局数/值符/值使/九宫仪奇星门），再按传统奇门框架给现实行动建议，末尾附免责声明。');
            L.push(DISCLAIMER);
            return textBlock(L.join('\n'));
        },
    });
}
