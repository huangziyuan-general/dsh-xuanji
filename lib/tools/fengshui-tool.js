// lib/tools/fengshui-tool.js — xuanji_fengshui：风水（八宅命卦 + 流年九宫飞星 + 宅卦门主灶，纯本地确定性）。

import { defineTool } from './define-tool.js';
import { textBlock, DISCLAIMER, assertYmd } from './common.js';
import { computeFengshui } from '../engine/fengshui.js';

export function defineFengshuiTool() {
    return defineTool({
        name: 'xuanji_fengshui',
        description: [
            '风水（纯本地确定性计算）。action=natal（默认）：① 八宅命卦——给出生年月日 + 性别，算命卦（东四/西四命）、',
            '大游年四吉方（生气/延年/天医/伏位）与四凶方落位，命卦年份按立春界；② 流年九宫飞星——年家紫白入中顺飞',
            '九宫盘（可指定 fortuneYear）。action=advise：③ 门主灶布局——给房屋坐山或向山（罗盘 24 山，如',
            '「坐北朝南」=坐子向午），推宅卦与宅之八星盘，给门/灶/主卧/厕所布局倾向；给生辰时加算命宅配（东西四同组',
            '与否及调停法）。坐向不自洽（非对宫）会报错。适用：问「我的吉方位」「今年九宫飞星」「东四命还是西四命」',
            '「这个坐向门主灶怎么布置」。不做现场勘舆结论，只到布局倾向层面。',
        ].join(''),
        parameters: {
            action: { type: 'string', enum: ['natal', 'advise'], description: 'natal=命卦+流年飞星（默认）；advise=宅卦门主灶布局。' },
            year: { type: 'integer', description: '出生年份（natal 必填；advise 可选，给出加命宅配）。' },
            month: { type: 'integer', description: '出生月份（calendar=solar 为公历月；lunar 为农历月）。' },
            day: { type: 'integer', description: '出生日。' },
            gender: { type: 'string', enum: ['male', 'female'], description: '性别（男女命卦算法不同；natal 必填）。' },
            calendar: { type: 'string', enum: ['solar', 'lunar'], description: '输入历法：solar=公历（默认），lunar=农历。' },
            isLeapMonth: { type: 'boolean', description: 'calendar=lunar 时：是否闰月。' },
            applyDST: { type: 'boolean', description: '是否自动校正 1986–1991 中国夏令时（默认 true）。' },
            fortuneYear: { type: 'integer', description: '流年飞星的目标年份，缺省为今年（action=natal）。' },
            sitting: { type: 'string', description: 'action=advise：房屋坐山（24 山之一，如 子/午/乾）。与 facing 至少给一个。' },
            facing: { type: 'string', description: 'action=advise：房屋向山（24 山之一）。缺坐山时按对宫反推。' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: true,
                properties: {
                    meta: { type: 'object', additionalProperties: true },
                    mingGua: { type: 'object', additionalProperties: true },
                    luckyDirections: { type: 'array', items: { type: 'object', additionalProperties: true } },
                    unluckyDirections: { type: 'array', items: { type: 'object', additionalProperties: true } },
                    yearlyFlying: { type: 'object', additionalProperties: true },
                    houseStars: { type: 'array', items: { type: 'object', additionalProperties: true } },
                    layout: { type: 'object', additionalProperties: true },
                    mingMatch: { type: 'object', additionalProperties: true },
                    sources: { type: 'array', items: { type: 'string' } },
                    disclaimer: { type: 'string' },
                },
            },
        },
        isConcurrencySafe: true,
        async execute(args) {
            if (args.action === 'advise') return computeFengshui(args);
            // natal：生辰 + 性别必填（缺输入先问，不代填）——required 校验上移到这里，
            // 因为 advise 模式下生辰是可选项（只影响命宅配）。
            const missing = ['year', 'month', 'day'].filter((k) => !Number.isInteger(args[k]));
            if (missing.length > 0) {
                throw new Error(`缺少必要输入：${missing.join('/')}（出生年月日）——按插件纪律应向用户询问，不要代填。`);
            }
            if (args.gender !== 'male' && args.gender !== 'female') {
                throw new Error("缺少必要输入：gender（'male' | 'female'）——男女命卦算法不同，请向用户询问，不要代填。");
            }
            assertYmd(args);
            return computeFengshui(args);
        },
        render: (_args, v) => {
            if (v.meta.action === 'advise') return renderAdvise(v);
            const L = [];
            L.push(`【风水·八宅】${v.meta.birth}（${v.meta.gender}命，节气年 ${v.meta.guaYear}）`);
            L.push(`命卦 ${v.mingGua.gua}（${v.mingGua.direction}，${v.mingGua.group}）｜${v.mingGua.compatible}`);
            L.push('');
            L.push('四吉方：');
            for (const d of v.luckyDirections) L.push(`· ${d.star}位：${d.direction}（${d.palace}宫）`);
            L.push('四凶方：');
            for (const d of v.unluckyDirections) L.push(`· ${d.star}位：${d.direction}（${d.palace}宫）`);
            L.push('');
            L.push(`【流年九宫飞星·${v.meta.fortuneYear}】${v.yearlyFlying.centerName}入中`);
            const grid = ['巽', '离', '坤', '震', '中', '兑', '艮', '坎', '乾'];
            const byPalace = Object.fromEntries(v.yearlyFlying.palaces.map((p) => [p.palace, p]));
            for (let row = 0; row < 3; row++) {
                L.push(grid.slice(row * 3, row * 3 + 3).map((g) => {
                    const p = byPalace[g];
                    return g === '中' ? p.name : `${g}宫 ${p.name}(${p.star})`;
                }).join(' ｜ '));
            }
            const luckyStars = v.yearlyFlying.palaces.filter((p) => p.lucky && p.palace !== '中').map((p) => `${p.direction}${p.name}`);
            const wuhuang = v.yearlyFlying.palaces.find((p) => p.num === 5);
            L.push(`当年吉星落位：${luckyStars.join('、')}${wuhuang ? `｜五黄在${wuhuang.direction}（传统宜静不宜动）` : ''}`);
            L.push('');
            L.push(`口径出处：${v.sources.join('；')}`);
            L.push('解读要求：吉方用于坐卧办公朝向的倾向建议，凶方讲「宜静不宜动」即可，不渲染凶煞恐吓；末尾附免责声明。');
            L.push(DISCLAIMER);
            return textBlock(L.join('\n'));
        },
    });
}

