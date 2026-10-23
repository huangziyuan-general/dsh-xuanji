// lib/tools/bazi-tool.js — xuanji_bazi：八字排盘（四柱/五行/十神/大运/流年，纯本地计算）。

import { defineTool } from './define-tool.js';
import { textBlock, DISCLAIMER, assertYmd } from './common.js';
import { computeBazi } from '../engine/bazi.js';
import { resolveBirthTime } from '../engine/birth-time.js';

export function defineBaziTool(ctx, config) {
    return defineTool({
        name: 'xuanji_bazi',
        description: [
            '八字排盘（纯本地确定性计算，零模型推演）：给出公历或农历生日 + 时辰 + 性别，返回四柱干支（含纳音、',
            '地支藏干与藏干十神、每柱旬空、日主星运十二长生与各柱自坐）、日主、五行计数与简化旺衰、胎元/命宫/',
            '身宫/日柱旬空、原局地支刑冲合会（三合/半合/六合/六冲/六害/三刑/对刑/自刑，传统通行口径）、常用神煞',
            '（天乙/文昌/太极/金舆/国印/桃花/驿马/华盖/将星/羊刃/红鸾天喜/孤辰寡宿/天德月德及其合/劫煞灾煞亡神',
            '等 21 种，带落柱与起法）、起运时间与大运列表（含起止年份与干支十神）、当年明年流年干支与十神。',
            '性别必填（大运顺逆由性别与年干决定）；时辰未知时可省略 hour（此时只排三柱并标注，神煞按三柱查）。',
            '时间口径：自动校正 1986–1991 中国夏令时；给 city 或 longitude 时按真太阳时排盘（经度差+均时差）；',
            '晚子时（23:00–24:00）默认按次日日柱（流派默认，宿主配置 ziShi=2 可切换为当日）。所有口径调整都会',
            '在 meta.notes 里说明。排出的数字是唯一事实来源——解读必须引用本工具返回值，绝不自行推算干支。',
        ].join(''),
        parameters: {
            year: { type: 'integer', required: true, description: '出生年份，如 1990。' },
            month: { type: 'integer', required: true, description: '出生月份（calendar=solar 时为公历月；lunar 时为农历月）。' },
            day: { type: 'integer', required: true, description: '出生日。' },
            hour: { type: 'integer', description: '出生小时（0–23，24 小时制）；缺省视为时辰未知，只排三柱。' },
            minute: { type: 'integer', description: '出生分钟（0–59），缺省 0。' },
            gender: { type: 'string', required: true, enum: ['male', 'female'], description: '性别（决定大运顺逆），必填。' },
            calendar: { type: 'string', enum: ['solar', 'lunar'], description: '输入历法：solar=公历（默认），lunar=农历。' },
            isLeapMonth: { type: 'boolean', description: 'calendar=lunar 时：是否闰月。' },
            applyDST: { type: 'boolean', description: '是否自动校正 1986–1991 中国夏令时（默认 true；出生证时间为真实太阳口径时传 false）。' },
            city: { type: 'string', description: '出生城市（真太阳时校正用，内置城市表如 成都/乌鲁木齐）；与 longitude 二选一，都省略则按钟面时间排盘。' },
            longitude: { type: 'number', description: '出生地经度（东经为正，如成都 104.07）；与 city 二选一。' },
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: true,
                properties: {
                    meta: { type: 'object', additionalProperties: true },
                    dayMaster: { type: 'object', additionalProperties: true },
                    pillars: { type: 'object', additionalProperties: true },
                    wuxing: { type: 'object', additionalProperties: true },
                    strength: { type: 'object', additionalProperties: true },
                    shenSha: { type: 'object', additionalProperties: true },
                    qiYun: { type: 'object', additionalProperties: true },
                    daYun: { type: 'array', items: { type: 'object', additionalProperties: true } },
                    liuNian: { type: 'array', items: { type: 'object', additionalProperties: true } },
                    disclaimer: { type: 'string' },
                },
            },
        },
        isConcurrencySafe: true,
        async execute(args) {
            assertYmd(args);
            if (args.hour !== undefined && (!Number.isInteger(args.hour) || args.hour < 0 || args.hour > 23)) {
                throw new Error('hour 必须是 0–23 的整数（24 小时制），或完全省略表示时辰未知');
            }
            // 统一时间管线：历法归一 → 夏令时 → 真太阳时（notes 记录全部口径说明）
            const rt = resolveBirthTime(args);
            const result = computeBazi({
                year: rt.solar.year, month: rt.solar.month, day: rt.solar.day,
                hour: rt.hour ?? 12, minute: rt.minute,
                gender: args.gender, calendar: 'solar',
                timeKnown: rt.timeKnown, notes: rt.notes,
            }, config);
            if (!rt.timeKnown) result.meta.timeKnown = false;
            result.meta.calendar = args.calendar === 'lunar' ? '农历' : '公历';
            return result;
        },
        render: (_args, v) => {
            const L = [];
            const m = v.meta;
            L.push(`【八字排盘】${m.solar}（${m.calendar}）｜农历 ${m.lunar}｜${m.shengXiao}年｜${m.gender}命`);
            if (!m.timeKnown) L.push('⚠ 时辰未知：以上为三柱（年月日），请向用户补问时辰后重排，时柱暂缺。');
            for (const note of m.notes ?? []) L.push(`ℹ ${note}`);
            if (m.lateZiNote) L.push(`ℹ ${m.lateZiNote}`);
            if (m.yearScopeNote) L.push(`ℹ ${m.yearScopeNote}`);
            const P = v.pillars;
            const four = [
                ['年柱', P.year], ['月柱', P.month], ['日柱', P.day], ['时柱', P.hour],
            ].filter(([, p]) => p);
            L.push('');
            L.push('四柱：');
            for (const [label, p] of four) {
                const cang = p.cangGan.map((c) => `${c.gan}(${c.shiShen})`).join('、');
                L.push(`· ${label} ${p.ganZhi}｜${p.yinYang}${p.wuxing.gan}＋${p.wuxing.zhi}｜纳音_${p.naYin ?? ''}｜十神_${p.shiShenGan}｜星运_${p.xingYun}（自坐${p.ziZuo}）｜旬空_${p.xunKong}｜藏干 ${cang}`);
            }
            L.push('');
            L.push('刑冲合会（原局地支关系，传统通行口径）：');
            if (v.zhiRelations.length > 0) {
                for (const r of v.zhiRelations) L.push(`· ${r.text}（${r.type}）`);
            } else {
                L.push('· 四柱地支间无明显刑冲合会');
            }
            L.push('');
            L.push(`日主：${v.dayMaster.gan}（${v.dayMaster.yinYang}${v.dayMaster.wuxing}）`);
            L.push(`五行：${v.wuxing.summary}`);
            L.push(`旺衰（简化）：${v.strength.state}（得令=${v.strength.deLing ? '是' : '否'}，日主+生我计数 ${v.strength.score}/8）；喜用倾向：${v.strength.favorable}`);
            L.push(`神煞宫位：胎元 ${v.shenSha.taiYuan}｜命宫 ${v.shenSha.mingGong}｜身宫 ${v.shenSha.shenGong}${v.shenSha.xunKong ? `｜日柱旬空 ${v.shenSha.xunKong}` : ''}`);
            if (v.geju?.geju || v.geju?.suGe) {
                L.push(`格局：${v.geju.geju ?? v.geju.suGe}（${v.geju.note}）`);
            }
            if (v.shenSha.stars?.length > 0) {
                L.push('神煞（传统通行查表口径，仅作解读引导，不参与旺衰判定；「宜留意」类已附中性释义，转述时请用释义而非类型名）：');
                for (const s of v.shenSha.stars) {
                    L.push(`· ${s.name}（${s.type}）——${s.soft}；落${s.hits.map((h) => `${h.pillar}${h.char}`).join('、')}｜起法：${s.rule}`);
                }
            } else {
                L.push('神煞：本盘未查出常用神煞落柱。');
            }
            L.push(`起运：${v.qiYun.text}`);
            L.push(`大运：${v.daYun.map((d) => `${d.startAge}岁 ${d.ganZhi}（${d.startYear}–${d.endYear}，${d.shiShenGan}/${d.shiShenZhi}）`).join('　')}`);
            L.push(`流年：${v.liuNian.map((l) => `${l.year} ${l.ganZhi}（${l.shiShenGan}）`).join('　')}`);
            L.push('');
            // 对盘速览：单行可复制/截屏，便于用户与问真排盘等外部软件逐字核对
            L.push(`对盘速览：公历 ${m.solar.slice(0, 10)} ${String(m.solar.slice(11, 16) ?? '')}｜农历 ${m.lunar}${m.timeKnown ? ` ${m.timeZhi}时` : '（时辰未知）'}｜四柱 ${four.map(([, p]) => p.ganZhi).join(' ')}｜${m.gender}命（${m.calendar}输入）`);
            L.push('');
            L.push(`解读要求：先复述排盘事实，再给传统解读，然后给现实行动建议，末尾附免责声明。`);
            L.push(DISCLAIMER);
            return textBlock(L.join('\n'));
        },
    });
}
