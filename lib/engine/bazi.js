// lib/engine/bazi.js — 八字排盘确定性引擎（纯本地，零模型调用）。
// 干支/纳音/十神/大运等全部事实来自 lunar-javascript 的节气精确历法计算，
// 本模块只做组装与简化判定；模型不得自行推演任何干支数值。

import lunarPkg from 'lunar-javascript';
import {
    GAN, ZHI, GAN_WUXING, GAN_YINYANG, ZHI_WUXING, ZHI_CANGGAN,
    SHENG, tenGod, JIAZI, yearGanZhi, wuxingSummary, xunKongOf, CHANG_SHENG,
} from './tables.js';
import { computeShenShaStars } from './shensha.js';
import { determineGeju } from './geju.js';

const { Solar, Lunar } = lunarPkg;

/**
 * 输入解析：公历或农历生日 → Solar 对象。
 * @param {{ year:number, month:number, day:number, hour?:number, minute?:number,
 *            calendar?:'solar'|'lunar', isLeapMonth?:boolean }} input
 */
function toSolar(input) {
    const hour = input.hour ?? 12;
    const minute = input.minute ?? 0;
    if (input.calendar === 'lunar') {
        const m = input.isLeapMonth ? -Math.abs(input.month) : input.month;
        return Lunar.fromYmdHms(input.year, m, input.day, hour, minute, 0).getSolar();
    }
    return Solar.fromYmdHms(input.year, input.month, input.day, hour, minute, 0);
}

/**
 * 单柱组装：干支 + 纳音 + 天干十神（对日干）+ 地支藏干（含各藏干十神）。
 * naYin 由调用方按柱位传入（ec.getXNaYin()）。
 */
function pillar(ec, pick, dayGan, { withTenGod, naYin }) {
    const ganZhi = pick();
    const gan = ganZhi[0];
    const zhi = ganZhi[1];
    const cangGan = ZHI_CANGGAN[zhi].map((g) => ({
        gan: g,
        wuxing: GAN_WUXING[GAN.indexOf(g)],
        ...(withTenGod ? { shiShen: tenGod(dayGan, g) } : {}),
    }));
    return {
        ganZhi,
        gan,
        zhi,
        wuxing: { gan: GAN_WUXING[GAN.indexOf(gan)], zhi: ZHI_WUXING[ZHI.indexOf(zhi)] },
        yinYang: GAN_YINYANG[GAN.indexOf(gan)],
        naYin,
        xunKong: xunKongOf(ganZhi),
        xingYun: CHANG_SHENG[dayGan][zhi],
        ziZuo: CHANG_SHENG[gan][zhi],
        cangGan,
        ...(withTenGod ? { shiShenGan: gan === dayGan ? '日主' : tenGod(dayGan, gan) } : {}),
    };
}

/** 五行计数：天干五行 + 地支本气五行（藏干不计入主计数，另列 cangGan 供细看）。 */
function countWuxing(pillars) {
    const counts = { 金: 0, 木: 0, 水: 0, 火: 0, 土: 0 };
    for (const p of pillars) {
        counts[p.wuxing.gan] += 1;
        counts[p.wuxing.zhi] += 1;
    }
    return counts;
}

/**
 * 简化旺衰与喜用倾向（启发式，仅供引导解读，不冒充流派结论）：
 * · 得令：日主五行与月支本气五行相同，或月支本气生日主；
 * · 得势：日主五行 + 生我五行 的干支本气计数 ≥ 4；
 * · 偏强 → 喜克泄耗（官杀/食伤/财），偏弱 → 喜生扶（印/比劫），中和 → 五行调和为上。
 *
 * 另外给出 **boundary**（边界盘）标记：这套判据只看一个整数计数，
 * 计数差 1 就换档，而换档会让 trend.js 整套十神计分表**符号相反**地翻转。
 * 实测同月相邻两天出生的盘，19 次里 13 次翻态、40 年 K 线相关系数 −0.33——
 * 与其把这种盘伪装成可信趋势，不如显式告诉用户「本盘旺衰落在判据边界上」。
 */
