// test/discipline.test.mjs — 行为评测：把「玄学输出纪律」从一段 systemPrompt 变成可回归断言。
//
// 为什么要有这一层：引擎测试只证明「算得对」，证明不了「该不该这么答」。纪律写在
// systemPrompt 里，改坏了没人报警；模型违约了也没人知道。所以这里把纪律拆成两类可测项：
//
//   kind=engine   —— 引擎侧真跑一遍，断言它确实把纪律做进了代码
//                    （缺时辰不许补子时、没给出生地不许偷偷校正、非法日期要给中文错误…）
//   kind=contract —— 断言纪律文本本身含这条约束（模型侧行为无法在单测里跑模型，
//                    至少保证「规则还在」——被人删掉会立刻红）
//
// 用例是一个 JSON 一个文件（test/discipline-evals/cases/），加规则不用改 runner。
// 参照 dhicoc/dsh-chinese-traditional-wisdom-skill 的 skill-evals 思路，但断言落在
// 我们自己的引擎与纪律文件上，不做模型调用、不联网。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { XUANJI_DISCIPLINE } from '../lib/discipline.js';
import { computeBazi } from '../lib/engine/bazi.js';
import { resolveBirthTime } from '../lib/engine/birth-time.js';
import { resolveDate } from '../lib/engine/calendar.js';
import { computeMeihua } from '../lib/engine/meihua.js';

const CASES_DIR = new URL('./discipline-evals/cases/', import.meta.url);

/** 引擎入口表：加引擎就在这里登记，用例里用 "engine" 字段引用。 */
const ENGINES = {
    bazi: (args) => computeBazi(args, {}),
    birthTime: (args) => resolveBirthTime(args),
    resolveDate: (args) => resolveDate(args),
    meihua: (args) => computeMeihua(args),
    discipline: () => ({ text: XUANJI_DISCIPLINE }),
};

/** 取嵌套字段：'meta.timeKnown' → obj.meta.timeKnown；'throws' 由调用方特殊处理。 */
function readPath(obj, p) {
    return p.split('.').reduce((acc, k) => (acc == null ? undefined : acc[k]), obj);
}

/** 单条断言。operator 集合刻意保持很小——每多一个算子就多一处要维护的解释。 */
function runAssertion(a, actual, label) {
    const { operator, value, why } = a;
    const detail = why ? ` — ${why}` : '';
    switch (operator) {
        case 'equals':
            assert.deepEqual(actual, value, `${label} 期望 ${JSON.stringify(value)}，实际 ${JSON.stringify(actual)}${detail}`);
            break;
        case 'not-equals':
            assert.notDeepEqual(actual, value, `${label} 不应等于 ${JSON.stringify(value)}${detail}`);
            break;
        case 'missing':
            assert.equal(actual ?? null, null, `${label} 应当缺失，实际 ${JSON.stringify(actual)}${detail}`);
            break;
        case 'exists':
            assert.ok(actual !== undefined && actual !== null && actual !== '', `${label} 不应为空${detail}`);
            break;
        case 'matches':
            assert.match(String(actual ?? ''), new RegExp(value), `${label} 应匹配 /${value}/，实际 ${JSON.stringify(actual)}${detail}`);
            break;
        case 'not-matches':
            assert.doesNotMatch(String(actual ?? ''), new RegExp(value), `${label} 不应匹配 /${value}/，实际 ${JSON.stringify(actual)}${detail}`);
            break;
        case 'matches-any':
            assert.ok(
                (Array.isArray(actual) ? actual : [actual]).some((x) => new RegExp(value).test(String(x ?? ''))),
                `${label} 至少一项应匹配 /${value}/，实际 ${JSON.stringify(actual)}${detail}`,
            );
            break;
        case 'not-matches-any':
            assert.ok(
                !(Array.isArray(actual) ? actual : [actual]).some((x) => new RegExp(value).test(String(x ?? ''))),
                `${label} 任何一项都不该匹配 /${value}/，实际 ${JSON.stringify(actual)}${detail}`,
            );
            break;
        default:
            throw new Error(`未知断言算子「${operator}」——用例写错了，不是被测代码错了`);
    }
}

const files = fs.readdirSync(CASES_DIR).filter((f) => f.endsWith('.json')).sort();

test('行为评测：用例目录非空且 schema 合法', () => {
    assert.ok(files.length >= 8, `用例太少（${files.length}）——这套评测至少要覆盖核心纪律`);
    for (const f of files) {
        const c = JSON.parse(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'discipline-evals', 'cases', f), 'utf8'));
        assert.equal(c.schemaVersion, '1.0.0', `${f} schemaVersion 不对`);
        assert.ok(c.id && c.rule && c.kind, `${f} 缺 id/rule/kind`);
        assert.ok(['engine', 'contract'].includes(c.kind), `${f} kind 只能是 engine 或 contract`);
        assert.ok(c.assertions?.length > 0, `${f} 没有断言`);
    }
});

for (const file of files) {
    const c = JSON.parse(fs.readFileSync(new URL(`./discipline-evals/cases/${file}`, import.meta.url), 'utf8'));
    test(`[${c.id}] ${c.rule}`, () => {
        const run = ENGINES[c.kind === 'contract' ? 'discipline' : c.engine];
        assert.ok(run, `用例 ${c.id} 引用了未登记的引擎「${c.engine}」`);

        let out;
        let thrown = null;
        try {
            out = run(c.args ?? {});
        } catch (e) {
            thrown = e;
        }

        for (const a of c.assertions) {
            const label = `${c.id} ${a.path}`;
            if (a.path === 'throws') {
                assert.ok(thrown, `${label} 期望抛错，实际正常返回${a.why ? ` — ${a.why}` : ''}`);
                runAssertion(a, thrown.message, label);
                continue;
            }
            assert.equal(thrown, null, `${label} 不该抛错：${thrown?.message}`);
            if (a.path === 'repeatable') {
                const again = run(c.args ?? {});
                assert.deepEqual(again, out, `${label} 同输入两次结果必须一致（确定性查找，不允许即兴）`);
                runAssertion(a, true, label);
                continue;
            }
            runAssertion(a, readPath(out, a.path), label);
        }
    });
}
