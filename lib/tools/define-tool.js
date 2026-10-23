// lib/tools/define-tool.js — defineTool 兼容垫片。
//
// 与 dsh-novel-forge 同款职责：
// ① 顶层 render / presentationMeta 归位到 output 下（宿主只读 output.render）；
// ② 参数表非空时包一层 execute，拒绝未知字段（宿主 schema 无 additionalProperties 开关）。
// 说明：@deepseek-ai/dsh-tools 是宿主提供的 peer 依赖（DSH 运行时总在位）。「包缺席退回
// 本地实现」并不成立——静态 import 缺包时本模块根本无法加载；下面的兜底只防御宿主导出缺定义。
import { defineTool as hostDefineTool } from '@deepseek-ai/dsh-tools';

const impl = hostDefineTool ?? ((options) => options);

export function defineTool(options) {
    const { render, presentationMeta, ...rest } = options;
    if (rest.output !== undefined) {
        const out = { ...rest.output };
        if (render !== undefined && out.render === undefined) out.render = render;
        if (presentationMeta !== undefined && out.presentationMeta === undefined) out.presentationMeta = presentationMeta;
        rest.output = out;
    }
    if (typeof rest.execute === 'function' && rest.parameters && Object.keys(rest.parameters).length > 0) {
        const allowed = new Set(Object.keys(rest.parameters));
        const userExecute = rest.execute;
        rest.execute = (args, exec) => {
            const unknown = Object.keys(args ?? {}).filter((k) => !allowed.has(k));
            if (unknown.length > 0) {
                throw new Error(`无效参数（未知字段）：${unknown.join('、')}；可用参数：${[...allowed].join('、')}`);
            }
            return userExecute(args, exec);
        };
    }
    return impl(rest);
}
