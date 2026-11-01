#!/usr/bin/env node
// scripts/verification.mjs — 跑公开对拍验证，生成 docs/verification.html。
// 与 test/verification.test.mjs 共用 lib/engine/verify.js 的锚点，确保「报告」与「CI 闸门」同源。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { runVerification, summarize } from '../lib/engine/verify.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { results, allPass, pass, total } = summarize(runVerification());

const groups = {};
for (const r of results) (groups[r.group] ??= []).push(r);

const rows = results.map((r) => `
  <tr class="${r.pass ? 'ok' : 'bad'}">
    <td>${r.group}</td><td>${r.name}</td>
    <td class="status">${r.pass ? '通过' : '失败'}</td>
    <td class="detail">${r.detail ? escapeHtml(r.detail) : ''}</td>
  </tr>`).join('');

const groupSummary = Object.entries(groups).map(([g, rs]) => {
    const ok = rs.filter((r) => r.pass).length;
    return `<li><b>${g}</b>：${ok}/${rs.length}</li>`;
}).join('');

const html = `<!doctype html>
<html lang="zh"><head><meta charset="utf-8"><title>玄机阁 · 公开对拍验证报告</title>
<style>
  body{font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;max-width:880px;margin:2rem auto;padding:0 1rem;color:#222;background:#fafafa}
  h1{font-size:1.4rem} .banner{padding:.6rem 1rem;border-radius:8px;font-weight:600}
  .allpass{background:#e6f6ec;color:#1a7f37} .notall{background:#fdecea;color:#b3261e}
  table{border-collapse:collapse;width:100%;margin-top:1rem;font-size:.9rem}
  th,td{border:1px solid #e2e2e2;padding:.5rem .6rem;text-align:left;vertical-align:top}
  th{background:#f0f0f0} tr.ok td.status{color:#1a7f37} tr.bad td.status{color:#b3261e;font-weight:700}
  .detail{color:#666;font-family:ui-monospace,monospace;font-size:.82rem}
  ul{columns:2;font-size:.9rem}
</style></head>
<body>
  <h1>玄机阁 · 公开对拍验证报告</h1>
  <div class="banner ${allPass ? 'allpass' : 'notall'}">${allPass ? `全部通过：${pass}/${total}` : `存在失败：${pass}/${total}`}</div>
  <p>锚点采用「独立重算」口径：预期值由最原始的干支原语在本地重推，不引用被测常量，避免「测试抄实现」导致的全绿但错。生成于 ${new Date().toISOString().slice(0, 10)}。</p>
  <h3>分组概览</h3><ul>${groupSummary}</ul>
  <table><thead><tr><th>分组</th><th>锚点</th><th>结果</th><th>明细</th></tr></thead><tbody>${rows}</tbody></table>
</body></html>`;

const outDir = path.join(root, 'docs');
mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'verification.html');
writeFileSync(outFile, html, 'utf8');
console.log(`✓ 对拍验证：${pass}/${total} 通过 → ${outFile}`);
if (!allPass) process.exit(1);

function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
