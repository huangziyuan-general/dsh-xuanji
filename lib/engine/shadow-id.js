// lib/engine/shadow-id.js — 影子盘 ID：同一组归一化参数 → 同一确定性短 ID。
//
// 用途：
//   · 同一人/同一盘在「不同开关、不同流派」下能用一个稳定 ID 关联（同竞品的 shadow chart ID）；
//   · 版本升级后，比对同一 ID 的字段差异（配合 caliber.js 的口径对照）；
//   · 对外只展示 ID 不展示完整生辰，契合 discipline 第 9 条「最小回显」。
//
// 算法：FNV-1a(32) 对「稳定排序后的 key=value」求哈希 → 8 位十六进制，前缀 `LY-`。
// 输入必须先行归一（缺省填 undefined 而非删除 key，保证同输入同序）。

/** FNV-1a 32 位哈希。 */
function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
}

/**
 * 归一化对象为「稳定字符串」：key 升序，value 用 JSON 字符串化。
 * 值为 undefined 的 key 视为「未提供」直接跳过——这样 {a:1,b:undefined} 与 {a:1} 同串，
 * 契合「归一化参数」语义（缺省填 undefined 而非删除 key，保证同输入同序）。
 */
function canonical(obj) {
    const keys = Object.keys(obj ?? {}).sort();
    return keys
        .filter((k) => obj[k] !== undefined)
        .map((k) => `${k}=${JSON.stringify(obj[k])}`)
        .join('&');
}

/**
 * 计算影子盘 ID。
 * @param {Record<string, any>} params 归一化后的排盘参数（如 {system:'bazi', year:1990, month:8, day:16, hour:14, gender:'male'}）
 * @returns {string} 如 'LY-3f9a1c07'
 */
export function shadowId(params) {
    const sum = fnv1a(canonical(params));
    return 'LY-' + sum.toString(16).padStart(8, '0');
}

/**
 * 给定两套参数，比较是否落到同一影子盘（同人不同流派/开关时应为 true）。
 * @returns {boolean}
 */
export function sameShadow(a, b) {
    return shadowId(a) === shadowId(b);
}