/** action=advise 渲染：宅卦八星盘 + 门主灶厕 + 命宅配。 */
function renderAdvise(v) {
    const L = [];
    L.push(`【风水·宅卦布局】坐${v.meta.sitting}｜向${v.meta.facing}`);
    L.push(`宅卦 ${v.meta.houseGua}（${v.meta.houseGroup}）`);
    L.push('');
    L.push('宅之八星盘：');
    for (const s of v.houseStars) L.push(`· ${s.star}位：${s.direction}（${s.palace}宫）——${s.role}`);
    L.push('');
    L.push('布局倾向（门主灶厕）：');
    L.push(`· 门：${v.layout.door}`);
    L.push(`· 灶：${v.layout.stove}`);
    L.push(`· 主卧：${v.layout.bed}`);
    L.push(`· 厕：${v.layout.toilet}`);
    if (v.mingMatch) {
        L.push('');
        L.push(`【命宅配】${v.mingMatch.birth}（${v.mingMatch.gender}命）：${v.mingMatch.mingGua.gua}卦（${v.mingMatch.mingGua.group}）× 宅卦 ${v.mingMatch.houseGua.gua}（${v.mingMatch.houseGua.group}）`);
        L.push(v.mingMatch.text);
    } else if (v.meta.birthNote) {
        L.push('');
        L.push(v.meta.birthNote);
    }
    L.push('');
    L.push(`口径出处：${v.sources.join('；')}`);
    L.push('解读要求：只讲布局倾向与「宜静不宜动」，不渲染凶煞恐吓；坐向以用户自报读数为准，如需精确可请专业人士实测；末尾附免责声明。');
    L.push(DISCLAIMER);
    return textBlock(L.join('\n'));
}
