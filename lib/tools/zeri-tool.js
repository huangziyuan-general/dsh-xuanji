// lib/tools/zeri-tool.js — xuanji_zeri：择日（事项×黄历宜忌×建除十二神×冲煞，纯本地确定性）。

import { defineTool } from './define-tool.js';
import { textBlock, DISCLAIMER, normalizeDate } from './common.js';
import { computeZeri, TASKS } from '../engine/zeri.js';
import { SHENGXIAO } from '../engine/tables.js';

export function defineZeriTool() {
    return defineTool({
        name: 'xuanji_zeri',
        description: [
            '择日（纯本地确定性计算）：给定事项（嫁娶/订婚/开业/入宅/搬家/动土/装修/安葬/出行/祭祀/签约/求医/纳财）',
            '+ 日期区间（缺省今天起 30 天）+ 当事人属相（可选，用于排除冲煞日），逐日按黄历宜忌、建除十二神适配、',
            '冲煞排除打分排序，输出推荐日/可用日/回避日及依据。评分为排序引导而非吉凶断语（口径见返回 sources）。',
            '用户问「最近哪天适合开业/搬家/领证」时用本工具；先问清事项与当事人属相（冲煞会因人而异）。',
            '日历法：startDate 默认按公历；calendar=lunar 时按农历起始日查（用户常说「农历八月初八之后」）。',
        ].join(''),
        parameters: {
            task: { type: 'string', required: true, enum: Object.keys(TASKS), description: '所办事项。' },
            startDate: { type: 'string', description: '起始日期 YYYY-MM-DD（calendar=solar 为公历；lunar 为农历），缺省为今天。' },
            calendar: { type: 'string', enum: ['solar', 'lunar'], description: '输入历法：solar=公历（默认），lunar=农历。' },
            isLeapMonth: { type: 'boolean', description: 'calendar=lunar 时：是否闰月。' },
            days: { type: 'integer', description: '考察天数（1–60），缺省 30。' },
            shengXiao: { type: 'string', enum: SHENGXIAO, description: '当事人属相（鼠牛虎…猪），用于排除冲煞日；可省略。' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: true,
                properties: {
                    meta: { type: 'object', additionalProperties: true },
                    best: { type: 'array', items: { type: 'string' } },
                    avoid: { type: 'array', items: { type: 'string' } },
                    usable: { type: 'array', items: { type: 'string' } },
                    excludedCount: { type: 'number' },
                    days: { type: 'array', items: { type: 'object', additionalProperties: true } },
                    disclaimer: { type: 'string' },
                },
            },
        },
        isConcurrencySafe: true,
        async execute(args) {
            const { date, note } = args?.startDate
                ? normalizeDate(args.startDate, args.calendar, args.isLeapMonth)
                : { date: undefined, note: null };
            const result = computeZeri({ ...args, startDate: date });
            if (note) {
                result.meta.inputNote = note;
                result.meta.inputCalendar = '农历';
            }
            return result;
        },
        render: (_args, v) => {
            const L = [];
            L.push(`【择日·${v.meta.task}】${v.meta.startDate} 起 ${v.meta.days} 天${v.meta.shengXiao ? `｜当事人属${v.meta.shengXiao}` : ''}`);
            L.push(`ℹ ${v.meta.ruleNote}`);
            L.push('');
            L.push(`推荐日：${v.best.length > 0 ? v.best.join('、') : '区间内无「推荐」档，见可用日'}`);
            const good = v.days.filter((d) => !d.excluded && (d.verdict === '推荐' || d.verdict === '可用')).slice(0, 8);
            if (good.length > 0) {
                L.push('');
                L.push('推荐/可用日明细：');
                for (const d of good) {
                    L.push(`· ${d.date}（${d.lunar}，${d.dayGanZhi}日，建除${d.zhiXing}神）${d.verdict}：${d.reasons.join('；')}`);
                }
            }
            if (v.avoid.length > 0) {
                L.push('');
                L.push(`回避日（${v.avoid.length} 天）：${v.avoid.slice(0, 6).join('；')}${v.avoid.length > 6 ? ' 等' : ''}`);
            }
            L.push('');
            L.push('解读要求：推荐日讲清「为什么合」（宜项+建除），回避日提醒换期；最终以用户实际安排为准，末尾附免责声明。');
            L.push(DISCLAIMER);
            return textBlock(L.join('\n'));
        },
    });
}
