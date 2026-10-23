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

    // 年界口径：黄历给命理用，年干支与生肖**统一按立春界**（getYearInGanZhiExact /
    // getYearShengXiaoByLiChun）。旧版一边取立春界干支、一边取春节界生肖，
    // 于是每年立春到春节那一到两周里输出「丙午年｜属蛇」这种自相矛盾的行（AUDIT P2-4）。
    // 民俗口径（春节界生肖）仍然如实给出来，但作为**并列说明**而不是混进同一格。
    const yearGzLiChun = lunar.getYearInGanZhiExact();
    const shengXiaoLiChun = lunar.getYearShengXiaoByLiChun();
    const yearGzSpring = lunar.getYearInGanZhi();
    const shengXiaoSpring = lunar.getYearShengXiao();
    const boundaryNote = yearGzLiChun !== yearGzSpring
        ? `年界口径：本条按立春界作${yearGzLiChun}年·属${shengXiaoLiChun}（命理排盘用）；`
            + `立春（${String(lunar.getJieQiTable()['立春']).slice(0, 10)}）与春节之间，民俗按春节界作${yearGzSpring}年·属${shengXiaoSpring}——两种都对，取用场合不同`
        : null;

    return {
        meta: { date: ymd, isToday: ymd === todayYmd(), ...(boundaryNote ? { boundaryNote } : {}) },
        lunarDate: lunar.toString(),
        ganzhi: {
            year: yearGzLiChun,
            month: lunar.getMonthInGanZhiExact(),
            day: lunar.getDayInGanZhi(),
            shengXiao: shengXiaoLiChun,
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
