// lib/engine/ziwei.js — 紫微斗数排盘引擎：包装 iztro（确定性安星库）+ 统一时间管线。
// 安命宫/安星/四化/大限由 iztro 本地计算（无网络无模型）；本模块只做时间口径与结构组装。

import { astro } from 'iztro';
import { resolveBirthTime } from './birth-time.js';
import { hourToZhi, ZHI } from './tables.js';

/**
 * 紫微排盘主函数。
 * @param {{ year, month, day, hour, minute?, gender:'male'|'female', calendar?, isLeapMonth?,
 *            applyDST?, city?, longitude? }} input
 * 时辰必填（紫微十二宫格局随时辰变，缺时辰不可排——requireHour 强制先问）。
 */
export function computeZiwei(input) {
    const gender = input.gender === 'male' ? 'male' : input.gender === 'female' ? 'female' : null;
    if (!gender) throw new Error("gender 必须是 'male' 或 'female'（紫微大限顺逆与安身宫由性别决定，不可缺省）");

    const rt = resolveBirthTime(input, { requireHour: true });
    const notes = [...rt.notes];

    // 晚子时口径：iztro 以 timeIndex 0 = 早子时，23:00–24:00 需翻到次日按早子时排。
    let { year, month, day } = rt.solar;
    const hour = rt.hour;
    if (hour === 23) {
        const next = new Date(Date.UTC(year, month - 1, day + 1));
        year = next.getUTCFullYear();
        month = next.getUTCMonth() + 1;
        day = next.getUTCDate();
        notes.push('晚子时口径：23:00–24:00 出生按次日早子时排盘（与主流排盘软件一致）');
    }
    const timeIndex = ZHI.indexOf(hourToZhi(hour));

    const chart = astro.astrolabeBySolarDate(`${year}-${month}-${day}`, timeIndex, gender === 'male' ? '男' : '女', true);

    const palaces = chart.palaces.map((p) => ({
        palace: p.name,
        stemBranch: `${p.heavenlyStem}${p.earthlyBranch}`,
        majorStars: p.majorStars.map((s) => ({
            name: s.name,
            ...(s.brightness ? { brightness: s.brightness } : {}),
            ...(s.mutagen ? { mutagen: s.mutagen } : {}),
        })),
        minorStars: p.minorStars.map((s) => s.name),
        adjectiveStars: p.adjectiveStars.map((s) => s.name).slice(0, 6),
        decadal: { start: p.decadal.range[0], end: p.decadal.range[1] },
        ...(p.isBodyPalace ? { isBodyPalace: true } : {}),
        ...(p.isOriginalPalace ? { isOriginalPalace: true } : {}),
    }));

    const meta = {
        solar: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        lunar: chart.lunarDate,
        gender: gender === 'male' ? '男' : '女',
        timeIndex,
        hourZhi: hourToZhi(hour),
        calendar: input.calendar === 'lunar' ? '农历' : '公历',
        notes,
        action: input.action === 'fortune' ? 'fortune' : 'natal',
    };
    const head = { soul: chart.soul, body: chart.body, fiveElementsClass: chart.fiveElementsClass };
    const disclaimer = '紫微排盘由本地确定性引擎（iztro）计算；星曜解读属传统文化范畴，仅供娱乐参考，不构成现实决策依据。';

    // 运限层：大限/流年/小限三环（iztro horoscope，随流日历确定性切换）
    if (meta.action === 'fortune') {
        const fortuneDate = typeof input.fortuneDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.fortuneDate.trim())
            ? input.fortuneDate.trim()
            : (() => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; })();
        const h = chart.horoscope(fortuneDate);
        const ring = (r) => ({
            stemBranch: `${r.heavenlyStem}${r.earthlyBranch}`,
            index: r.index,
            mingPalace: r.palaceNames[r.index],
            palaceNames: r.palaceNames,
            mutagen: { lu: r.mutagen[0], quan: r.mutagen[1], ke: r.mutagen[2], ji: r.mutagen[3] },
        });
        return {
            meta: { ...meta, fortuneDate },
            ...head,
            fortune: {
                decadal: { ...ring(h.decadal), ageRange: chart.palaces[h.decadal.index]?.decadal?.range ?? null },
                yearly: { ...ring(h.yearly), year: Number(fortuneDate.slice(0, 4)) },
                xiaoXian: { nominalAge: h.age?.nominalAge, ...ring(h.age) },
            },
            natalPalaces: palaces.map((p) => ({ palace: p.palace, stemBranch: p.stemBranch })),
            disclaimer,
        };
    }

    return {
        meta,
        ...head,
        palaces,
        disclaimer,
    };
}
