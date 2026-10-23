// lib/tools/meihua-tool.js — xuanji_meihua：梅花易数起卦（时间/报数，纯本地确定性）。

import { defineTool } from './define-tool.js';
import { textBlock, DISCLAIMER, normalizeDate } from './common.js';
import { computeMeihua } from '../engine/meihua.js';

export function defineMeihuaTool() {
    return defineTool({
        name: 'xuanji_meihua',
        description: [
            '梅花易数起卦（纯本地确定性计算）：mode=time 以时刻起卦（默认当前时刻，或给 date+hour），',
            'mode=number 以用户随口报的两个正整数起卦（前数上卦、后数下卦、和数加时辰取动爻）。',
            '返回本卦/互卦/变卦（卦名+卦画+白话卦意）、动爻、体卦用卦与五行生克断语（用生体大吉/比和吉/',
            '体克用小吉/体生用小凶/用克体凶）。起卦要素是唯一事实来源——解读必须引用返回值，不得改卦。',
            '用户问事时建议先问一句所为何事（记入 question），解读时以体用生克结合所问之事展开。',
        ].join(''),
        parameters: {
            mode: { type: 'string', required: true, enum: ['time', 'number'], description: 'time=时间起卦；number=报数起卦。' },
            question: { type: 'string', description: '所问何事（原样记录进结果，解读用）。' },
            date: { type: 'string', description: 'mode=time：日期 YYYY-MM-DD（calendar=solar 为公历；lunar 为农历），缺省为今天。' },
            calendar: { type: 'string', enum: ['solar', 'lunar'], description: 'mode=time 且给了 date 时：输入历法，solar=公历（默认），lunar=农历。' },
            isLeapMonth: { type: 'boolean', description: 'calendar=lunar 时：是否闰月。' },
            hour: { type: 'integer', description: 'mode=time：起卦时辰（0–23），缺省为当前时刻。' },
            num1: { type: 'integer', description: 'mode=number：第一个报数（正整数，取上卦）。' },
            num2: { type: 'integer', description: 'mode=number：第二个报数（正整数，取下卦）。' },
            hourForNumber: { type: 'integer', description: 'mode=number：起卦时辰（0–23），缺省按子时口径。' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: true,
                properties: {
                    meta: { type: 'object', additionalProperties: true },
                    gua: { type: 'object', additionalProperties: true },
                    tiYong: { type: 'object', additionalProperties: true },
                    disclaimer: { type: 'string' },
                },
            },
        },
        isConcurrencySafe: true,
        async execute(args) {
            // 时间起卦按农历年月日时取数：给农历日期先归一到公历，引擎内部再自己转回农历。
            const { date } = args?.date
                ? normalizeDate(args.date, args.calendar, args.isLeapMonth)
                : { date: undefined };
            return computeMeihua({ ...args, date });
        },
        render: (_args, v) => {
            const L = [];
            const g = v.gua;
            L.push(`【梅花易数·${v.meta.mode}】${v.meta.question ? `所问：${v.meta.question}` : ''}`.trim());
            L.push(`起卦依据：${v.meta.originText}`);
            L.push('');
            L.push(`本卦 ${g.ben.symbol} ${g.ben.name}（上${g.ben.upper}下${g.ben.lower}）—— ${g.ben.gist}`);
            L.push(`动爻：${g.movingWen}（自下而上第 ${g.movingYao} 爻）`);
            if (g.hu) L.push(`互卦 ${g.hu.symbol} ${g.hu.name}（上${g.hu.upper}下${g.hu.lower}）—— 事之中间过程：${g.hu.gist}`);
            if (g.bian) L.push(`变卦 ${g.bian.symbol} ${g.bian.name}（上${g.bian.upper}下${g.bian.lower}）—— 事之最终趋势：${g.bian.gist}`);
            L.push('');
            L.push(`体卦 ${v.tiYong.ti.symbol} ${v.tiYong.ti.name}（${v.tiYong.ti.wuxing}，${v.tiYong.ti.position}，代表求测方）`);
            L.push(`用卦 ${v.tiYong.yong.symbol} ${v.tiYong.yong.name}（${v.tiYong.yong.wuxing}，${v.tiYong.yong.position}，代表所测之事）`);
            L.push(`体用关系：${v.tiYong.relation}（${v.tiYong.level}）—— ${v.tiYong.text}`);
            L.push('');
            L.push('解读要求：结合本/互/变三卦趋势与体用生克，围绕所问之事给传统解读与行动建议，末尾附免责声明。');
            L.push(DISCLAIMER);
            return textBlock(L.join('\n'));
        },
    });
}
