// test/tarot78.test.mjs — 塔罗补全 78 全牌 + 1/3/5 牌阵（v0.4.0 扩展）验证。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTarot, MAJOR_ARCANA, MINOR_ARCANA, FULL_DECK } from '../lib/engine/tarot.js';

test('牌库规模：大阿卡纳 22 + 小阿卡纳 56 = 全牌 78，且全名唯一', () => {
    assert.equal(MAJOR_ARCANA.length, 22);
    assert.equal(MINOR_ARCANA.length, 56);
    assert.equal(FULL_DECK.length, 78);
    assert.equal(new Set(FULL_DECK.map((c) => c.name)).size, 78, '牌名应全唯一');
    for (const c of MINOR_ARCANA) {
        assert.ok(c.suit && c.rank, `小阿卡纳 ${c.name} 缺 suit/rank`);
        assert.ok(c.up && c.down && c.text, `小阿卡纳 ${c.name} 释义不全`);
    }
});

test('小阿卡纳覆盖四花色 × 14（Ace–10 + 侍从/骑士/王后/国王）', () => {
    const bySuit = {};
    for (const c of MINOR_ARCANA) bySuit[c.suit] = (bySuit[c.suit] ?? 0) + 1;
    assert.deepEqual(bySuit, { 权杖: 14, 圣杯: 14, 宝剑: 14, 星币: 14 });
    const expectedRanks = ['Ace', ...Array.from({ length: 9 }, (_, i) => String(i + 2)), '侍从', '骑士', '王后', '国王'];
    // 每张 rank 应恰好出现在 4 个花色里
    for (const r of expectedRanks) {
        const count = MINOR_ARCANA.filter((c) => c.rank === r).length;
        assert.equal(count, 4, `rank ${r} 应出现 4 次（每花色一张），实际 ${count}`);
    }
    assert.equal(new Set(MINOR_ARCANA.map((c) => c.rank)).size, 14, '应有 14 种不同 rank');
});

test('deck=full 每日一牌来自全牌库', () => {
    const r = computeTarot({ mode: 'daily', deck: 'full', date: '2026-10-22' });
    assert.ok(FULL_DECK.some((c) => c.name === r.card.name), '抽出的牌应在 78 全牌内');
});

test('deck=major 仍只用 22 大阿卡纳（向后兼容）', () => {
    const r = computeTarot({ mode: 'daily', deck: 'major', date: '2026-10-22' });
    assert.ok(MAJOR_ARCANA.some((c) => c.name === r.card.name));
});

test('五牌阵：位置正确且无重名（含去重逻辑）', () => {
    const r = computeTarot({ mode: 'five', deck: 'full', question: '今年事业', date: '2026-10-22' });
    assert.deepEqual(r.cards.map((c) => c.position), ['过去', '现在', '未来', '建议', '结果']);
    assert.equal(new Set(r.cards.map((c) => c.name)).size, 5, '五牌不应重名');
    for (const c of r.cards) {
        assert.ok(c.keyword.length > 0 && c.text.length > 0);
        assert.ok(['正位', '逆位'].includes(c.orientation));
    }
});

test('五牌阵缺 question fail-fast', () => {
    assert.throws(() => computeTarot({ mode: 'five', deck: 'full' }), /question/);
});

test('全牌库下 1/3/5 牌阵确定性（同输入同结果）', () => {
    const base = { mode: 'three', deck: 'full', question: 'Q', date: '2026-10-22' };
    assert.deepEqual(computeTarot(base), computeTarot(base));
    const base5 = { mode: 'five', deck: 'full', question: 'Q', date: '2026-10-22' };
    assert.deepEqual(computeTarot(base5), computeTarot(base5));
});

test('五牌全年来看牌名/释义同源一致（去重不串台）', () => {
    for (let m = 1; m <= 12; m++) {
        for (let d = 1; d <= 28; d += 4) {
            const date = `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const r = computeTarot({ mode: 'five', deck: 'full', question: '一致性', date });
            assert.equal(new Set(r.cards.map((c) => c.name)).size, 5, `date=${date} 五牌应不重名`);
            for (const c of r.cards) {
                const card = FULL_DECK.find((x) => x.name === c.name);
                assert.ok(card, `date=${date} 抽到未知牌 ${c.name}`);
                const expectKw = c.orientation === '逆位' ? card.down : card.up;
                assert.equal(c.keyword, expectKw, `date=${date} 牌 ${c.name} 关键词应与正逆位同源`);
                assert.equal(c.text, card.text, `date=${date} 牌 ${c.name} 释义应同源`);
            }
        }
    }
});
