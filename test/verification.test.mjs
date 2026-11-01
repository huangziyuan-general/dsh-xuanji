// test/verification.test.mjs — 公开对拍验证（CI 闸门）：全部锚点须通过。
// 与 scripts/verification.mjs 共用 lib/engine/verify.js 的锚点。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runVerification, summarize } from '../lib/engine/verify.js';

const results = runVerification();
const { pass, total, allPass } = summarize(results);

test('对拍验证：全部锚点通过', () => {
    if (!allPass) {
        const failed = results.filter((r) => !r.pass).map((r) => `· [${r.group}] ${r.name} — ${r.detail}`);
        assert.fail(`对拍验证未全过（${pass}/${total}）：\n${failed.join('\n')}`);
    }
    assert.equal(pass, total);
});

test('对拍验证：锚点覆盖分组数 ≥ 6', () => {
    const groups = new Set(results.map((r) => r.group));
    assert.ok(groups.size >= 6, `分组数应 ≥ 6，实际 ${groups.size}`);
});
