// lib/engine/match.js — 八字合婚确定性引擎（传统通行口径，纯本地）。
// 只输出确定性事实（属相关系/日主生克/年命纳音）+ 简化综合分档；
// 不做「必配/必离」式断言，裁量权交还用户。三才五格、神煞合参等不在口径内。

import lunarPkg from 'lunar-javascript';
import { GAN, ZHI, GAN_WUXING, SHENG, KE, tenGod } from './tables.js';
import { resolveBirthTime } from './birth-time.js';

const { Solar } = lunarPkg;

/** 单人四柱精简排盘（无大运，性别不参与计算；晚子时按次日日柱主流口径）。
 *  统一时间管线：历法归一 → 夏令时 →（match 无 city 参数，不做真太阳时），与 xuanji_bazi 口径对齐。 */
function fourPillars(birth, ziShi = 1) {
    if (!birth || !Number.isInteger(birth.year) || !Number.isInteger(birth.month) || !Number.isInteger(birth.day)) {
        throw new Error('缺少必要输入：双方出生年月日——按插件纪律应向用户询问，不要代填。');
    }
    const rt = resolveBirthTime(birth); // hour 缺省时 timeKnown=false，时柱不排
    const hour = rt.timeKnown ? rt.hour : 12;
    const solar = Solar.fromYmdHms(rt.solar.year, rt.solar.month, rt.solar.day, hour, rt.minute, 0);
    const lunar = solar.getLunar();
    const ec = lunar.getEightChar();
    // 晚子时口径与 xuanji_bazi 一致（库 setSect 1=次日/2=当日，与插件 ziShi 同向，直接透传）。
    ec.setSect(ziShi);
    const pillars = {
        year: ec.getYear(), month: ec.getMonth(), day: ec.getDay(),
        ...(rt.timeKnown ? { hour: ec.getTime() } : {}),
    };
    // 生肖统一按八字年支（立春界）推导：合婚主判用年支，若再混用农历生肖（春节界），
    // 立春→春节这段窗口会出现「属蛇（午）」这类自相矛盾的输出。两者不同时如实标注。
    const yearZhi = pillars.year[1];
    const shengXiao = SHENGXIAO_BY_ZHI[ZHI.indexOf(yearZhi)];
    const lunarShengXiao = lunar.getYearShengXiao();
    const notes = [...rt.notes];
    if (lunarShengXiao !== shengXiao) {
        notes.push(`生肖口径：农历生肖按春节界为「${lunarShengXiao}」，八字年支按立春界为「${shengXiao}」；合婚以年支为准取「${shengXiao}」`);
    }
    return {
        solar: solar.toYmd().slice(0, 10),
        shengXiao,
        yearGanZhi: pillars.year,
        dayGanZhi: pillars.day,
        naYinYear: ec.getYearNaYin(),
        naYinDay: ec.getDayNaYin(),
        pillars,
        notes,
    };
}

/** 地支关系表（传统通行口径）。 */
const LIU_HE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
const SAN_HE_GROUPS = [['申', '子', '辰'], ['寅', '午', '戌'], ['巳', '酉', '丑'], ['亥', '卯', '未']];
const LIU_CHONG = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
const LIU_HAI = { 子: '未', 未: '子', 丑: '午', 午: '丑', 寅: '巳', 巳: '寅', 卯: '辰', 辰: '卯', 申: '亥', 亥: '申', 酉: '戌', 戌: '酉' };
// 相刑必须是对称关系：寅巳申、丑戌未任取两支皆刑，子卯互刑；辰午酉亥为「自刑」（两支相同才算）。
// 早先写成单向环形映射（子→卯、寅→巳、巳→申…），导致交换双方顺序会漏判，故改为集合形式，与 bazi.js 的 SAN_XING 保持一致口径。
const XIANG_XING = {
    寅: ['巳', '申'], 巳: ['寅', '申'], 申: ['寅', '巳'],
    丑: ['未', '戌'], 未: ['丑', '戌'], 戌: ['丑', '未'],
    子: ['卯'], 卯: ['子'],
};
const ZI_XING = ['辰', '午', '酉', '亥'];