function strengthHint(dayGan, monthZhi, counts) {
    const dayEl = GAN_WUXING[GAN.indexOf(dayGan)];
    const monthEl = ZHI_WUXING[ZHI.indexOf(monthZhi)];
    const motherEl = Object.entries(SHENG).find(([, v]) => v === dayEl)?.[0];
    const deLing = monthEl === dayEl || monthEl === motherEl;
    const score = counts[dayEl] + (motherEl ? counts[motherEl] : 0);
    const classify = (s, dl) => {
        if (s >= 4 && dl) return '偏强';
        if (s <= 2 || (!dl && s <= 3)) return '偏弱';
        return '中和';
    };
    const state = classify(score, deLing);
    // 计数 ±1 就换档 = 边界盘（含「多一个同类干支／少一个同类干支」两个方向）
    const boundary = classify(score + 1, deLing) !== state || classify(score - 1, deLing) !== state;
    let favorable;
    if (state === '偏强') {
        favorable = ['官杀（克我）', '食伤（我生）', '财星（我克）'].join('、');
    } else if (state === '偏弱') {
        favorable = ['印星（生我）', '比劫（同我）'].join('、');
    } else {
        favorable = '五行调和，顺势而为，缺哪类补哪类';
    }
    return {
        dayElement: dayEl, monthElement: monthEl, deLing, score, state, boundary, favorable,
        note: boundary
            ? '简化判定（得令+得势计数法）：本盘的日主/印星计数恰在换档边界上（±1 即改判），旺衰方向本身不确定——据此衍生的喜用、趋势只作参考，不要当成定论'
            : '简化判定（得令+得势计数法），仅作解读引导，非任何流派的定量结论',
    };
}

/** 流年：今年与明年（干支通用口径，立春切换点会单独提示）。 */
function liuNian(dayGan, nowYear) {
    return [nowYear, nowYear + 1].map((y) => {
        const gz = yearGanZhi(y);
        return {
            year: y,
            ganZhi: gz,
            shiShenGan: tenGod(dayGan, gz[0]),
            note: `${y} 年立春后才换${gz}年柱`,
        };
    });
}

/** 地支刑冲合会（原局地支两两/三支关系，传统通行口径）。 */
const ZHI_LIUHE = { 子: '丑', 丑: '子', 寅: '亥', 亥: '寅', 卯: '戌', 戌: '卯', 辰: '酉', 酉: '辰', 巳: '申', 申: '巳', 午: '未', 未: '午' };
const ZHI_CHONG = { 子: '午', 午: '子', 丑: '未', 未: '丑', 寅: '申', 申: '寅', 卯: '酉', 酉: '卯', 辰: '戌', 戌: '辰', 巳: '亥', 亥: '巳' };
const ZHI_HAI = { 子: '未', 未: '子', 丑: '午', 午: '丑', 寅: '巳', 巳: '寅', 卯: '辰', 辰: '卯', 申: '亥', 亥: '申', 酉: '戌', 戌: '酉' };
const SANHE_GROUPS = [['申', '子', '辰', '水'], ['寅', '午', '戌', '火'], ['巳', '酉', '丑', '金'], ['亥', '卯', '未', '木']];
const SANHE_MID = { 申: '子', 子: '子', 辰: '子', 寅: '午', 午: '午', 戌: '午', 巳: '酉', 酉: '酉', 丑: '酉', 亥: '卯', 卯: '卯', 未: '卯' };
const SAN_XING = { 寅: ['巳', '申'], 巳: ['申', '寅'], 申: ['寅', '巳'], 丑: ['戌', '未'], 戌: ['未', '丑'], 未: ['丑', '戌'], 子: ['卯'], 卯: ['子'] };
const ZI_XING = new Set(['辰', '午', '酉', '亥']);
const XING_NAME = { 寅巳申: '恃势之刑', 丑戌未: '无恩之刑', 子卯: '无礼之刑' };

