// lib/tools/ziwei-tool.js — xuanji_ziwei：紫微斗数排盘（安星/四化/大限，纯本地确定性）。

import { defineTool } from './define-tool.js';
import { textBlock, DISCLAIMER, assertYmd } from './common.js';
import { computeZiwei } from '../engine/ziwei.js';

export function defineZiweiTool() {
    return defineTool({
        name: 'xuanji_ziwei',
        description: [
            '紫微斗数排盘（纯本地确定性计算，iztro 安星引擎）：给出公历或农历生日 + 时辰 + 性别，返回十二宫',
            '（命宫/兄弟/夫妻/子女/财帛/疾厄/迁移/仆役/官禄/田宅/福德/父母）的宫位干支、十四主星及亮度与生年四化',
            '（禄权科忌）、六吉六煞等辅曜、大限起讫年龄、命主/身主/五行局。时辰必填（十二宫格局随时辰变，缺了',
            '必须先问）。时间口径与 xuanji_bazi 一致：自动校正 1986–1991 中国夏令时，给 city/longitude 按真太阳时。',
            '排出的星曜落宫是唯一事实来源——解读必须引用本工具返回值，不得自行安星或改判庙旺。',
        ].join(''),
        parameters: {
            year: { type: 'integer', required: true, description: '出生年份。' },
            month: { type: 'integer', required: true, description: '出生月份（calendar=solar 为公历月；lunar 为农历月）。' },
            day: { type: 'integer', required: true, description: '出生日。' },
            hour: { type: 'integer', required: true, description: '出生小时（0–23，24 小时制），紫微必填。' },
            minute: { type: 'integer', description: '出生分钟（0–59），缺省 0（紫微以时辰为粒度，分钟仅用于真太阳时校正）。' },
            gender: { type: 'string', required: true, enum: ['male', 'female'], description: '性别，必填。' },
            calendar: { type: 'string', enum: ['solar', 'lunar'], description: '输入历法：solar=公历（默认），lunar=农历。' },
            isLeapMonth: { type: 'boolean', description: 'calendar=lunar 时：是否闰月。' },
            applyDST: { type: 'boolean', description: '是否自动校正 1986–1991 中国夏令时（默认 true）。' },
            city: { type: 'string', description: '出生城市（真太阳时校正用）；与 longitude 二选一，都省略则按钟面时间。' },
            longitude: { type: 'number', description: '出生地经度（东经为正）；与 city 二选一。' },
            action: { type: 'string', enum: ['natal', 'fortune'], description: 'natal=本命盘（默认）；fortune=运限层（大限/流年/小限三环与四化）。' },
            fortuneDate: { type: 'string', description: 'action=fortune：运限基准日 YYYY-MM-DD，缺省今天。' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: true,
                properties: {
                    meta: { type: 'object', additionalProperties: true },
                    soul: { type: 'string' },
                    body: { type: 'string' },
                    fiveElementsClass: { type: 'string' },
                    palaces: { type: 'array', items: { type: 'object', additionalProperties: true } },
                    disclaimer: { type: 'string' },
                },
            },
        },
        isConcurrencySafe: true,
        async execute(args) {
            assertYmd(args);
            if (!Number.isInteger(args.hour) || args.hour < 0 || args.hour > 23) {
                throw new Error('hour 必须是 0–23 的整数（紫微以时辰定十二宫，缺时辰应先向用户询问）');
            }
            return computeZiwei(args);
        },
        render: (_args, v) => {
            const L = [];
            const m = v.meta;
            L.push(`【紫微斗数·${m.action === 'fortune' ? '运限层' : '本命盘'}】${m.solar}（${m.calendar}）${m.hourZhi}时｜农历 ${m.lunar}｜${m.gender}命`);
            for (const note of m.notes ?? []) L.push(`ℹ ${note}`);
            L.push(`命主 ${v.soul}｜身主 ${v.body}｜五行局 ${v.fiveElementsClass}`);

            if (m.action === 'fortune' && v.fortune) {
                const f = v.fortune;
                const ringLine = (label, r) => {
                    const mut = r.mutagen;
                    const extra = label === '小限' ? `虚岁 ${r.nominalAge}，` : label === '大限' && r.ageRange ? `${r.ageRange[0]}–${r.ageRange[1]} 岁，` : '';
                    return `· ${label}（${r.stemBranch}）｜${extra}命宫落原局「${r.mingPalace}」｜四化：${mut.lu}禄 ${mut.quan}权 ${mut.ke}科 ${mut.ji}忌`;
                };
                L.push('');
                L.push(`基准日：${m.fortuneDate}`);
                L.push(ringLine('大限', f.decadal));
                L.push(ringLine('流年', f.yearly));
                L.push(ringLine('小限', f.xiaoXian));
                L.push('');
                L.push('流年十二宫重排（本命宫位 → 流年宫名）：');
                L.push(f.yearly.palaceNames.map((n, i) => `${v.natalPalaces[i]?.palace ?? i}→${n}`).join('　'));
                L.push('');
                L.push('解读要求：流年四化照工具返回念（禄权科忌四星），大限定基调、流年定事项、小限作参照；三环结论冲突时分层列证不要强行调和；末尾附免责声明。');
                L.push(DISCLAIMER);
                return textBlock(L.join('\n'));
            }

            L.push('');
            L.push('十二宫（生年四化标注在星后：禄/权/科/忌）：');
            for (const p of v.palaces) {
                const majors = p.majorStars.length > 0
                    ? p.majorStars.map((s) => `${s.name}${s.brightness ? `(${s.brightness})` : ''}${s.mutagen ? `化${s.mutagen}` : ''}`).join(' ')
                    : '空宫';
                const minors = p.minorStars.length > 0 ? `｜辅 ${p.minorStars.join(' ')}` : '';
                const tags = [
                    p.isBodyPalace ? '身宫' : null,
                    p.isOriginalPalace ? '来因宫' : null,
                ].filter(Boolean).join('/');
                L.push(`· ${p.palace}宫 ${p.stemBranch}｜${majors}${minors}｜大限 ${p.decadal.start}–${p.decadal.end}${tags ? `｜${tags}` : ''}`);
            }
            L.push('');
            L.push('解读要求：以命宫/官禄/财帛/夫妻为主轴复述落宫事实，再给传统解读，然后给现实行动建议，末尾附免责声明。');
            L.push(DISCLAIMER);
            return textBlock(L.join('\n'));
        },
    });
}
