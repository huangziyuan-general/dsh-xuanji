// lib/server-http.js — REST 面共享的 HTTP 基元与路径工具。
//
// 与 dsh-novel-forge 同款契约：常量、响应封装、请求体解析、fence 校验、URL 解析。
// 面板（src/client）通过 fetch 调这些端点；服务端拿 fence header 当跨站调用门禁。

const FENCE_HEADER = 'x-dsh-xuanji';
const PREFIX = '/api/xuanji';

/** 写 JSON 响应。 */
export const writeJson = (res, status, value) => {
    res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
    });
    res.end(JSON.stringify(value));
};

/** 读请求体并解析 JSON（空体 → {}）。上限 1MB——本插件端点全是只读计算，防手滑即可。 */
export const readJsonBody = (req) => new Promise((resolve, reject) => {
    let data = '';
    let size = 0;
    req.on('data', (chunk) => {
        size += chunk.length;
        if (size > 1024 * 1024) {
            req.destroy();
            reject(new Error('请求体超过 1MB 上限'));
            return;
        }
        data += String(chunk);
    });
    req.on('end', () => {
        try { resolve(data ? JSON.parse(data) : {}); }
        catch { reject(new Error('invalid JSON body')); }
    });
    req.on('error', reject);
});

/** fence header 校验（防跨域调用）：只有带 `x-dsh-xuanji: 1` 的请求才放行。 */
export const trusted = (req) => req.headers[FENCE_HEADER] === '1';

/** 统一失败响应。 */
export const fail = (res, status, code, message) => {
    writeJson(res, status, { ok: false, error: { code, message: String(message ?? '') } });
};

/** 从请求 URL 解析路径段（去掉 PREFIX 前缀）。 */
export const parsePath = (url) => {
    const pathname = new URL(url ?? '/', 'http://localhost').pathname;
    const rest = pathname.slice(PREFIX.length);
    return rest.split('/').filter(Boolean);
};

/** 从请求 URL 解析查询参数。 */
export const parseQuery = (url) => new URL(url ?? '/', 'http://localhost').searchParams;

/** 整数查询参数：非法（缺/非整数）返回 null。 */
export const intParam = (params, key) => {
    const raw = params.get(key);
    if (raw === null || raw === '') return null;
    const n = Number(raw);
    return Number.isInteger(n) ? n : null;
};

/**
 * 带上下界的整数参数：越界即拒（返回 null 由路由给 400），不静默夹取。
 * 旧版 /fengshui?fyYear=99999 与 ?year=-1 一类输入一路穿到引擎，
 * 与其它端点「year 已在引擎层界住」的口径不一致（AUDIT REST 面）。
 */
export const boundedIntParam = (params, key, lo, hi) => {
    const n = intParam(params, key);
    if (n === null) return null;
    if (n < lo || n > hi) throw new RangeError(`${key} 须在 ${lo}–${hi} 之间，收到 ${n}`);
    return n;
};

/** 字符串查询参数单值上限（字符数）。 */
export const MAX_STR_LEN = 200;

/** 字符串查询参数：缺省返回 null；超长直接拒，避免响应体被输入线性放大。 */
export const strParam = (params, key, maxLen = MAX_STR_LEN) => {
    const raw = params.get(key);
    if (raw === null || raw === '') return null;
    if (raw.length > maxLen) {
        throw new RangeError(`${key} 过长（${raw.length} 字符，上限 ${maxLen}）`);
    }
    return raw;
};

/** 数值查询参数（含小数，如经度）：非法（缺/NaN）返回 null。 */
export const numParam = (params, key) => {
    const raw = params.get(key);
    if (raw === null || raw === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
};

export { PREFIX, FENCE_HEADER };
