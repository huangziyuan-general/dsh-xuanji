// lib/engine/trace.js — 推导链：让引擎把「算到某一步的依据」显式记下来。
//
// 用途：
//   · 工具/面板回显「为什么」（同竞品的 step-by-step deduction trace）；
//   · 对拍验证时，某一字段错了能直接定位到是哪一步的 rule / inputs 出问题；
//   · 与 shadow-id / caliber 配合，构成「可核验」基础设施。
//
// 设计：createTrace(scope) 返回一个 tracer，引擎每推导出一步就 tracer.step(...)。
// steps 不可变快照，inputs/result 深拷贝，避免后续对象被改动污染 trace。

/** 安全深拷贝（失败则原样返回，绝不抛错污染调用方）。 */
function safeClone(v) {
    if (v === null || typeof v !== 'object') return v;
    try {
        return structuredClone(v);
    } catch {
        try {
            return JSON.parse(JSON.stringify(v));
        } catch {
            return v;
        }
    }
}

/**
 * 创建一个推导链收集器。
 * @param {string} [scope] 所属引擎/阶段，如 'liuyao' / 'daliuren' / 'mbti'
 */
export function createTrace(scope = 'engine') {
    /** @type {Array<{field:string, rule:string, inputs:any, result:any, source?:string}>} */
    const steps = [];
    const api = {
        scope,
        /**
         * 记录一步推导。
         * @param {string} field 字段名（如 '日干' / '四课第一课' / '三传·初传'）
         * @param {string} rule 判定规则（如 '天盘加临：月将入占时宫顺布'）
         * @param {any} inputs 这一步的输入（会被深拷贝）
         * @param {any} result 这一步的结果（会被深拷贝）
         * @param {string} [source] 出处（如 '《大六壬指南》四课法'）
         * @returns {any} 原样返回 result，便于引擎内联：return tracer.step(..., x)
         */
        step(field, rule, inputs, result, source) {
            steps.push({
                field: String(field),
                rule: String(rule),
                inputs: safeClone(inputs),
                result: safeClone(result),
                ...(source ? { source: String(source) } : {}),
            });
            return result;
        },
        /** 返回不可变快照（新数组，内含深拷贝项）。 */
        steps: () => safeClone(steps),
        /** 序列化为对象，可直接挂到引擎返回的 meta.trace。 */
        toObject() {
            return { scope, steps: safeClone(steps) };
        },
    };
    return api;
}

/**
 * 给现有引擎结果附加 trace 的小工具：fn 接收一个 tracer，应返回 { value, trace? }。
 * 仅用于不便直接改签名的引擎做薄封装。
 * @template T
 * @param {string} scope
 * @param {(tracer:ReturnType<typeof createTrace>)=>T} fn
 * @returns {{ value:T, trace:ReturnType<typeof createTrace>['toObject'] }}
 */
export function withTrace(scope, fn) {
    const tracer = createTrace(scope);
    const value = fn(tracer);
    return { value, trace: tracer.toObject() };
}
