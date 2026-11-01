// lib/tools/daliuren-tool.js — xuanji_daliuren：大六壬（天地盘·四课·贼克三传，实验性）。
//
// 实验性：仅贼克法初传 + 顺布中末传落地，九宗门其余八法待经典对拍校准（详见引擎文件头声明）。
// 排盘纯本地确定性；缺占时（hour/hourZhi）不猜，向用户要。

import { defineTool } from './define-tool.js';
import { textBlock, missingInput } from './common.js';
import { computeDaliuren } from '../engine/daliuren.js';
import { ZHI } from '../engine/tables.js';

function resolveHour(input) {
    if (input.hourZhi && ZHI.includes(input.hourZhi)) return { hourZhi: input.hourZhi };
    if (input.hour !== undefined && input.hour !== null && input.hour !== '') {
        const h = Number(input.hour);
        if (!Number.isInteger(h) || h < 0 || h > 23) throw new Error(`hour 须为 0–23，收到 ${input.hour}`);
        return { hourZhi: ZHI[Math.floor(((h + 1) % 24) / 2)] };
    }
    return null;
}

export function defineDaliurenTool() {
    return defineTool({
        name: 'xuanji_daliuren',
        description: [
            '大六壬（本地确定性排盘，实验性）：天地盘、四课、贼克法三传。给定公历生日 + 占时（hour 0–23 或 hourZhi），',
            '或直给 dayGanZhi + monthZhi + hourZhi。结果由引擎确定性计算；⚠️本引擎为实验性实现，三传九宗门其余八法',
            '尚未做经典案例对拍校准，解读时须照实说明、不可当定论。适用：用户点名大六壬/六壬/三传占法。',
        ].join(''),
        parameters: {
            year: { type: 'string', description: '公历年份（与 dayGanZhi 二选一）。' },
            month: { type: 'string', description: '公历月份 1–12。' },
            day: { type: 'string', description: '公历日。' },
            hour: { type: 'string', description: '占时（0–23 钟面，或配 hourZhi）；大六壬必需，缺则向用户要。' },
            hourZhi: { type: 'string', description: '占时地支（子…亥），与 hour 二选一。' },
            dayGanZhi: { type: 'string', description: '直给日干支（如 甲午），与 year/month/day 二选一。' },
            monthZhi: { type: 'string', description: '直给月建地支（节气月，如 巳），与 year/month/day 二选一时使用。' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: true,
                properties: {
                    meta: { type: 'object', additionalProperties: true },
                    earth: { type: 'array', items: { type: 'string' } },
                    heaven: { type: 'array', items: { type: 'string' } },
                    four: { type: 'array', items: { type: 'object', additionalProperties: true } },
                    sanChuan: { type: 'array', items: { type: 'string' } },
                    sources: { type: 'array', items: { type: 'string' } },
                    disclaimer: { type: 'string' },
                },
            },
        },
        isConcurrencySafe: true,
        async execute(args) {
            const hh = resolveHour(args);
            if (!hh) throw missingInput('占时（hour 或 hourZhi）', '大六壬排盘需要占时');
            const input = {};
            if (args.dayGanZhi) {
                input.dayGanZhi = args.dayGanZhi;
                if (args.monthZhi) input.monthZhi = args.monthZhi;
                Object.assign(input, hh);
            } else {
                input.year = Number(args.year);
                input.month = Number(args.month);
                input.day = Number(args.day);
                Object.assign(input, hh);
            }
            return computeDaliuren(input);
        },
        render: (_args, v) => {
            const L = [];
            const m = v.meta;
            L.push(`【大六壬·实验性】${m.dayGanZhi}｜月将 ${m.yuejiang}｜占时 ${m.zhan}`);
            L.push(`天地盘：地盘 ${v.earth.join('')}；天盘 ${v.heaven.join('')}`);
            L.push('四课：');
            v.four.forEach((k, i) => L.push(`  ${i + 1}. ${k.ben} → ${k.shang}`));
            if (v.sanChuan) {
                L.push(`三传（贼克法，实验性）：${v.sanChuan.join(' → ')}`);
            } else {
                L.push('三传：四课无克，需昴星/遥克等九宗门其余诸法（本版未实现）。');
            }
            L.push('', `⚠️ ${m.note}`);
            L.push(`口径出处：${v.sources.join('；')}`);
            L.push(v.disclaimer);
            return textBlock(L.join('\n'));
        },
    });
}
