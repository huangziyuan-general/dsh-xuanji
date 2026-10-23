// test/tarot.test.mjs — 塔罗引擎：牌表、确定性、三牌阵不重复、缺问题 fail-fast。
import test from 'node:test';
import assert from 'node:assert/strict';

import { computeTarot, MAJOR_ARCANA } from '../lib/engine/tarot.js';

test('大阿卡纳：22 张、编号 0–21 无重复、关键词非空', () => {
    assert.equal(MAJOR_ARCANA.length, 22);
    const nums = new Set(MAJOR_ARCANA.map((c) => c.num));
    assert.equal(nums.size, 22);
    for (const c of MAJOR_ARCANA) {
        assert.ok(c.name.length >= 1 && c.up.length > 0 && c.down.length > 0 && c.text.length > 0);
    }
});

test('每日一牌：同日同牌同正逆位，不同日可不同', () => {
    const a = computeTarot({ mode: 'daily', date: '2026-10-22' });
    const b = computeTarot({ mode: 'daily', date: '2026-10-22' });
    assert.deepEqual(a.card, b.card);
    assert.ok(['正位', '逆位'].includes(a.card.orientation));
    // 22 天里至少出现 10 张不同的牌（哈希均匀性粗检）
    const distinct = new Set(Array.from({ length: 22 }, (_, i) => {
        const d = new Date(Date.UTC(2026, 0, 1 + i));
        const p = (n) => String(n).padStart(2, '0');
        return computeTarot({ mode: 'daily', date: `2026-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}` }).card.name;
    }));
    assert.ok(distinct.size >= 10, `22 天仅出现 ${distinct.size} 张牌，哈希均匀性存疑`);
});

test('三牌阵：过去/现在/未来三张不重复，含正逆位与关键词', () => {
    const r = computeTarot({ mode: 'three', question: '换工作', date: '2026-10-22' });
    assert.deepEqual(r.cards.map((c) => c.position), ['过去', '现在', '未来']);
    const names = r.cards.map((c) => c.name);
    assert.equal(new Set(names).size, 3, '三牌不应重复');
    for (const c of r.cards) {
        assert.ok(c.keyword.length > 0 && c.text.length > 0);
        assert.ok(['正位', '逆位'].includes(c.orientation));
    }
});

test('三牌阵缺 question fail-fast（不代填）', () => {
    assert.throws(() => computeTarot({ mode: 'three' }), /question/);
});

test('确定性：同输入两次结果一致', () => {
    const input = { mode: 'three', question: '该项目能成吗', date: '2026-10-22' };
    assert.deepEqual(computeTarot(input), computeTarot(input));
});

test('三牌撞车换牌时牌名/关键词/释义同源一致（自洽性）', async () => {
    const { MAJOR_ARCANA } = await import('../lib/engine/tarot.js');
    // 扫一年（每月 1/4/7…28 日共 108 个种子）：三牌不重名，且每张的关键词/释义必须等于该牌名的对应正逆位文案
    const seen = new Set();
    for (let m = 1; m <= 12; m++) {
        for (let d = 1; d <= 28; d += 3) {
            const date = `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const r = computeTarot({ mode: 'three', question: '一致性质检', date });
            assert.equal(new Set(r.cards.map((c) => c.name)).size, 3, `date=${date} 三牌应不重名`);
            for (const c of r.cards) {
                const card = MAJOR_ARCANA.find((x) => x.name === c.name);
                assert.ok(card, `牌名 ${c.name} 必须在大阿卡纳表内`);
                assert.equal(c.num, card.num, '牌号与牌名同源');
                const expectedKeyword = c.orientation === '逆位' ? card.down : card.up;
                assert.equal(c.keyword, expectedKeyword, `「${c.name}（${c.orientation}）」关键词必须来自同一张牌`);
                assert.equal(c.text, card.text, '释义必须来自同一张牌');
                seen.add(`${c.name}|${c.orientation}|${c.keyword}`);
            }
        }
    }
    assert.ok(seen.size >= 30, '扫一年应覆盖大部分牌/方向组合（上限 22 牌 × 2 方向 = 44）');
});
