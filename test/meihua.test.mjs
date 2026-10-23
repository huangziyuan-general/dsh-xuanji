// test/meihua.test.mjs — 梅花引擎：以《梅花易数》观梅占原文为金标准做复原验证。
import test from 'node:test';
import assert from 'node:assert/strict';

import { computeMeihua } from '../lib/engine/meihua.js';
import { HEXAGRAMS, TRIGRAMS, hexagramByLines, hexagramSymbol } from '../lib/engine/hexagrams.js';
import { Lunar } from 'lunar-javascript';

test('六十四卦表完整性：64 卦唯一、非纯卦命名与上下卦一致', () => {
    const seen = new Set();
    for (const [up, row] of Object.entries(HEXAGRAMS)) {
        for (const [lo, hex] of Object.entries(row)) {
            assert.ok(!seen.has(hex.kingWen), `卦序 ${hex.kingWen} 重复（${hex.name}）`);
            seen.add(hex.kingWen);
            if (up !== lo) {
                const prefix = TRIGRAMS[up].nature + TRIGRAMS[lo].nature;
                assert.ok(hex.name.startsWith(prefix), `${up}下${lo} 卦名「${hex.name}」应以「${prefix}」开头`);
            }
        }
    }
    assert.equal(seen.size, 64);
    for (let k = 1; k <= 64; k++) assert.ok(seen.has(k), `缺卦序 ${k}`);
});

test('卦画 Unicode：乾 ䷀、坤 ䷁、未济 ䷿（U+4DC0 起按卦序）', () => {
    assert.equal(hexagramSymbol(1), '䷀');
    assert.equal(hexagramSymbol(2), '䷁');
    assert.equal(hexagramSymbol(64), '䷿');
});

test('逐爻反查：下兑上乾（兑[1,1,0] + 乾[1,1,1]）→ 天泽履(10)', () => {
    const hex = hexagramByLines([1, 1, 0, 1, 1, 1]);
    assert.equal(hex.name, '天泽履');
    assert.equal(hex.kingWen, 10);
    // 反向：下乾上兑 → 泽天夬(43)
    const guai = hexagramByLines([1, 1, 1, 1, 1, 0]);
    assert.equal(guai.name, '泽天夬');
});

test('观梅占复原：辰年腊月十七申时 → 泽火革初爻动、互见乾巽、变泽山咸、用克体', () => {
    const solar = Lunar.fromYmd(2000, 12, 17).getSolar().toYmd(); // 农历庚辰年十二月十七
    const r = computeMeihua({ mode: 'time', date: solar, hour: 16 });
    assert.equal(r.meta.mode, '时间起卦');
    assert.equal(r.gua.ben.name, '泽火革');
    assert.equal(r.gua.movingYao, 1);
    assert.equal(r.gua.hu.upper, '乾');
    assert.equal(r.gua.hu.lower, '巽');
    assert.equal(r.gua.bian.name, '泽山咸');
    assert.equal(r.tiYong.ti.name, '兑'); // 体=不动的上卦
    assert.equal(r.tiYong.yong.name, '离'); // 用=动爻所在的下卦
    assert.equal(r.tiYong.relation, '用克体'); // 离火克兑金，与原文断吉凶一致
    assert.equal(r.tiYong.level, '凶');
});

test('报数起卦：7、8 + 子时(23 时)→ 上艮下坤 山地剥、第四爻动', () => {
    // 上卦 7→艮，下卦 8→坤，动数 7+8+时辰序1(子时) = 16 → (16-1)%6+1 = 第4爻
    // 必须显式给 hourForNumber：未报时辰时引擎取「当前真实时刻」，结果随运行时钟变化，
    // 早期版本把它固定成子时1，等于用一个常年不成立的假设值起卦。
    const r = computeMeihua({ mode: 'number', num1: 7, num2: 8, hourForNumber: 23 });
    assert.equal(r.gua.ben.upper, '艮');
    assert.equal(r.gua.ben.lower, '坤');
    assert.equal(r.gua.ben.name, '山地剥');
    assert.equal(r.gua.movingYao, 4);
    assert.equal(r.meta.mode, '报数起卦');
});

test('报数起卦：未报时辰取当前真实时刻（不是固定假设子时）', () => {
    const nowHour = new Date().getHours();
    const r = computeMeihua({ mode: 'number', num1: 7, num2: 8 });
    // 校验口径：结果必须等价于「把当前时刻显式传进去」
    const explicit = computeMeihua({ mode: 'number', num1: 7, num2: 8, hourForNumber: nowHour });
    assert.equal(r.gua.movingYao, explicit.gua.movingYao);
    assert.ok(r.gua.movingYao >= 1 && r.gua.movingYao <= 6);
});

test('体用规则：动爻在上卦 → 上卦为用、下卦为体', () => {
    // 8、9 + 子时序1：上坤下乾，动数 8+9+1=18 → 18%6=0 → 第6爻 → 动在上卦
    const r = computeMeihua({ mode: 'number', num1: 8, num2: 9, hourForNumber: 23 });
    assert.equal(r.gua.movingYao, 6);
    assert.equal(r.tiYong.ti.name, '乾');
    assert.equal(r.tiYong.yong.name, '坤');
});

test('报数非法输入 fail-fast', () => {
    assert.throws(() => computeMeihua({ mode: 'number', num1: 0, num2: 8 }), /正整数/);
    assert.throws(() => computeMeihua({ mode: 'number' }), /正整数/);
});

test('确定性：同输入两次结果完全一致', () => {
    const a = computeMeihua({ mode: 'time', date: '2026-10-22', hour: 15, question: 'x' });
    const b = computeMeihua({ mode: 'time', date: '2026-10-22', hour: 15, question: 'x' });
    assert.deepEqual(a, b);
});
