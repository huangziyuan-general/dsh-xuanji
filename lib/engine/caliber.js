// lib/engine/caliber.js — 口径对照：同一输入、切换一个开关/流派，看根字段变了哪些。
//
// 用途：复刻竞品的 caliber diff——「同一输入，只改一个 switch，根字段如何变」。
// 用于向用户证明「我切了流派 X，盘面的 日柱/用神/四化 随之变化」，也用于回归。
//
// 纯函数，不依赖任何引擎；引擎计算由调用方传入，保持本文件零业务耦合。

/**
 * 浅层取路径字段（支持点路径，如 'meta.dayun'）。
 * @param {any} obj
 * @param {string} path
 */
function getPath(obj, path) {
    return path.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
}

/**
 * 计算两套结果在指定字段上的差值。
 * @param {any} a 计算结果 A
 * @param {any} b 计算结果 B
 * @param {string[]} fields 要比对的字段路径（如 ['dayGanZhi','yongShen','meta.dayun']）
 * @returns {Array<{field:string, a:any, b:any, changed:boolean}>}
 */
export function caliberDiff(a, b, fields) {
    return fields.map((field) => {
        const av = getPath(a, field);
        const bv = getPath(b, field);
        let changed = false;
        try {
            changed = JSON.stringify(av) !== JSON.stringify(bv);
        } catch {
            changed = av !== bv;
        }
        return { field, a: av, b: bv, changed };
    });
}

/**
 * 给定同一引擎函数与两组参数，直接产出对照报告。
 * @param {(params:any)=>any} compute 引擎计算函数
 * @param {any} baseParams 基准参数
 * @param {any} variantParams 变体参数（通常只差一个开关）
 * @param {string[]} fields 比对字段
 * @param {(p:any)=>string} [idOf] 取影子盘 ID 的函数（可选，用于证实「同盘不同口径」）
 * @returns {{ base:any, variant:any, diff:ReturnType<typeof caliberDiff>, sameShadow:boolean|null }}
 */
export function caliberReport(compute, baseParams, variantParams, fields, idOf) {
    const base = compute(baseParams);
    const variant = compute(variantParams);
    const diff = caliberDiff(base, variant, fields);
    let sameShadow = null;
    if (typeof idOf === 'function') {
        try {
            sameShadow = idOf(baseParams) === idOf(variantParams);
        } catch {
            sameShadow = null;
        }
    }
    return { base, variant, diff, sameShadow };
}
