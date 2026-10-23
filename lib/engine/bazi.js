// lib/engine/bazi.js — 八字排盘确定性引擎（纯本地，零模型调用）。
// 干支/纳音/十神/大运等全部事实来自 lunar-javascript 的节气精确历法计算，
// 本模块只做组装与简化判定；模型不得自行推演任何干支数值。

import lunarPkg from 'lunar-javascript';
import {
    GAN, ZHI, GAN_WUXING, GAN_YINYANG, ZHI_WUXING, ZHI_CANGGAN,
    SHENG, tenGod, JIAZI, yearGanZhi, wuxingSummary, xunKongOf,
} from './tables.js';
import { computeShenShaStars } from './shensha.js';
import { determineGeju } from './geju.js';

const { Solar, Lunar } = lunarPkg;

/** 十二长生：日主（及各柱自坐）对地支的长生状态。阳干顺行、阴干逆行，起于长生位（通行口径）。 */
const CHANG_SHENG_START = { 甲: '亥', 乙: '午', 丙: '寅', 丁: '酉', 戊: '寅', 己: '酉', 庚: '巳', 辛: '子', 壬: '申', 癸: '卯' };
const CHANG_SHENG_STAGES = ['长生', '沐浴', '冠带', '临官', '帝旺', '衰', '病', '死', '墓', '绝', '胎', '养'];
const CHANG_SHENG = Object.fromEntries(GAN.map((gan) => {
    const start = ZHI.indexOf(CHANG_SHENG_START[gan]);
    const dir = GAN.indexOf(gan) % 2 === 0 ? 1 : -1; // 阳干顺行，阴干逆行
    const row = {};
    for (let i = 0; i < 12; i++) row[ZHI[((start + dir * i) % 12 + 12) % 12]] = CHANG_SHENG_STAGES[i];
    return [gan, row];
}));

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
 */