const elOf = (gan) => GAN_WUXING[GAN.indexOf(gan)];

/** 地支 ↔ 生肖（子鼠起，与地支序同序）。合婚一律以八字年支（立春界）为准。 */
const SHENGXIAO_BY_ZHI = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];

/** 五行关系 A→B（按日主天干）：比和/我生/我克/生我/克我。 */
function ganRelation(a, b) {
    const ea = elOf(a);
    const eb = elOf(b);
    if (ea === eb) return { relation: '比和', text: `${ea}与${eb}同气` };
    if (SHENG[ea] === eb) return { relation: '我生', text: `${ea}生${eb}` };
    if (KE[ea] === eb) return { relation: '我克', text: `${ea}克${eb}` };
    if (SHENG[eb] === ea) return { relation: '生我', text: `${eb}生${ea}` };
    if (KE[eb] === ea) return { relation: '克我', text: `${eb}克${ea}` };
    return { relation: '比和', text: `${ea}与${eb}` };
}

/** 纳音五行（取纳音名首字的五行归属）：海中金→金 等通行映射。 */
function naYinElement(naYin) {
    if (!naYin) return null;
    const m = { 金: '金', 木: '木', 水: '水', 火: '火', 土: '土' };
    for (const [el, tag] of Object.entries(m)) {
        if (naYin.endsWith(el)) return tag;
    }
    return null;
}

/**
 * 八字合婚主函数。
 * @param {{a:{year,month,day,hour?,calendar?,isLeapMonth?,label?}, b:{...}, ziShi?:1|2}} input
 *  双方各给出生年月日（时辰可选，只影响本人时柱，不参与合参主判）。
 */
