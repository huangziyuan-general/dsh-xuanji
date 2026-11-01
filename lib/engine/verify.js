// lib/engine/verify.js — 公开对拍验证骨架（P0「可信度」基础设施）。
//
// 思路对齐仓库既有 external-anchors 哲学：锚点里的「预期值」在本地**独立重算**（不 import 被测常量，
// 只用最原始的 GAN/ZHI 原语重推），避免「测试抄实现」导致的全绿但错。验证通过 runVerification()
// 汇总，供 test/verification.test.mjs（CI 闸门）与 scripts/verification.mjs（生成 docs/verification.html）共用。

import { yearGanZhi, xunKongOf, ZHI_CANGGAN, CHANG_SHENG, JIAZI } from './tables.js';
import { EIGHT_PALACES } from './liuyao.js';
import { computeMeihua } from './meihua.js';
import { FULL_DECK } from './tarot.js';
import { computeMbti } from './mbti.js';
import { CITATIONS, citationBooks } from './citations.js';

// ── 独立原语（不与被测模块共享常量，保证重算独立）──
const GAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'];
const ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];

/** 独立重算六十甲子（与 JIAZI 比对）。 */
function indepJiazhi() {
    return Array.from({ length: 60 }, (_, i) => GAN[i % 10] + ZHI[i % 12]);
}

/** 独立重算旬空（与 xunKongOf 比对）：甲子旬空戌亥。 */
function indepXunKong(ganZhi) {
    const idx = indepJiazhi().indexOf(ganZhi);
    if (idx < 0) return '';
    const start = idx - (idx % 10);
    return ZHI[(start + 10) % 12] + ZHI[(start + 11) % 12];
}

/** 独立重算某干长生位（与 CHANG_SHENG 比对）：仅校验甲木长生在亥。 */
function indepChangshengStart(gan) {
    const map = { 甲: '亥', 乙: '午', 丙: '寅', 丁: '酉', 戊: '寅', 己: '酉', 庚: '巳', 辛: '子', 壬: '申', 癸: '卯' };
    return map[gan];
}

/** 跑全部锚点，返回 [{ group, name, pass, detail }]。 */
export function runVerification() {
    const results = [];
    const add = (group, name, pass, detail = '') => results.push({ group, name, pass: !!pass, detail });

    // ── 干支 / 历法基础 ──
    add('干支', '1984 年为甲子年', yearGanZhi(1984) === '甲子', `yearGanZhi(1984)=${yearGanZhi(1984)}`);
    add('干支', '六十甲子 60 位且与独立重算一致', (() => {
        const mine = JIAZI;
        const ref = indepJiazhi();
        return mine.length === 60 && mine[0] === '甲子' && mine[59] === '癸亥' && mine.join('') === ref.join('');
    })());
    add('干支', '旬空：甲子旬空戌亥（独立重算一致）', (() => {
        const a = xunKongOf('甲子'); const b = indepXunKong('甲子');
        return a === '戌亥' && a === b;
    })(), `xunKongOf=${xunKongOf('甲子')} indep=${indepXunKong('甲子')}`);
    add('干支', '旬空：癸亥旬空子丑（独立重算一致）', (() => {
        const a = xunKongOf('癸亥'); const b = indepXunKong('癸亥');
        return a === '子丑' && a === b;
    })());
    add('干支', '藏干：子藏癸 / 寅藏甲丙戊', (() => {
        const ok1 = JSON.stringify(ZHI_CANGGAN['子']) === JSON.stringify(['癸']);
        const ok2 = JSON.stringify(ZHI_CANGGAN['寅']) === JSON.stringify(['甲', '丙', '戊']);
        return ok1 && ok2;
    })());
    add('干支', '十二长生：甲木长生在亥（独立重算一致）', (() => {
        const pos = indepChangshengStart('甲'); // 独立重算得长生位地支 '亥'
        return CHANG_SHENG['甲']['亥'] === '长生' && CHANG_SHENG['甲'][pos] === '长生';
    })());

    // ── 六爻八宫 ──
    add('六爻', '八宫 64 卦、无重复、皆合法卦序（King Wen 1–64）', (() => {
        const nums = EIGHT_PALACES.flatMap((p) => p.seq || []);
        return EIGHT_PALACES.length === 8 && nums.length === 64 && new Set(nums).size === 64 && nums.every((n) => n >= 1 && n <= 64);
    })(), `八宫序号数=${EIGHT_PALACES.flatMap((p) => p.seq || []).length}`);

    // ── 梅花易数（结构不变量）──
    add('梅花', '报数起卦返回本卦/互卦且为合法卦名', (() => {
        const r = computeMeihua({ mode: 'number', num1: 3, num2: 5, question: '验证' });
        return !!(r && r.gua && typeof r.gua.ben?.name === 'string' && typeof r.gua.hu?.name === 'string' && r.gua.ben.name.length >= 1);
    })());

    // ── 塔罗全牌 ──
    add('塔罗', '78 全牌、牌名唯一', (() => {
        return FULL_DECK.length === 78 && new Set(FULL_DECK.map((c) => c.name)).size === 78;
    })(), `FULL_DECK.length=${FULL_DECK.length}`);

    // ── MBTI 确定性 ──
    add('MBTI', '同答案同类型、档案非空', (() => {
        const a1 = computeMbti({ answers: Array(24).fill(0) });
        const a2 = computeMbti({ answers: Array(24).fill(0) });
        return a1.type && a1.type === a2.type && !!a1.profile;
    })(), `type=${computeMbti({ answers: Array(24).fill(0) }).type}`);

    // ── 引文索引 ──
    add('引文', '收录非空且至少覆盖 4 部经典', (() => {
        const books = citationBooks();
        const need = ['滴天髓', '子平真诠', '三命通会', '穷通宝鉴'];
        const ok = need.every((b) => books.includes(b));
        return CITATIONS.length > 0 && ok;
    })(), `books=${citationBooks().join('/')}`);
    add('引文', '每条引文有书目/主题/引文且非空', (() => {
        return CITATIONS.every((c) => c.book && c.topic && c.quote && c.quote.length > 0);
    })());

    return results;
}

/** 汇总：通过数 / 总数。 */
export function summarize(results = runVerification()) {
    const pass = results.filter((r) => r.pass).length;
    return { total: results.length, pass, fail: results.length - pass, allPass: pass === results.length, results };
}