function strengthHint(dayGan, monthZhi, counts) {
    const dayEl = GAN_WUXING[GAN.indexOf(dayGan)];
    const monthEl = ZHI_WUXING[ZHI.indexOf(monthZhi)];
    const motherEl = Object.entries(SHENG).find(([, v]) => v === dayEl)?.[0];
    const deLing = monthEl === dayEl || monthEl === motherEl;
    const score = counts[dayEl] + (motherEl ? counts[motherEl] : 0);
    let state;
    let favorable;
    if (score >= 4 && deLing) {
        state = '偏强';
        favorable = ['官杀（克我）', '食伤（我生）', '财星（我克）'].join('、');
    } else if (score <= 2 || (!deLing && score <= 3)) {
        state = '偏弱';
        favorable = ['印星（生我）', '比劫（同我）'].join('、');
    } else {
        state = '中和';
        favorable = '五行调和，顺势而为，缺哪类补哪类';
    }
    return { dayElement: dayEl, monthElement: monthEl, deLing, score, state, favorable, note: '简化判定（得令+得势计数法），仅作解读引导，非任何流派的定量结论' };
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
 * 原局地支刑冲合会扫描（确定性；口径：三合需三支齐全，半合须含中神子午卯酉，
 * 刑分三刑全见/两支对刑/自刑，全部列明落在哪些柱）。
 * @param {object} pillars computeBazi 的 pillars
 * @returns {{type:string, tone:string, text:string}[]}
 */
function zhiRelations(pillars) {
    const P = { year: '年', month: '月', day: '日', hour: '时' };
    const entries = Object.entries(pillars).map(([k, p]) => ({ key: k, zhi: p.zhi }));
    const out = [];
    const hasAll = (zs) => entries.filter((e) => zs.includes(e.zhi));

    // 三合局（三支齐全）
    for (const [a, b, c, el] of SANHE_GROUPS) {
        const ms = hasAll([a, b, c]);
        if (ms.length === 3) {
            out.push({ type: '三合', tone: '吉', text: `${ms.map((m) => P[m.key]).join('、')}支成${a}${b}${c}三合${el}局` });
        }
    }
    // 半合（同组两支且含中神；三合已齐的组跳过）
    for (const [a, b, c, el] of SANHE_GROUPS) {
        const group = [a, b, c];
        if (hasAll(group).length === 3) continue;
        const ms = hasAll(group);
        if (ms.length === 2 && ms.some((m) => SANHE_MID[m.zhi] === m.zhi)) {
            const miss = group.find((z) => !ms.some((m) => m.zhi === z));
            out.push({ type: '半合', tone: '吉', text: `${ms.map((m) => `${P[m.key]}支${m.zhi}`).join('、')}半合${el}局（缺${miss}，半合之力较缓）` });
        }
    }
    // 两两关系：六合 / 六冲 / 六害
    for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
            const A = entries[i];
            const B = entries[j];
            if (ZHI_LIUHE[A.zhi] === B.zhi) out.push({ type: '六合', tone: '吉', text: `${P[A.key]}支${A.zhi}与${P[B.key]}支${B.zhi}六合` });
            if (ZHI_CHONG[A.zhi] === B.zhi) out.push({ type: '六冲', tone: '凶', text: `${P[A.key]}支${A.zhi}与${P[B.key]}支${B.zhi}六冲` });
            if (ZHI_HAI[A.zhi] === B.zhi) out.push({ type: '六害', tone: '凶', text: `${P[A.key]}支${A.zhi}与${P[B.key]}支${B.zhi}六害` });
        }
    }
    // 三刑全见（寅巳申 / 丑戌未 / 子卯齐全）
    const fullXingGroups = [];
    for (const zs of [['寅', '巳', '申'], ['丑', '戌', '未'], ['子', '卯']]) {
        const ms = hasAll(zs);
        if (ms.length === zs.length) {
            fullXingGroups.push(zs);
            out.push({ type: '相刑', tone: '凶', text: `${ms.map((m) => `${P[m.key]}支${m.zhi}`).join('、')}三支全见，成${zs.join('')}${XING_NAME[zs.join('')]}` });
        }
    }
    // 两支对刑（未成三刑的）
    for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
            const A = entries[i];
            const B = entries[j];
            if (SAN_XING[A.zhi]?.includes(B.zhi)) {
                // 该两支所属的刑组已经整体报过一次，再报就是重复计数器（原先三刑齐全会输出 4 条）
                if (fullXingGroups.some((zs) => zs.includes(A.zhi) && zs.includes(B.zhi))) continue;
                const group = [A.zhi, B.zhi].sort((x, y) => ['寅', '巳', '申', '丑', '戌', '未', '子', '卯'].indexOf(x) - ['寅', '巳', '申', '丑', '戌', '未', '子', '卯'].indexOf(y)).join('');
                out.push({ type: '相刑', tone: '凶', text: `${P[A.key]}支${A.zhi}与${P[B.key]}支${B.zhi}相刑${XING_NAME[group] ? `（${XING_NAME[group]}）` : ''}` });
            }
        }
    }
    // 自刑（同支且属自刑四支）
    for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
            const A = entries[i];
            const B = entries[j];
            if (A.zhi === B.zhi && ZI_XING.has(A.zhi)) {
                out.push({ type: '自刑', tone: '凶', text: `${P[A.key]}支${A.zhi}与${P[B.key]}支${B.zhi}自刑` });
            }
        }
    }
    return out;
}

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
            solar: solar.toYmdHms().slice(0, 16),
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
        // 格局判定（简化正格八格/建禄阳刃俗格，月令本气 + 透干取格；供解读引导，非定量结论）
        geju: determineGeju({
            dayMasterGan: dayGan,
            monthZhi: pillars.month.zhi,
            allGans: [pillars.year.gan, pillars.month.gan, pillars.day.gan, ...(timeKnown ? [pillars.hour.gan] : [])],
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
