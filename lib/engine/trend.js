// lib/engine/trend.js — 人生K线确定性引擎：
// 以大运干支（权重高）与流年干支十神（对日主）确定性计分，输出 1–100 岁逐年 OHLC。
// 纯数据 + ASCII 迷你图；这是「简化判定」口径的可视化，不是命运断语。

import { tenGod, yearGanZhi, ZHI_WUXING, ZHI, GAN } from './tables.js';
import { computeBazi } from './bazi.js';
import { resolveBirthTime } from './birth-time.js';

/** 十神计分表（相对日主）。
 *  传统身强身弱取用法有三条硬规则，表必须与之自洽，否则 K 线会系统性单边漂移：
 *    偏弱（身弱）→ 喜生扶（印、比劫）为正，忌克泄耗（官杀、食伤、财）为负；
 *    偏强（身强）→ 喜克泄耗（官杀、食伤、财）为正，忌生扶（印、比劫）为负；
 *    中和       → 财官印温和加分，杀伤伤官小扣。
 *  三张表各自求和均接近 0（分别为 −4 / +2 / +6），保证分数有正负双向起伏。 */
const SHISHEN_WEAK = {
    正印: 2, 偏印: 2, 比肩: 2, 劫财: 1,
    食神: -1, 伤官: -2, 偏财: -2, 正财: -2,
    正官: -1, 七杀: -3,
};

const SHISHEN_STRONG = {
    正印: -2, 偏印: -2, 比肩: -2, 劫财: -1,
    食神: 1, 伤官: 1, 偏财: 2, 正财: 2,
    正官: 2, 七杀: 1,
};

const SHISHEN_NEUTRAL = {
    正印: 1, 偏印: 0, 比肩: 0, 劫财: -1,
    食神: 1, 伤官: -2, 偏财: 1, 正财: 2,
    正官: 2, 七杀: -2,
};