export function computeMatch(input) {
    const ziShi = input.ziShi === 2 ? 2 : 1;
    const a = fourPillars(input.a ?? {}, ziShi);
    const b = fourPillars(input.b ?? {}, ziShi);
    const rawA = (input.a && input.a.label) || '甲方';
    const rawB = (input.b && input.b.label) || '乙方';
    // 称谓是 meta 的键，两边填同一个词时后者会静默覆盖前者——用户的「男方/男方」
    // 会让一方的生辰从输出里整个消失（AUDIT P2-7）。不猜谁是谁，只自动加序位后缀并说明。
    let labelA = rawA;
    let labelB = rawB;
    let labelNote = null;
    if (rawA === rawB) {
        labelA = `${rawA}（甲）`;
        labelB = `${rawB}（乙）`;
        labelNote = `双方称谓同为「${rawA}」：meta 以称谓为键会互相覆盖，已自动加成「${labelA}」「${labelB}」两栏保留双方数据。如需可辨识称谓请分别填写。`;
    }
    const ya = a.yearGanZhi[1];
    const yb = b.yearGanZhi[1];
    const relations = [];

    // ── 属相关系（年支对年支）──
    if (ya === yb) {
        relations.push({ kind: '属相', rel: '同属相', text: `双方同属${a.shengXiao}（${ya}）`, tone: '中性' });
    }
    if (LIU_HE[ya] === yb) relations.push({ kind: '属相', rel: '六合', text: `${a.shengXiao}(${ya})与${b.shengXiao}(${yb})六合`, tone: '吉' });
    if (SAN_HE_GROUPS.some((g) => g.includes(ya) && g.includes(yb) && ya !== yb)) {
        relations.push({ kind: '属相', rel: '三合', text: `${a.shengXiao}(${ya})与${b.shengXiao}(${yb})三合`, tone: '吉' });
    }
    if (LIU_CHONG[ya] === yb) relations.push({ kind: '属相', rel: '六冲', text: `${a.shengXiao}(${ya})与${b.shengXiao}(${yb})六冲`, tone: '凶' });
    if (LIU_HAI[ya] === yb) relations.push({ kind: '属相', rel: '六害', text: `${a.shengXiao}(${ya})与${b.shengXiao}(${yb})六害`, tone: '凶' });
    if (XIANG_XING[ya]?.includes(yb)) {
        relations.push({ kind: '属相', rel: '相刑', text: `${a.shengXiao}(${ya})与${b.shengXiao}(${yb})相刑`, tone: '凶' });
    } else if (ya === yb && ZI_XING.includes(ya)) {
        relations.push({ kind: '属相', rel: '自刑', text: `双方同为${a.shengXiao}(${ya})，${ya}${ya}自刑`, tone: '凶' });
    }

    // ── 日主生克（双方日干，通行以日主论我）──
    const ab = ganRelation(a.dayGanZhi[0], b.dayGanZhi[0]);
    const ba = ganRelation(b.dayGanZhi[0], a.dayGanZhi[0]);
    relations.push({ kind: '日主', rel: `${a.dayGanZhi[0]}→${b.dayGanZhi[0]}`, text: `${labelA}日主${a.dayGanZhi[0]}对${labelB}日主${b.dayGanZhi[0]}：${ab.text}（${ab.relation}）`, tone: ab.relation === '我克' || ab.relation === '克我' ? '中性' : '吉' });
    relations.push({ kind: '日主', rel: `${b.dayGanZhi[0]}→${a.dayGanZhi[0]}`, text: `${labelB}日主${b.dayGanZhi[0]}对${labelA}日主${a.dayGanZhi[0]}：${ba.text}（${ba.relation}）`, tone: ba.relation === '我克' || ba.relation === '克我' ? '中性' : '吉' });
    // 天干五合（甲己 乙庚 丙辛 丁壬 戊癸）
    const WU_HE = { 甲: '己', 己: '甲', 乙: '庚', 庚: '乙', 丙: '辛', 辛: '丙', 丁: '壬', 壬: '丁', 戊: '癸', 癸: '戊' };
    if (WU_HE[a.dayGanZhi[0]] === b.dayGanZhi[0]) {
        relations.push({ kind: '日主', rel: '天干五合', text: `双方日主${a.dayGanZhi[0]}与${b.dayGanZhi[0]}天干五合`, tone: '吉' });
    }

    // ── 双向十神映射（对方日干在我方盘中的十神角色，及反向；给合参「角色」信息，不跨层加总定吉凶）──
    const dayGanA = a.dayGanZhi[0];
    const dayGanB = b.dayGanZhi[0];
    const godAB = tenGod(dayGanA, dayGanB); // 对方日干在 甲 盘里的十神
    const godBA = tenGod(dayGanB, dayGanA); // 甲日干在 乙 盘里的十神
    relations.push({
        kind: '双向十神', rel: '十神映射',
        text: `${labelA}（日主${dayGanA}）视${labelB}日主${dayGanB}为「${godAB}」；${labelB}（日主${dayGanB}）视${labelA}日主${dayGanA}为「${godBA}」`,
        tone: (godAB === '七杀' || godBA === '七杀') ? '中性' : '吉',
    });

    // ── 跨盘三合/半合（双方年支+日支交叉成局，补单盘内三合之外的合会信息；与 bazi.js 同口径：三合需三支齐全，半合须含中神子午卯酉）──
    const SANHE_MID = ['子', '午', '卯', '酉'];
    const crossZhi = [ya, yb, ...(a.pillars.day ? [a.pillars.day[1]] : []), ...(b.pillars.day ? [b.pillars.day[1]] : [])];
    for (const group of SAN_HE_GROUPS) {
        const hasAll = group.filter((g) => crossZhi.includes(g));
        if (hasAll.length === 3) {
            relations.push({ kind: '跨盘三合', rel: '三合局', text: `双方年支/日支共见${group.join('')}三合局`, tone: '吉' });
        } else if (hasAll.length === 2 && hasAll.some((g) => SANHE_MID.includes(g))) {
            relations.push({ kind: '跨盘三合', rel: '半合', text: `双方年支/日支见${hasAll.join('、')}半合（缺${group.find((g) => !hasAll.includes(g))}，半合之力较缓）`, tone: '吉' });
        }
    }
    // 跨盘六合（只报跨盘两向：A日支×B年支、B日支×A年支；同盘日支×年支属单盘信息不在此报，
    // 年支×年支已在属相关系里报过。文案标签与支值必须同侧——labelA 配 ya、labelB 配 yb）
    if (a.pillars.day && LIU_HE[a.pillars.day[1]] === yb) {
        relations.push({ kind: '跨盘六合', rel: '六合', text: `${labelA}日支${a.pillars.day[1]}与${labelB}年支${yb}六合`, tone: '吉' });
    }
    if (b.pillars.day && LIU_HE[b.pillars.day[1]] === ya) {
        relations.push({ kind: '跨盘六合', rel: '六合', text: `${labelB}日支${b.pillars.day[1]}与${labelA}年支${ya}六合`, tone: '吉' });
    }

    // ── 年命纳音（传统合婚以年柱纳音论「年命」）──
    const na = naYinElement(a.naYinYear);
    const nb = naYinElement(b.naYinYear);
    if (na && nb) {
        const r = ganRelation(GAN.find((g) => elOf(g) === na) ?? '甲', GAN.find((g) => elOf(g) === nb) ?? '甲');
        relations.push({
            kind: '年命纳音', rel: r.relation,
            text: `${labelA}年命${a.naYinYear}（${na}）对${labelB}年命${b.naYinYear}（${nb}）：${na}与${nb}${r.relation === '比和' ? '同气' : r.text}`,
            tone: r.relation === '我克' || r.relation === '克我' ? '中性' : '吉',
        });
    }

    // ── 简化综合分档（吉象与凶象计数，启发式仅供排序引导）──
    const lucky = relations.filter((r) => r.tone === '吉').length;
    const unlucky = relations.filter((r) => r.tone === '凶').length;
    let verdict;
    if (unlucky === 0 && lucky >= 2) verdict = { verdict: '上', text: '吉象多而无冲刑，传统口径下相处底子顺；具体还要看两人怎么经营。' };
    else if (unlucky === 0) verdict = { verdict: '中上', text: '无冲刑害，关系平和；吉象一般，属「处得来」的搭配。' };
    else if (unlucky <= 1) verdict = { verdict: '中', text: '有一组冲/刑/害：传统口径视为「摩擦点多」，不等于不合——把摩擦点讲给双方知道，各自留意即可。' };
    else verdict = { verdict: '需磨合', text: '冲刑害多于吉象：传统口径下摩擦面较大，需要双方更多自觉经营；这不是「不能在一起」的判词。' };

    return {
        meta: {
            [labelA]: `${a.solar}（属${a.shengXiao}，日柱 ${a.dayGanZhi}）`,
            [labelB]: `${b.solar}（属${b.shengXiao}，日柱 ${b.dayGanZhi}）`,
            ...(labelNote ? { labelNote } : {}),
            ...(Number.isInteger(input.a?.hour) ? {} : { aNote: `${labelA}时辰未给：时柱未参与合参（合婚主判用年支与日柱，不影响主结论）` }),
            ...(Number.isInteger(input.b?.hour) ? {} : { bNote: `${labelB}时辰未给：时柱未参与合参（合婚主判用年支与日柱，不影响主结论）` }),
            ...(a.notes.length > 0 ? { aTimeNotes: a.notes } : {}),
            ...(b.notes.length > 0 ? { bTimeNotes: b.notes } : {}),
        },
        relations,
        verdict: { ...verdict, note: '简化判定（吉凶象计数法），仅供排序引导，非任何流派的定量结论' },
        sources: [
            '属相关系：六合/三合/六冲/六害/相刑（传统通行查表口径）',
            '日主生克与天干五合：五行生克通行口径',
            '年命纳音：年柱纳音五行生克（传统合婚通行口径）',
            '综合分档：吉凶象计数简化判定',
        ],
        disclaimer: '合婚为传统民俗口径的本地计算，属文化参考；感情好坏在两人经营，不构成婚恋决策依据，仅供娱乐。',
    };
}
