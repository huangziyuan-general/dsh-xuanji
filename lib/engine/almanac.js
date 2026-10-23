// lib/engine/almanac.js — 每日黄历 + 每日一卦（本地确定性）。
// 宜忌/冲煞/值神等事实来自 lunar-javascript；每日一卦按公历日期确定性取卦（同日同卦）。

import lunarPkg from 'lunar-javascript';
import { HEXAGRAMS, hexagramSymbol } from './hexagrams.js';

const { Solar } = lunarPkg;

function todayYmd() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 每日一卦：日期哈希确定性映射到通行本 64 卦（同年同月同日必同卦）。 */
function dailyHexagram(y, m, d) {
    const seed = (((y * 10007) ^ (m * 911) ^ (d * 97)) >>> 0) % 64 + 1;
    for (const upper of Object.keys(HEXAGRAMS)) {
        for (const [lower, hex] of Object.entries(HEXAGRAMS[upper])) {
            if (hex.kingWen === seed) {
                return { upper, lower, ...hex, symbol: hexagramSymbol(hex.kingWen) };
            }
        }
    }
    return null;
}

/** 财神方位歌（通行口径，按日干定）：「甲乙东北是财神，丙丁向在西南寻，戊己正北坐方位，庚辛正东去安身，壬癸原来正南坐」。 */
const CAI_SHEN_POSITION = { 甲: '东北', 乙: '东北', 丙: '西南', 丁: '西南', 戊: '正北', 己: '正北', 庚: '正东', 辛: '正东', 壬: '正南', 癸: '正南' };

/** 黄历查询主函数。 */
export function computeAlmanac(dateStr) {
    // 显式给了日期就严格校验——静默回退到今天会掩盖笔误（查 10 月 22 写成 not-a-date 还以为是今天的历）
    let ymd;
    if (dateStr === undefined || dateStr === null || dateStr === '') {
        ymd = todayYmd();
    } else if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr.trim())) {
        ymd = dateStr.trim();
    } else {
        throw new Error(`日期格式不合法：「${String(dateStr)}」不是 YYYY-MM-DD——例如 2026-10-22`);
    }
    const [y, m, d] = ymd.split('-').map(Number);
    const solar = Solar.fromYmd(y, m, d);
    const lunar = solar.getLunar();

    const hex = dailyHexagram(y, m, d);

    // 节气：当前（若当日交节）/上一/下一节气
    const prevJq = lunar.getPrevJieQi();
    const nextJq = lunar.getNextJieQi();
    const curJq = lunar.getCurrentJieQi?.() ?? null;
    const jieQi = {
        current: curJq ? { name: curJq.getName(), date: curJq.getSolar().toYmd() } : null,
        prev: { name: prevJq.getName(), date: prevJq.getSolar().toYmd() },
        next: { name: nextJq.getName(), date: nextJq.getSolar().toYmd() },
    };

    // 方位：喜神/阳贵/阴贵/福神来自库；财神按通行《财神方位歌》自算（库内无此表）
    const dayGan = lunar.getDayInGanZhi()[0];
    const positions = {
        xiShen: lunar.getPositionXiDesc(),
        yangGui: lunar.getPositionYangGuiDesc(),
        yinGui: lunar.getPositionYinGuiDesc(),
        fuShen: lunar.getPositionFuDesc(),
        caiShen: CAI_SHEN_POSITION[dayGan],
    };

    return {
        meta: { date: ymd, isToday: ymd === todayYmd() },
        lunarDate: lunar.toString(),
        ganzhi: {
            year: lunar.getYearInGanZhiExact(),
            month: lunar.getMonthInGanZhiExact(),
            day: lunar.getDayInGanZhi(),
            shengXiao: lunar.getYearShengXiao(),
        },
        festivals: lunar.getFestivals?.() ?? [],
        positions,
        jieQi,
        yi: lunar.getDayYi(),
        ji: lunar.getDayJi(),
        chong: { text: lunar.getChongDesc(), shengXiao: lunar.getChongShengXiao(), sha: `煞${lunar.getSha()}` },
        zhiXing: lunar.getZhiXing(),
        xiu: { xiu: lunar.getXiu(), zheng: lunar.getZheng(), animal: lunar.getAnimal(), gong: lunar.getGong() },
        yueXiang: lunar.getYueXiang(),
        liuYao: lunar.getLiuYao(),
        pengZu: { gan: lunar.getPengZuGan(), zhi: lunar.getPengZuZhi() },
        jiShen: lunar.getDayJiShen().slice(0, 6),
        xiongSha: lunar.getDayXiongSha().slice(0, 6),
        dailyHexagram: hex,
        disclaimer: '宜忌为传统黄历口径的本地计算；每日一卦为日期确定性取卦（同日同卦）；仅供娱乐参考。',
    };
}
