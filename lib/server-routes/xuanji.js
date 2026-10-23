// lib/server-routes/xuanji.js — 面板数据面：健康检查 / 八字 / K线 / 塔罗 / 黄历 / 快占（小六壬·梅花）/ 称骨。
//
// 全部只读、纯本地确定性计算（与 xuanji_* 工具同引擎，零 token）。
// fence 校验在 server-api.js 的总入口做过一次，这里不再重复（总入口拒绝在先）。
//
// ── 两条硬纪律（曾经的线上事故，改这个文件务必保持）──
// ① 任何可能 throw 的调用（尤其是 resolveBirthTime）必须落在 runEngine 的 try 里。
//    handler 是 async，异常一旦逸出就变成 rejected promise；宿主若没挂 .catch，
//    Node ≥15 的默认行为是终止进程——等于面板一次误操作把整个 dsh 带走。
// ② 年月日缺失必须在进时间管线之前拦下。resolveBirthTime 对 undefined 年份会
//    静默按 0 归一（产出「0000-08-16」这种公元零年的盘），违反「绝不代填」纪律。

import { computeTrend } from '../engine/trend.js';
import { computeTarot } from '../engine/tarot.js';
import { computeBazi } from '../engine/bazi.js';
import { resolveBirthTime } from '../engine/birth-time.js';
import { computeAlmanac } from '../engine/almanac.js';
import { computeXiaoliuren } from '../engine/xiaoliuren.js';
import { computeMeihua } from '../engine/meihua.js';
import { computeChenggu } from '../engine/chenggu.js';
import { writeJson, fail, parseQuery, intParam, numParam, strParam } from '../server-http.js';
import { resolveDate, resolveDateStr } from '../engine/calendar.js';

/** 版本号：由 server-api.js 注入（读 package.json，单一来源）。 */
let PLUGIN_VERSION = '';
export function setVersion(v) { PLUGIN_VERSION = String(v ?? ''); }

/**
 * 宿主配置项（dayunCount / ziShi）：由 index.js 的 apply 透传进来。
 * 早先这里硬编码 `computeBazi(input, {})`，导致面板忽略宿主 ziShi 设置——
 * 同一个 23:30 出生的人，面板给出日柱甲寅、工具给出癸丑，两处打架。
 */
let PLUGIN_CONFIG = {};
export function setConfig(cfg) { PLUGIN_CONFIG = cfg && typeof cfg === 'object' ? cfg : {}; }

/** 引擎调用错误 → 可读失败响应（fail-fast 错误消息本来就面向用户）。 */
const runEngine = (res, fn) => {
    try {
        writeJson(res, 200, { ok: true, value: fn() });
    } catch (error) {
        fail(res, 400, 'ENGINE_INPUT', String(error?.message ?? error));
    }
};

/**
 * 年月日 params 守卫：三者都必须是整数，否则 400 并且不进时间管线。
 * @returns {number[]|null} 缺任一返回 null（调用方须立即 return true）
 */
function guardYmd(p) {
    const ymd = ['year', 'month', 'day'].map((k) => intParam(p, k));
    return ymd.some((x) => x === null) ? null : ymd;
}

/**
 * 历法 params（面板的公历/农历切换 + 闰月勾选）。
 * 面板与工具面必须同源：早先面板没有历法参数，农历生日用户在面板排出来的盘
 * 和用 xuanji_bazi 排的差整整一个月柱——两边口径打架比算错更难查。
 */
function readCalendar(p) {
    return {
        calendar: strParam(p, 'calendar') === 'lunar' ? 'lunar' : 'solar',
        isLeapMonth: strParam(p, 'isLeapMonth') === '1' ? true : undefined,
    };
}

/** 日期串（YYYY-MM-DD）按历法归一到公历日期串；没给日期则原样返回 undefined。 */
function readDate(p, key = 'date') {
    const raw = strParam(p, key) ?? undefined;
    if (!raw) return undefined;
    return resolveDateStr(
        raw,
        strParam(p, 'calendar') === 'lunar' ? 'lunar' : 'solar',
        strParam(p, 'isLeapMonth') === '1',
    ).date;
}

/** hour / minute 范围校验：越界直接抛可读错误（由 runEngine 捕获成 400）。
 *  引擎层原本不校验，非法值会一路捅到 lunar-javascript 抛 `wrong hour 24` 这类库内部信息。 */
