// lib/tools/almanac-tool.js — xuanji_almanac：每日黄历 + 每日一卦（纯本地确定性）。

import { defineTool } from './define-tool.js';
import { textBlock, DISCLAIMER, normalizeDate } from './common.js';
import { computeAlmanac } from '../engine/almanac.js';

export function defineAlmanacTool() {
    return defineTool({
        name: 'xuanji_almanac',
        description: [
            '每日黄历（纯本地确定性计算）：给定公历日期（缺省今天），返回农历、干支年月日、生肖、宜忌清单、',
            '冲煞（冲什么生肖、煞在何方）、喜神/财神/福神/阳贵/阴贵方位、节气（当前/上一/下一）、节日、值神、',
            '二十八星宿、月相、六曜、彭祖百忌、吉神凶煞，并附「每日一卦」（日期确定性取卦，同一天永远同一卦）。',
            '用户问「今天适合做什么/黄历/宜忌/今日运势/财神方位」时用本工具。',
            '日历法：date 默认按公历；calendar=lunar 时按农历日期查（用户常问「农历七月初七」，闰月请带 isLeapMonth）。',
        ].join(''),
        parameters: {
            date: { type: 'string', description: '日期 YYYY-MM-DD（calendar=solar 为公历；lunar 为农历），缺省为今天。' },
            calendar: { type: 'string', enum: ['solar', 'lunar'], description: '输入历法：solar=公历（默认），lunar=农历。' },
            isLeapMonth: { type: 'boolean', description: 'calendar=lunar 时：是否闰月。' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: true,
                properties: {
                    meta: { type: 'object', additionalProperties: true },
                    lunarDate: { type: 'string' },
                    ganzhi: { type: 'object', additionalProperties: true },
                    yi: { type: 'array', items: { type: 'string' } },
                    ji: { type: 'array', items: { type: 'string' } },
                    chong: { type: 'object', additionalProperties: true },
                    dailyHexagram: { type: 'object', additionalProperties: true },
                    disclaimer: { type: 'string' },
                },
            },
        },
        isConcurrencySafe: true,
        async execute(args) {
            // 农历查询（「七月初七」这类）先换算成公历，引擎一律吃公历日期。
            const { date, note } = args?.date
                ? normalizeDate(args.date, args.calendar, args.isLeapMonth)
                : { date: undefined, note: null };
            const result = computeAlmanac(date);
            if (note) {
                result.meta.inputNote = note;
                result.meta.inputCalendar = '农历';
            }
            return result;
        },
        render: (_args, v) => {
            const L = [];
            L.push(`【每日黄历】${v.meta.date}${v.meta.isToday ? '（今天）' : ''}`);
            L.push(`农历 ${v.lunarDate}｜${v.ganzhi.year}年 ${v.ganzhi.month}月 ${v.ganzhi.day}日｜属${v.ganzhi.shengXiao}`);
            if (v.meta?.boundaryNote) L.push(`ℹ ${v.meta.boundaryNote}`);
            L.push(`宜：${v.yi.join('、') || '——'}`);
            L.push(`忌：${v.ji.join('、') || '——'}`);
            L.push(`冲煞：${v.chong.text}（冲${v.chong.shengXiao}）${v.chong.sha}`);
            L.push(`方位：喜神${v.positions.xiShen}｜财神${v.positions.caiShen}｜福神${v.positions.fuShen}｜阳贵${v.positions.yangGui}｜阴贵${v.positions.yinGui}`);
            const jq = v.jieQi;
            L.push(`节气：${jq.current ? `今日交${jq.current.name}｜` : ''}${jq.prev.name}（${jq.prev.date}）已过，下一节气 ${jq.next.name}（${jq.next.date}）`);
            if (v.festivals.length > 0) L.push(`节日：${v.festivals.join('、')}`);
            L.push(`值神：${v.zhiXing}｜星宿：${v.xiu.xiu}（${v.xiu.gong}${v.xiu.animal}）｜月相：${v.yueXiang}｜六曜：${v.liuYao}`);
            L.push(`彭祖百忌：${v.pengZu.gan}；${v.pengZu.zhi}`);
            L.push(`吉神宜趋：${v.jiShen.join('、') || '——'}`);
            L.push(`凶神宜忌：${v.xiongSha.join('、') || '——'}`);
            if (v.dailyHexagram) {
                const h = v.dailyHexagram;
                L.push('');
                L.push(`今日一卦 ${h.symbol} ${h.name}（上${h.upper}下${h.lower}）—— ${h.gist}`);
            }
            L.push('');
            L.push(DISCLAIMER);
            return textBlock(L.join('\n'));
        },
    });
}