/**
 * 原局地支刑冲合会扫描（确定性）。
 *
 * 判据一律按**不重复的地支集合**成立与否来判，出现次数只用来列举落柱。
 * 早先的实现把 `entries.filter(命中).length` 当「凑齐几支」用，数的是出现**次数**，
 * 于是同一个判据两个方向都错（两者都比漏报更糟——用户看不出来）：
 *  · 辰子未辰（无申）被凑成 3 次命中 → 凭空报出「申子辰三合水局」；
 *  · 子辰申辰（申子辰真齐全）命中 4 次 → 三合与半合双双漏报。
 * 三刑/对刑同理：未未戌丑 会退化成 5 条对刑、且丢掉「无恩之刑」的成组名。
 * 口径：三合需三支齐全，半合须同组两支且含中神，刑分三刑全见/两支对刑/自刑。
 * @param {object} pillars computeBazi 的 pillars
 * @returns {{type:string, tone:string, text:string}[]}
 */
function zhiRelations(pillars) {
    const P = { year: '年', month: '月', day: '日', hour: '时' };
    const ORDER = ['year', 'month', 'day', 'hour'];
    /** 支 → 落柱标签（按年月日时顺序、去重）。 */
    const byZhi = new Map();
    for (const k of ORDER) {
        const z = pillars[k]?.zhi;
        if (!z) continue;
        if (!byZhi.has(z)) byZhi.set(z, []);
        byZhi.get(z).push(P[k]);
    }
    const has = (z) => byZhi.has(z);
    /** 单支落柱描述，如「年、时支辰」。 */
    const label = (z) => `${[...new Set(byZhi.get(z))].join('、')}支${z}`;
    /** 一组支合计落在哪些柱（去重、按柱序），如「年、月、日、时」。 */
    const pillarSet = (zs) => [...new Set(ORDER.filter((k) => zs.includes(pillars[k]?.zhi)).map((k) => P[k]))];
    const out = [];

    // 三合局（三支齐全）
    for (const [a, b, c, el] of SANHE_GROUPS) {
        if (has(a) && has(b) && has(c)) {
            out.push({ type: '三合', tone: '吉', text: `${pillarSet([a, b, c]).join('、')}支成${a}${b}${c}三合${el}局` });
        }
    }
    // 半合（同组恰两支且含中神；三合已齐的组跳过）
    for (const [a, b, c, el] of SANHE_GROUPS) {
        if (has(a) && has(b) && has(c)) continue;
        const hit = [a, b, c].filter(has);
        if (hit.length === 2 && hit.some((z) => SANHE_MID[z] === z)) {
            const miss = [a, b, c].find((z) => !has(z));
            out.push({ type: '半合', tone: '吉', text: `${hit.map(label).join('，')}半合${el}局（缺${miss}，半合之力较缓）` });
        }
    }
    // 两两关系：六合 / 六冲 / 六害（按不重复的支对取值，重复支合并进同一行）
    const uniq = [...byZhi.keys()];
    for (let i = 0; i < uniq.length; i++) {
        for (let j = i + 1; j < uniq.length; j++) {
            const A = uniq[i];
            const B = uniq[j];
            if (ZHI_LIUHE[A] === B) out.push({ type: '六合', tone: '吉', text: `${label(A)}与${label(B)}六合` });
            if (ZHI_CHONG[A] === B) out.push({ type: '六冲', tone: '凶', text: `${label(A)}与${label(B)}六冲` });
            if (ZHI_HAI[A] === B) out.push({ type: '六害', tone: '凶', text: `${label(A)}与${label(B)}六害` });
        }
    }
    // 三刑全见（寅巳申 / 丑戌未 三支齐见）。子卯本来就没有「三支」之说，
    // 旧实现把它也塞进全见组、再按 length===2 判，等于把成对关系当群组报。
    const fullXingGroups = [];
    for (const zs of [['寅', '巳', '申'], ['丑', '戌', '未']]) {
        if (zs.every(has)) {
            fullXingGroups.push(zs);
            out.push({ type: '相刑', tone: '凶', text: `${zs.map(label).join('，')}${pillarSet(zs).length}支全见，成${zs.join('')}${XING_NAME[zs.join('')]}` });
        }
    }
    // 两支对刑（已作为三刑全见整体报过的组不再拆开重复报）
    for (let i = 0; i < uniq.length; i++) {
        for (let j = i + 1; j < uniq.length; j++) {
            const A = uniq[i];
            const B = uniq[j];
            if (!SAN_XING[A]?.includes(B)) continue;
            if (fullXingGroups.some((zs) => zs.includes(A) && zs.includes(B))) continue;
            const key = [A, B].sort((x, y) => XING_ORDER.indexOf(x) - XING_ORDER.indexOf(y)).join('');
            out.push({ type: '相刑', tone: '凶', text: `${label(A)}与${label(B)}相刑${XING_NAME[key] ? `（${XING_NAME[key]}）` : ''}` });
        }
    }
    // 自刑（同支重复出现且属自刑四支）
    for (const z of uniq) {
        const cols = [...new Set(byZhi.get(z))];
        if (ZI_XING.has(z) && cols.length >= 2) {
            out.push({ type: '自刑', tone: '凶', text: `${label(z)}自刑` });
        }
    }
    return out;
}

