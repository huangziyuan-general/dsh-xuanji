// lib/index.js — dsh-xuanji（玄机阁）Node 半入口（cordis 插件）。
//
// 装载即做三件事：
//   ① 注册 5 个 xuanji_* 工具（八字/梅花/黄历/称骨/星座，全部纯本地确定性计算）；
//   ② 注入一段系统提示：玄学输出纪律（数字只认工具、缺输入先问不猜、四层输出）；
//   ③ 嵌套子插件注册 xuanji skill（宿主无 skills 服务时不牵连主插件）。
//
// 宿主契约（与 dsh-novel-forge / dsh-files 同款）：export name 与 cordis.patch.yml 行 id
// 一致；Config 走 schemastery；apply 里 fail-fast 校验配置。

import z from '@deepseek-ai/schemastery';
import { defineBaziTool } from './tools/bazi-tool.js';
import { defineMeihuaTool } from './tools/meihua-tool.js';
import { defineAlmanacTool } from './tools/almanac-tool.js';
import { defineChengguTool } from './tools/chenggu-tool.js';
import { defineStarTool } from './tools/star-tool.js';
import { defineZiweiTool } from './tools/ziwei-tool.js';
import { defineZeriTool } from './tools/zeri-tool.js';
import { defineFengshuiTool } from './tools/fengshui-tool.js';
import { defineNameTool } from './tools/name-tool.js';
import { defineTrendTool } from './tools/trend-tool.js';
import { defineTarotTool } from './tools/tarot-tool.js';
import { defineXiaoliurenTool } from './tools/xiaoliuren-tool.js';
import { defineMatchTool } from './tools/match-tool.js';
import { defineNumerologyTool } from './tools/numerology-tool.js';
import { XuanjiSkillPlugin } from './skill-registration.js';
import { registerServerApi } from './server-api.js';
import { XUANJI_DISCIPLINE } from './discipline.js';

/** Cordis 插件名——必须与 cordis.patch.yml 的行 id 一致。 */
export const name = 'dsh-xuanji';

/** 依赖的宿主服务：工具注册表、系统提示。
 *  刻意不声明 skills/fs/sessions 等可选服务：cordis 数组 inject 没有可选语义，
 *  名字缺席会让整个插件永远 pending。skill 走嵌套子插件（见 skill-registration.js）。 */
export const inject = ['tools', 'systemPrompt'];

export const Config = z.object({
    /** 八字大运条数（1–12，含起运后第 1 步运）。 */
    dayunCount: z.number().default(8),
    /**
     * 晚子时日柱口径（23:00–24:00 出生日柱归属的流派分歧；只作用于 xuanji_bazi 的日柱，
     * 紫微用 iztro 自身口径、称骨无日柱概念，均不受本配置影响）：
     * · 1（默认）：按次日日柱（与当代主流排盘软件一致）；
     * · 2：按当日日柱。
     */
    ziShi: z.union([z.const(1), z.const(2)]).default(1),
    /** 跳过 skill 注册（调试用；一般不需要动）。 */
    skipSkillRegister: z.boolean().default(false),
}).default({});

export function apply(ctx, config) {
    if (!Number.isInteger(config.dayunCount) || config.dayunCount < 1 || config.dayunCount > 12) {
        throw new Error(`dsh-xuanji: dayunCount 必须是 1–12 的整数（当前 ${config.dayunCount}）`);
    }
    // ziShi 缺省视为 1（真宿主装配时 schemastery .default(1) 已填充；
    // 直传部分配置的场景（测试/MCP 通道）给 undefined 也按默认放行，不让它误 fail-fast。
    if (config.ziShi !== undefined && config.ziShi !== 1 && config.ziShi !== 2) {
        throw new Error(`dsh-xuanji: ziShi 必须是 1（次日）或 2（当日）（当前 ${config.ziShi}）`);
    }

    process.stderr.write('[dsh-xuanji] 玄机阁已装载：14 个 xuanji_* 工具全部本地确定性排盘，模型只解读。\n');

    ctx.systemPrompt.section({
        name: 'tool:dsh-xuanji',
        order: 110,
        // 纪律的唯一来源是 lib/discipline.js（SKILL.md 只引用不复制，防两处漂移）。
        text: XUANJI_DISCIPLINE,
    });

    ctx.tools.register(defineBaziTool(ctx, config));
    ctx.tools.register(defineZiweiTool(ctx, config));
    ctx.tools.register(defineMeihuaTool());
    ctx.tools.register(defineAlmanacTool());
    ctx.tools.register(defineChengguTool());
    ctx.tools.register(defineStarTool());
    ctx.tools.register(defineZeriTool());
    ctx.tools.register(defineFengshuiTool());
    ctx.tools.register(defineNameTool());
    ctx.tools.register(defineTrendTool());
    ctx.tools.register(defineTarotTool());
    ctx.tools.register(defineXiaoliurenTool());
    ctx.tools.register(defineMatchTool());
    ctx.tools.register(defineNumerologyTool());

    if (config.skipSkillRegister !== true && typeof ctx.plugin === 'function') {
        ctx.plugin(XuanjiSkillPlugin);
    }

    // 面板 REST 数据面（/api/xuanji/*，只读确定性计算）：宿主没有 webServer 服务时
    // 只有这条 fiber 静默 pending，不牵连工具与 skill（与 novel-forge 同款宽进）。
    // 整段包 try/catch：面板属于可选能力，它的任何失败都不许把 14 个工具的注册拖下水。
    if (typeof ctx.inject === 'function') {
        try {
            registerServerApi(ctx, config);
        } catch (error) {
            process.stderr.write(`[dsh-xuanji] 面板 REST 面注册失败（工具不受影响）：${error?.message ?? error}\n`);
        }
    }
}
