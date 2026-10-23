// lib/engine/true-solar-time.js — 真太阳时校正：经度差 + 均时差（纯本地确定性）。
//
// 干支时辰以真太阳时为准：真太阳时 = 钟面时间 + 4×(经度−120) 分钟 + 均时差。
// 经度项方向：太阳先过东经 120° 再过偏西经线，所以偏西城市（如成都 104.07°E、
// 乌鲁木齐 87.62°E）同一钟面时刻的真太阳时比钟面更小——乌鲁木齐（87.62°E）钟面
// 14:10 的真太阳时约 11:57（当地太阳正午约在北京时间 14:10），成都（104.07°E）
// 钟面 15:30 的真太阳时约 14:26（仍在未时）。均时差（地球轨道偏心与黄赤交角导致，
// 全年 ±16 分钟内摆动，apparent − mean，正值加在钟面上）与经度项方向无关。

/** 主要城市经度表（东经，度；常用城市精选，未收录城市可直传 longitude）。 */
export const CITIES = {
    北京: 116.41, 上海: 121.47, 天津: 117.20, 重庆: 106.55,
    广州: 113.26, 深圳: 114.06, 珠海: 113.58, 汕头: 116.68, 佛山: 113.12, 东莞: 113.75,
    杭州: 120.16, 宁波: 121.55, 温州: 120.70, 南京: 118.80, 苏州: 120.58, 无锡: 120.31,
    合肥: 117.28, 福州: 119.30, 厦门: 118.09, 泉州: 118.59, 南昌: 115.86,
    济南: 117.00, 青岛: 120.38, 烟台: 121.39, 郑州: 113.63, 洛阳: 112.45,
    武汉: 114.31, 长沙: 112.94, 南宁: 108.37, 桂林: 110.29, 海口: 110.20, 三亚: 109.51,
    成都: 104.07, 绵阳: 104.68, 贵阳: 106.63, 昆明: 102.83, 大理: 100.27,
    拉萨: 91.11, 西安: 108.94, 兰州: 103.83, 西宁: 101.78, 银川: 106.23,
    乌鲁木齐: 87.62, 喀什: 75.99, 伊犁: 81.32, 吐鲁番: 89.19,
    呼和浩特: 111.75, 包头: 109.84, 哈尔滨: 126.53, 长春: 125.32, 沈阳: 123.43,
    大连: 121.61, 石家庄: 114.51, 太原: 112.55, 香港: 114.17, 澳门: 113.55, 台北: 121.56,
};

/** 均时差（分钟）：标准近似式，B=2π(N−81)/364。全年摆动约 −14.2 ~ +16.4 分钟。 */
export function equationOfTimeMinutes(month, day) {
    // 近似用月日折算年积日（2 月按 28 天，误差对时辰无影响）
    const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let n = day;
    for (let i = 0; i < month - 1; i++) n += DAYS[i];
    const B = (2 * Math.PI * (n - 81)) / 364;
    return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
}

/**
 * 解析出生地经度：city 查表（未收录报可行动错误）或直接给 longitude。
 * @returns {{ longitude: number, source: string }}
 */
export function resolveLongitude({ city, longitude } = {}) {
    if (typeof longitude === 'number' && Number.isFinite(longitude)) {
        if (longitude < -180 || longitude > 180) throw new Error('longitude 必须在 -180–180 之间（东经为正）');
        return { longitude, source: '经度直传' };
    }
    if (typeof city === 'string' && city.trim() !== '') {
        const key = city.trim();
        // 必须用 Object.hasOwn：`key in CITIES` 会沿原型链查找，city=toString/constructor/__proto__
        // 都能命中并绕过白名单，取到的是函数 → 经度 NaN → 后续年月日全部算成 NaN。
        if (!Object.hasOwn(CITIES, key)) {
            throw new Error(`城市「${key}」不在内置经度表（${Object.keys(CITIES).length} 城）。可改传 longitude（东经为正，如成都 104.07）`);
        }
        return { longitude: CITIES[key], source: `内置城市表（${key}）` };
    }
    throw new Error('真太阳时校正需要 city（内置城市表）或 longitude（东经度数）之一');
}

/**
 * 真太阳时校正：钟面时间 + 经度差分钟 + 均时差分钟（跨日进位用 UTC 纪元换算，与时区无关）。
 * @param {{ year, month, day, hour, minute?, city?, longitude? }} t
 * @returns {{ year, month, day, hour, minute, longitude, eotMinutes, offsetMinutes, applied, source }}
 */
export function applyTrueSolarTime(t) {
    const { longitude, source } = resolveLongitude(t);
    // 东经 120° 以西为负（太阳过当地中天更晚，同一钟面时刻真太阳时更小），以东为正。
    const lonMinutes = 4 * (longitude - 120);
    const eot = equationOfTimeMinutes(t.month, t.day);
    const offset = Math.round(lonMinutes + eot);
    const epoch = Date.UTC(t.year, t.month - 1, t.day, t.hour, t.minute ?? 0) + offset * 60000;
    const d = new Date(epoch);
    return {
        year: d.getUTCFullYear(),
        month: d.getUTCMonth() + 1,
        day: d.getUTCDate(),
        hour: d.getUTCHours(),
        minute: d.getUTCMinutes(),
        longitude,
        eotMinutes: Math.round(eot * 10) / 10,
        offsetMinutes: offset,
        applied: true,
        source,
    };
}
