// lib/tools/liuyao-tool.js — xuanji_liuyao：六爻纳甲（京房）摇卦成卦，纯本地确定性。

import { defineTool } from './define-tool.js';
import { textBlock, DISCLAIMER, normalizeDate } from './common.js';
import { computeLiuyao } from '../engine/liuyao.js';

export function defineLiuyaoTool() {
    return defineTool({
        name: 'xuanji_liuyao',
        description: [
            '六爻纳甲（京房）起卦：把用户摇出的六个爻象（或六次掷币记录）排成完整卦例——',
            '本卦（卦名/卦画/八宫归属/世应）、纳甲干支、六亲、六神、旺相休囚死、旬空、月破/日破/暗动、',
            '动爻与变卦（变爻干支与回头生克）。mode=numbers 收六个爻象数（6老阴/7少阳/8少阴/9老阳，自下而上），',
            'mode=coins 收六次掷币记录（每次三枚，写「背」或「字」，背为阳：三背老阳、三字老阴）。',
            '摇卦必须由用户完成，绝不允许代摇或编造爻象——缺爻先问，不猜。',
            '月建按节气月、日辰按起卦日干支，二者决定旺衰与旬空，是唯一事实来源：解读必须引用返回值。',
        ].join(''),
        parameters: {
            mode: { type: 'string', required: true, enum: ['numbers', 'coins'], description: 'numbers=给六个爻象数；coins=给六次掷币记录。' },
            nums: { type: 'string', description: 'mode=numbers：六个爻象数，自下而上（初爻→上爻），6/7/8/9，如 "6,7,8,9,7,8"。必须用户摇出，不得代填。' },
            coins: { type: 'string', description: 'mode=coins：六次掷币、每次三枚，写「背」或「字」（背为阳面），如 "背背背 背背字 背字字 字字字 背背字 字背字"。' },
            question: { type: 'string', description: '所问何事（原样记录进结果，取用神时要用）。' },
            date: { type: 'string', description: '起卦日 YYYY-MM-DD（calendar=solar 为公历；lunar 为农历），缺省为今天。' },
            calendar: { type: 'string', enum: ['solar', 'lunar'], description: '给了 date 时的输入历法，solar=公历（默认），lunar=农历。' },
            isLeapMonth: { type: 'boolean', description: 'calendar=lunar 时：是否闰月。' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: true,
                properties: {
                    meta: { type: 'object', additionalProperties: true },
                    ben: { type: 'object', additionalProperties: true },
                    bian: { type: 'object', additionalProperties: true },
                    shiYing: { type: 'object', additionalProperties: true },
                    lines: { type: 'array', items: { type: 'object', additionalProperties: true } },
                    moving: { type: 'array', items: { type: 'object', additionalProperties: true } },
                    disclaimer: { type: 'string' },
                },
            },
        },
        isConcurrencySafe: true,
        async execute(args) {
            const { date } = args?.date
                ? normalizeDate(args.date, args.calendar, args.isLeapMonth)
                : { date: undefined };
            return computeLiuyao({ ...args, date });
        },
        render: (_args, v) => {
            const L = [];
            L.push(`【六爻纳甲】${v.meta.question ? `所问：${v.meta.question}` : ''}`.trim());
            L.push(`起卦：${v.meta.solarText}（${v.meta.lunarText}）${v.meta.jieQi ? ` · ${v.meta.jieQi}` : ''}`);
            L.push(`月建 ${v.meta.yueJian.ganZhi}（${v.meta.yueJian.wuxing}，旬空 ${v.meta.yueJian.xunKong}）｜日辰 ${v.meta.riChen.ganZhi}（${v.meta.riChen.wuxing}，旬空 ${v.meta.riChen.xunKong}）`);
            L.push(`摇卦依据：${v.meta.tossSource}`);
            L.push('');
            L.push(`本卦 ${v.ben.symbol} ${v.ben.name}（上${v.ben.upper}下${v.ben.lower}，${v.ben.palace}·${v.ben.gen}，宫属${v.ben.palaceWuxing}）—— ${v.ben.gist}`);
            L.push(`世爻 ${v.shiYing.shiName}（${v.shiYing.shiGanZhi}·${v.shiYing.shiLiuqin}）｜应爻 ${v.shiYing.yingName}（${v.shiYing.yingGanZhi}·${v.shiYing.yingLiuqin}）`);
            if (v.bian) L.push(`变卦 ${v.bian.symbol} ${v.bian.name}（上${v.bian.upper}下${v.bian.lower}）—— ${v.bian.gist}`);
            L.push('');
            L.push('爻　爻象　纳甲　五行　六亲　六神　旺衰　备注');
            for (const l of v.lines) {
                const tags = [];
                if (l.isShi) tags.push('世');
                if (l.isYing) tags.push('应');
                if (l.moving) tags.push('动');
                if (l.xunKong) tags.push('旬空');
                if (l.chong) tags.push(l.chong);
                tags.push(l.dayRel);
                L.push(`${l.name}　${l.mark}${l.yinYang === '阳' ? '阳' : '阴'}${l.moving ? '（动）' : ''}　${l.ganZhi}　${l.wuxing}　${l.liuqin}　${l.liushen}　${l.wangShuai}　${tags.join('/')}`);
            }
            if (v.moving.length > 0) {
                L.push('');
                L.push('动爻变化：');
                for (const m of v.moving) {
                    L.push(`· ${m.name} ${m.ganZhi}（${m.liuqin}）→ ${m.to}（${m.toLiuqin}），${m.rel}`);
                }
            } else {
                L.push('');
                L.push('静卦：六爻皆不动，以卦象与世应旺衰为主，动变无从谈起。');
            }
            const guide = Object.entries(v.liuqinGuide ?? {}).map(([k, g]) => `${k}（${g}）`).join('｜');
            if (guide) L.push(`六亲主事：${guide}`);
            L.push('');
            L.push('解读要求：以世爻为求测人、应爻为所问之事/对方，按六亲取用神，结合旺衰旬空与动爻变化给传统解读与行动建议，末尾附免责声明。');
            L.push(DISCLAIMER);
            return textBlock(L.join('\n'));
        },
    });
}