/** 相刑两支合成 XING_NAME 键时的排序依据。 */
const XING_ORDER = ['寅', '巳', '申', '丑', '戌', '未', '子', '卯'];

/**
 * 八字排盘主函数。
 * @returns 排盘结构（全部为本地确定性事实）。
 */
export function computeBazi(input, config = {}) {
    const gender = input.gender === 'male' ? 'male' : input.gender === 'female' ? 'female' : null;
    if (!gender) throw new Error("gender 必须是 'male' 或 'female'（大运顺逆由性别与年干决定，不可缺省）");

    // timeKnown=false 为显式「时辰未知」：即使内部补了占位 hour 也绝不排时柱。
    const timeKnown = input.timeKnown === false ? false : Number.isInteger(input.hour);
    const solar = toSolar(input);
    const lunar = solar.getLunar();
    const ec = lunar.getEightChar();

    // 晚子时日柱口径（插件层 1 = 按次日日柱【默认，与主流排盘软件一致】；2 = 按当日日柱）：
    // 实测库语义（1990-08-16 23:30）：setSect(1) 日柱 甲寅【次日，Exact 口径】，
    // setSect(2) 日柱 癸丑【当日，Exact2 口径】——库的 1/2 与插件 ziShi 数字同向，
    // 直接透传即可。
    const ziShi = config.ziShi === 2 ? 2 : 1;
    ec.setSect(ziShi);
    const lateZiNote = timeKnown && solar.getHour() >= 23
        ? (ziShi === 1
            ? '晚子时口径：23:00–24:00 出生按次日日柱（流派默认，可在配置 ziShi=2 切换为当日）'
            : '晚子时口径：23:00–24:00 出生按当日日柱（配置 ziShi=2）')
        : null;

    const dayGan = ec.getDay()[0];
    const withTenGod = true;
    const pillars = {
        year: pillar(ec, () => ec.getYear(), dayGan, { withTenGod, naYin: ec.getYearNaYin() }),
        month: pillar(ec, () => ec.getMonth(), dayGan, { withTenGod, naYin: ec.getMonthNaYin() }),
        day: pillar(ec, () => ec.getDay(), dayGan, { withTenGod, naYin: ec.getDayNaYin() }),
        ...(timeKnown ? { hour: pillar(ec, () => ec.getTime(), dayGan, { withTenGod, naYin: ec.getTimeNaYin() }) } : {}),
    };

    const counts = countWuxing(Object.values(pillars));
    const strength = strengthHint(dayGan, pillars.month.zhi, counts);

    const genderCode = gender === 'male' ? 1 : 0;
    const yun = ec.getYun(genderCode);
    const dayunCount = Math.max(1, Math.min(12, config.dayunCount ?? 8));
    const rawDaYun = yun.getDaYun(dayunCount + 1).slice(1);
    const daYun = rawDaYun.map((d, i) => {
        const gz = d.getGanZhi();
        return {
            ganZhi: gz,
            startAge: d.getStartAge(),
            startYear: d.getStartYear(),
            endYear: (rawDaYun[i + 1]?.getStartYear() ?? d.getStartYear() + 10) - 1,
            shiShenGan: tenGod(dayGan, gz[0]),
            shiShenZhi: tenGod(dayGan, ZHI_CANGGAN[gz[1]][0]), // 地支十神按本气藏干
        };
    });

    // 年柱（立春界）与农历年/生肖（春节界）在春节与立春之间的窗口会不同，如实提示口径。
    const lunarYearZhi = ZHI[((lunar.getYear() - 4) % 12 + 12) % 12];
    const yearScopeNote = pillars.year.zhi !== lunarYearZhi
        ? `年柱按立春界（${pillars.year.ganZhi}），农历年/生肖按春节界（${lunar.getYearInGanZhi()}年·属${lunar.getYearShengXiao()}）——出生在春节与立春之间时两者不同，排盘以立春界年柱为准`
        : null;

    return {
        meta: {
            // 时辰未知时绝不打印占位时刻：内部补的 12:00 只是排盘用的占位，
            // 原样回显会让用户以为「系统认定我 12 点出生」——这正是纪律里禁止的「默认 12 点」。
            solar: timeKnown
                ? solar.toYmdHms().slice(0, 16)
                : `${solar.toYmd()}（时辰未知，未排时柱）`,
            lunar: lunar.toString(),
            shengXiao: lunar.getYearShengXiao(),
            calendar: input.calendar === 'lunar' ? '农历' : '公历',
            timeKnown,
            timeZhi: timeKnown ? lunar.getTimeZhi() : null,
            gender: gender === 'male' ? '男' : '女',
            ...(Array.isArray(input.notes) && input.notes.length > 0 ? { notes: input.notes } : {}),
            ...(lateZiNote ? { lateZiNote } : {}),
            ...(yearScopeNote ? { yearScopeNote } : {}),
        },
        dayMaster: {
            gan: dayGan,
            wuxing: GAN_WUXING[GAN.indexOf(dayGan)],
            yinYang: GAN_YINYANG[GAN.indexOf(dayGan)],
        },
        pillars,
        zhiRelations: zhiRelations(pillars),
        wuxing: { counts, summary: wuxingSummary(counts) },
        strength,
        // 格局判定（简化正格八格/建禄阳刃俗格，月令藏干 + 他柱透干取格；供解读引导，非定量结论）
        geju: determineGeju({
            dayMasterGan: dayGan,
            monthZhi: pillars.month.zhi,
            // 传「除日柱外」的其余天干：排格要按柱位排除日主本身，不能按字符删
            //（年干与日主同字时它确是比肩/劫财透干——见 geju.js 的 P2-1 注释）。
            otherGans: [pillars.year.gan, pillars.month.gan, ...(timeKnown ? [pillars.hour.gan] : [])],
        }),
        shenSha: {
            taiYuan: ec.getTaiYuan(),
            mingGong: ec.getMingGong(),
            shenGong: ec.getShenGong(),
            xunKong: xunKongOf(pillars.day.ganZhi),
            stars: computeShenShaStars(pillars),
        },
        qiYun: {
            years: yun.getStartYear(),
            months: yun.getStartMonth(),
            days: yun.getStartDay(),
            text: `出生后 ${yun.getStartYear()} 年 ${yun.getStartMonth()} 个月 ${yun.getStartDay()} 天起运`,
        },
        daYun,
        liuNian: liuNian(dayGan, new Date().getFullYear()),
        disclaimer: '排盘为本地确定性计算；旺衰喜用为简化启发式；解读属传统文化范畴，仅供娱乐参考。',
    };
}