/** 按日主旺衰方向把十神映射为原始分。 */
function shiShenScore(god, strengthState) {
    if (strengthState === '偏强') return SHISHEN_STRONG[god] ?? 0;
    if (strengthState === '中和') return SHISHEN_NEUTRAL[god] ?? 0;
    return SHISHEN_WEAK[god] ?? 0; // 偏弱
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/**
 * 人生K线主函数。
 * @param {{ year, month, day, hour?, minute?, gender, calendar?, isLeapMonth?, applyDST?, city?, longitude?,
 *            toAge?:number }} input
 *  hour 可选（时辰只影响时柱，此处对大运流年影响极小，缺省时辰未知也允许）。
 * @returns 逐年 OHLC + 大运分段 + ASCII 迷你图。
 */
export function computeTrend(input) {
    const gender = input.gender === 'male' ? 'male' : input.gender === 'female' ? 'female' : null;
    if (!gender) throw new Error("gender 必须是 'male' 或 'female'（大运顺逆由性别决定，不可缺省）");
    const toAge = clamp(Number.isInteger(input.toAge) ? input.toAge : 100, 10, 100);

    // 统一时间管线：历法归一 → 夏令时 → 真太阳时（applyDST/city/longitude 在此真实生效）。
    const rt = resolveBirthTime(input);
    const bazi = computeBazi({
        year: rt.solar.year, month: rt.solar.month, day: rt.solar.day,
        hour: rt.hour ?? 12, minute: rt.minute, gender,
        calendar: 'solar', timeKnown: rt.timeKnown, notes: rt.notes,
    }, { dayunCount: 10 });
    const { dayMaster, strength, daYun, meta, geju } = bazi;

    // 大运分段：startAge → 下一步起运前
    const segments = daYun.map((d, i) => ({
        ganZhi: d.ganZhi,
        startAge: d.startAge,
        endAge: (daYun[i + 1]?.startAge ?? d.startAge + 10) - 1,
    })).filter((s) => s.startAge <= toAge);

    const birthYear = Number(meta.solar.slice(0, 4));
    const points = [];
    let prev = 50;
    for (let age = 1; age <= toAge; age++) {
        const year = birthYear + age - 1;
        const gz = yearGanZhi(year);
        // 起运前（age < 首步大运起运岁）无大运：只按流年干支计分
        const seg = segments.find((s) => age >= s.startAge && age <= s.endAge) ?? null;
        const dayGan = dayMaster.gan;

        // 流年干支十神（支取本气五行对日干的十神）
        const godGan = tenGod(dayGan, gz[0]);
        const zhiEl = ZHI_WUXING[ZHI.indexOf(gz[1])];
        const zhiGod = zhiElToShiShen(dayGan, zhiEl);
        // 大运干支十神（权重 ×1.5）
        const dyGodGan = seg ? tenGod(dayGan, seg.ganZhi[0]) : null;
        const dyZhiEl = seg ? ZHI_WUXING[ZHI.indexOf(seg.ganZhi[1])] : null;
        const dyZhiGod = dyZhiEl ? zhiElToShiShen(dayGan, dyZhiEl) : null;

        const raw = (shiShenScore(godGan, strength.state) + shiShenScore(zhiGod, strength.state))
            + (seg ? (shiShenScore(dyGodGan, strength.state) + shiShenScore(dyZhiGod, strength.state)) * 1.5 : 0);
        // 原始分理论域随旺衰方向自动推导：流年两项 + 大运两项×1.5 = 5×表内最大绝对值
// （偏弱表含 ±3 → ±15；偏强/中和 ±2 → ±10），消除「底部贴 2 分」的单边截断。
        const rawBound = 5 * Math.max(...Object.values(
            strength.state === '偏强' ? SHISHEN_STRONG : strength.state === '中和' ? SHISHEN_NEUTRAL : SHISHEN_WEAK,
        ).map(Math.abs));
        const score = clamp(Math.round(((raw + rawBound) / (rawBound * 2)) * 100), 2, 99);
        const high = clamp(score + 4, 0, 100);
        const low = clamp(score - 4, 0, 100);
        points.push({
            age, year, ganZhi: gz,
            dayunGanZhi: seg?.ganZhi ?? null,
            shiShenGan: godGan,
            shiShenZhi: zhiGod,
            score,
            kline: { open: prev, close: score, high, low },
        });
        prev = score;
    }

    const sorted = [...points].sort((a, b) => b.score - a.score);
    const sparkline = asciiSparkline(points);

    return {
        meta: {
            birth: meta.solar.slice(0, 10),
            gender: meta.gender,
            dayMaster: `${dayMaster.gan}（${dayMaster.yinYang}${dayMaster.wuxing}）`,
            strength: { state: strength.state, note: strength.note },
        ...(geju?.geju || geju?.suGe ? { geju: { name: geju.geju ?? geju.suGe, formed: geju.formed, note: geju.note } } : {}),
            toAge,
            // 用**输入**历法标注，不用 bazi 的 meta.calendar：后者恒为「公历」
            // （换算后的日期喂给排盘引擎时一律标 solar），农历生日用户的 K 线会显示成公历输入。
            calendar: input.calendar === 'lunar' ? '农历' : '公历',
            ...(rt.notes.length > 0 ? { notes: rt.notes } : {}),
        },
        segments,
        points,
        highlights: {
            best: sorted.slice(0, 3).map((p) => `${p.age}岁（${p.year}，${p.ganZhi}，${p.score}分）`),
            worst: sorted.slice(-3).reverse().map((p) => `${p.age}岁（${p.year}，${p.ganZhi}，${p.score}分）`),
        },
        sparkline,
        sources: [
            '运势分：流年/大运干支十神对日主的简化启发式计分（得令+得势旺衰方向）',
            'K线形态：收盘=当年分，开盘=上年分，高低各±4（确定性生成）',
        ],
        disclaimer: '人生K线为简化启发式的可视化，趋势形态仅供娱乐参考，不构成任何现实决策依据；十年大运内每年分值不等于真实吉凶。',
    };
}

/** 地支本气五行 → 对日干的十神名。 */
function zhiElToShiShen(dayGan, element) {
    const ELEMENT_ORDER = { 木: 0, 火: 1, 土: 2, 金: 3, 水: 4 };
    const dEl = GAN_WUXING_FIRST(dayGan);
    const diff = (ELEMENT_ORDER[element] - ELEMENT_ORDER[dEl] + 5) % 5;
    const samePolarity = (GAN.indexOf(dayGan) % 2) === 0; // 简化：支不论阴阳，取阳干视角
    switch (diff) {
        case 0: return samePolarity ? '比肩' : '劫财';
        case 1: return samePolarity ? '食神' : '伤官';
        case 2: return samePolarity ? '偏财' : '正财';
        case 3: return samePolarity ? '七杀' : '正官';
        case 4: return samePolarity ? '偏印' : '正印';
        default: return '比肩';
    }
}

function GAN_WUXING_FIRST(gan) {
    return { 甲: '木', 乙: '木', 丙: '火', 丁: '火', 戊: '土', 己: '土', 庚: '金', 辛: '金', 壬: '水', 癸: '水' }[gan];
}

/** ASCII 迷你 K 线：每年一个 block（▁▂▃▄▅▆▇█），按大运分行（起运前单独一行）。 */
function asciiSparkline(points) {
    const BLOCKS = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█'];
    const lines = [];
    for (const seg of points.reduce((acc, p) => {
        const key = p.dayunGanZhi ?? '起运前';
        const last = acc[acc.length - 1];
        if (!last || last.key !== key) acc.push({ key, points: [] });
        acc[acc.length - 1].points.push(p);
        return acc;
    }, [])) {
        const bars = seg.points.map((p) => BLOCKS[clamp(Math.floor((p.score / 100) * BLOCKS.length), 0, BLOCKS.length - 1)]).join('');
        lines.push(`${seg.key}（${seg.points[0].age}–${seg.points[seg.points.length - 1].age}岁）：${bars}`);
    }
    return lines;
}