function checkHourRange(hour, minute) {
    if (hour !== undefined && (!Number.isInteger(hour) || hour < 0 || hour > 23)) {
        throw new Error(`hour 必须是 0–23 的整数（当前 ${hour}）`);
    }
    if (minute !== undefined && (!Number.isInteger(minute) || minute < 0 || minute > 59)) {
        throw new Error(`minute 必须是 0–59 的整数（当前 ${minute}）`);
    }
}

/**
 * @param {object} req 请求
 * @param {object} res 响应
 * @param {string[]} segments 路径段
 * @returns {boolean} 是否已处理
 */
export function handle(req, res, segments) {
    const url = req.url ?? '/';

    // GET /health — 面板探活（版本徽标用）
    if (req.method === 'GET' && segments[0] === 'health' && segments.length === 1) {
        writeJson(res, 200, { ok: true, value: { name: 'dsh-xuanji', version: PLUGIN_VERSION } });
        return true;
    }

    // GET /trend — 人生K线逐年 OHLC（面板画蜡烛图用）
    if (req.method === 'GET' && segments[0] === 'trend' && segments.length === 1) {
        const p = parseQuery(url);
        const input = {
            year: intParam(p, 'year'),
            month: intParam(p, 'month'),
            day: intParam(p, 'day'),
            hour: intParam(p, 'hour') ?? undefined,
            gender: strParam(p, 'gender') ?? undefined,
            toAge: intParam(p, 'toAge') ?? undefined,
            ...readCalendar(p),
            applyDST: strParam(p, 'applyDST') === '0' ? false : undefined,
            city: strParam(p, 'city') ?? undefined,
        };
        runEngine(res, () => {
            if (guardYmd(p) === null) {
                throw new Error('缺出生年月日：year、month、day 都是必填（缺输入不猜，玄机阁纪律）');
            }
            checkHourRange(input.hour, undefined);
            return computeTrend(input);
        });
        return true;
    }

    // GET /tarot — 每日一牌 / 三牌阵（面板翻牌动画用）
    if (req.method === 'GET' && segments[0] === 'tarot' && segments.length === 1) {
        const p = parseQuery(url);
        const input = {
            mode: strParam(p, 'mode') ?? 'daily',
            question: strParam(p, 'question') ?? undefined,
            date: readDate(p),
        };
        runEngine(res, () => computeTarot(input));
        return true;
    }

    // GET /bazi — 四柱排盘（面板八字页用；与 xuanji_bazi 同引擎同口径，含统一时间管线）
    if (req.method === 'GET' && segments[0] === 'bazi' && segments.length === 1) {
        const p = parseQuery(url);
        runEngine(res, () => {
            if (guardYmd(p) === null) {
                throw new Error('缺出生年月日：year、month、day 都是必填（缺输入不猜，玄机阁纪律）');
            }
            const hour = intParam(p, 'hour') ?? undefined;
            const minute = intParam(p, 'minute') ?? undefined;
            checkHourRange(hour, minute);
            const cal = readCalendar(p);
            const rt = resolveBirthTime({
                year: intParam(p, 'year'),
                month: intParam(p, 'month'),
                day: intParam(p, 'day'),
                hour,
                minute,
                gender: strParam(p, 'gender') ?? undefined,
                ...cal,
                applyDST: strParam(p, 'applyDST') === '0' ? false : undefined,
                city: strParam(p, 'city') ?? undefined,
                longitude: numParam(p, 'longitude') ?? undefined,
            });
            const input = {
                year: rt.solar.year, month: rt.solar.month, day: rt.solar.day,
                hour: rt.timeKnown ? rt.hour : 12,
                minute: rt.minute,
                gender: strParam(p, 'gender'),
                calendar: 'solar',
                timeKnown: rt.timeKnown,
                notes: rt.notes,
            };
            const result = computeBazi(input, PLUGIN_CONFIG);
            // 排盘引擎吃的是换算后的公历，meta.calendar 恒为「公历」；
            // 这里补上**用户实际选的**历法，否则农历生日用户在面板上看到的仍是「公历」。
            result.meta.calendar = cal.calendar === 'lunar' ? '农历' : '公历';
            return result;
        });
        return true;
    }

    // GET /almanac — 每日黄历（面板黄历页用）
    if (req.method === 'GET' && segments[0] === 'almanac' && segments.length === 1) {
        const p = parseQuery(url);
        runEngine(res, () => computeAlmanac(readDate(p)));
        return true;
    }

    // GET /xiaoliuren — 小六壬（面板快占页用）
    if (req.method === 'GET' && segments[0] === 'xiaoliuren' && segments.length === 1) {
        const p = parseQuery(url);
        runEngine(res, () => computeXiaoliuren({
            mode: strParam(p, 'mode') === 'time' ? 'time' : 'number',
            date: readDate(p),
            hour: intParam(p, 'hour') ?? undefined,
            num1: intParam(p, 'num1') ?? undefined,
            num2: intParam(p, 'num2') ?? undefined,
            num3: intParam(p, 'num3') ?? undefined,
            question: strParam(p, 'question') ?? undefined,
        }));
        return true;
    }

    // GET /meihua — 梅花易数（面板快占页用）
    if (req.method === 'GET' && segments[0] === 'meihua' && segments.length === 1) {
        const p = parseQuery(url);
        runEngine(res, () => computeMeihua({
            mode: strParam(p, 'mode') === 'time' ? 'time' : 'number',
            date: readDate(p),
            hour: intParam(p, 'hour') ?? undefined,
            num1: intParam(p, 'num1') ?? undefined,
            num2: intParam(p, 'num2') ?? undefined,
            question: strParam(p, 'question') ?? undefined,
        }));
        return true;
    }

    // GET /chenggu — 称骨（面板称骨页用；时辰必填，缺了让引擎给可读错误）
    if (req.method === 'GET' && segments[0] === 'chenggu' && segments.length === 1) {
        const p = parseQuery(url);
        runEngine(res, () => {
            if (guardYmd(p) === null) {
                throw new Error('缺出生年月日：year、month、day 都是必填（缺输入不猜，玄机阁纪律）');
            }
            const hour = intParam(p, 'hour') ?? undefined;
            const hourZhi = strParam(p, 'hourZhi') ?? undefined;
            if (hour === undefined && hourZhi === undefined) {
                throw new Error('缺少必要输入：时辰。请提供 hour（0–23）或 hourZhi（子…亥）——称骨缺时辰不可算。');
            }
            checkHourRange(hour, undefined);
            // 与 xuanji_chenggu 工具同款：给了 hour 就走统一时间管线（含夏令时），
            // 否则 REST 面会比工具面少一道夏令时，1986–1991 出生者两边结果差整整一两、直接跨分档。
            // 历法归一必须在两条分支之前做：面板称骨页只给 hourZhi（不给 hour），
            // 早先那条分支把年月日直接当公历喂给引擎，农历生日用户的骨重会整体错一个月柱。
            const cal = readCalendar(p);
            const rd = resolveDate({
                year: intParam(p, 'year'),
                month: intParam(p, 'month'),
                day: intParam(p, 'day'),
                ...cal,
            });
            const calLabel = cal.calendar === 'lunar' ? '农历' : '公历';
            if (hour === undefined) {
                const direct = computeChenggu({
                    year: rd.solar.year, month: rd.solar.month, day: rd.solar.day,
                    hourZhi, calendar: 'solar',
                });
                direct.meta.notes = [
                    '时辰以 hourZhi 直传为准：未做夏令时/真太阳时校正（无钟面时间可校正），属口径差异',
                    ...(rd.note ? [rd.note] : []),
                ];
                direct.meta.inputCalendar = calLabel;
                return direct;
            }
            const rt = resolveBirthTime({
                year: intParam(p, 'year'),
                month: intParam(p, 'month'),
                day: intParam(p, 'day'),
                hour,
                ...cal,
                applyDST: strParam(p, 'applyDST') === '0' ? false : undefined,
            }, { requireHour: true });
            const result = computeChenggu({
                year: rt.solar.year, month: rt.solar.month, day: rt.solar.day,
                hour: rt.hour, calendar: 'solar',
            });
            if (rt.notes.length > 0) result.meta.notes = rt.notes;
            result.meta.inputCalendar = calLabel;
            return result;
        });
        return true;
    }

    return false;
}
