// lib/skill-registration.js — 把插件携带的 xuanji skill 注册进宿主技能目录。
//
// 与 dsh-novel-forge 同款结论（0.1.7-rc.1 真机排障）：宿主没有「包内 skills/ 自动发现」，
// 必须用 ctx.skills.register() 运行时注册；注册放在嵌套子插件里并声明 ['skills']，
// 老宿主没有该服务时只有子 fiber 静默 pending，绝不牵连主插件（工具照常工作）。

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const SKILL_DIR = fileURLToPath(new URL('../skills/xuanji/', import.meta.url));
const SKILL_PATH = join(SKILL_DIR, 'SKILL.md');

/**
 * 极简 frontmatter 解析：只取 name / description 两个标量行，正文原样返回。
 * @param {string} raw SKILL.md 全文
 * @returns {{ attrs: Record<string,string>, body: string }}
 */
export function parseSkillFrontmatter(raw) {
    const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
    if (!match) return { attrs: {}, body: raw };
    const attrs = {};
    for (const line of match[1].split(/\r?\n/)) {
        const m = /^([\w][\w-]*):\s*(.*)$/.exec(line.trim());
        if (m) attrs[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
    return { attrs, body: raw.slice(match[0].length).replace(/^\r?\n/, '') };
}

/**
 * 从插件包内 skills/xuanji/SKILL.md 组装运行时注册定义。
 * @returns {{ name: string, description: string, content: string, source: string, path: string }}
 */
export function xuanjiSkillDefinition() {
    const raw = readFileSync(SKILL_PATH, 'utf8');
    const { attrs, body } = parseSkillFrontmatter(raw);
    const description = (attrs.description ?? '玄机阁工作流指令包：八字/梅花/黄历/称骨/星座的排盘纪律与四层输出规范。').slice(0, 300);
    return {
        name: attrs.name ?? 'xuanji',
        description,
        content: body,
        source: 'plugin:dsh-xuanji',
        path: SKILL_PATH,
    };
}

/**
 * 向 ctx.skills 注册 xuanji skill。skills 服务缺席（老宿主）或注册抛错时返回 false 并 warn。
 * @param {object} ctx cordis 插件 ctx
 * @returns {boolean} 是否注册成功
 */
export function registerXuanjiSkill(ctx) {
    try {
        const skills = ctx?.skills;
        if (typeof skills?.register !== 'function') return false;
        skills.register(xuanjiSkillDefinition());
        return true;
    } catch (error) {
        const warn = ctx?.logger?.warn ?? console.warn;
        warn('[dsh-xuanji] xuanji skill 注册失败（不影响工具）：', error?.message ?? error);
        return false;
    }
}

/** 嵌套子插件：独立声明 ['skills']，老宿主上最多自身 pending，不拖累主插件。 */
export const XuanjiSkillPlugin = {
    name: 'dsh-xuanji-skill',
    inject: ['skills'],
    apply(ctx) {
        registerXuanjiSkill(ctx);
    },
};
