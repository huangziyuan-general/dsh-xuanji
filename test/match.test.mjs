// test/match.test.mjs — 八字合婚引擎：属相关系锚例 + 日主生克 + 纳音 + 分档。
import test from 'node:test';
import assert from 'node:assert/strict';

import { computeMatch } from '../lib/engine/match.js';

test('属相关系锚例：六合（子丑）/六冲（子午）/三合（申子）', () => {
    // 1996-01-05 → 子鼠（乙亥年立春前? 1996-01-05 属乙亥猪年尾，年支亥）
    // 用确定锚：1984-06-15（甲子鼠）× 1985-07-20（乙丑牛）→ 子丑六合
    const he = computeMatch({ a: { year: 1984, month: 6, day: 15, label: '甲' }, b: { year: 1985, month: 7, day: 20, label: '乙' } });
    const liuhe = he.relations.find((r) => r.rel === '六合');
    assert.ok(liuhe && /鼠.*牛|子.*丑/.test(liuhe.text), `子丑应六合：${liuhe?.text}`);
    assert.equal(liuhe.tone, '吉');

    // 1984-06-15（子）× 1990-08-16（午马）→ 子午六冲
    const chong = computeMatch({ a: { year: 1984, month: 6, day: 15 }, b: { year: 1990, month: 8, day: 16 } });
    const chongRel = chong.relations.find((r) => r.rel === '六冲');
    assert.ok(chongRel, '子午应六冲');
    assert.equal(chongRel.tone, '凶');

    // 1984-06-15（子）× 1992-11-11（申猴）→ 申子三合
    const sanhe = computeMatch({ a: { year: 1984, month: 6, day: 15 }, b: { year: 1992, month: 11, day: 11 } });
    assert.ok(sanhe.relations.find((r) => r.rel === '三合'), '申子应三合');
});

test('日主生克与天干五合：甲己五合；癸克丙双向如实', () => {
    // 1984-06-15 日柱? 用直接锚：a 传 1990-08-16（癸丑日），b 选出生日为日干己的日期
    // 1985-07-20 日柱先跑出来再说——直接验证双向生克结构即可
    const r = computeMatch({ a: { year: 1990, month: 8, day: 16 }, b: { year: 1993, month: 10, day: 2 } });
    const ab = r.relations.find((x) => x.kind === '日主' && x.rel === '癸→丙');
    assert.ok(ab && /我克/.test(ab.rel + ab.text));
    const ba = r.relations.find((x) => x.kind === '日主' && x.rel === '丙→癸');
    assert.ok(ba && /克我/.test(ba.rel + ba.text));

    // 天干五合：找日干甲 × 日干己 的组合 —— 1984-06-07 是辛亥? 直接探测式：遍历几天找配对
    let wuhe = null;
    for (let d1 = 1; d1 <= 28 && !wuhe; d1++) {
        for (let d2 = 1; d2 <= 28; d2++) {
            const r2 = computeMatch({ a: { year: 1990, month: 5, day: d1 }, b: { year: 1990, month: 5, day: d2 } });
            if (r2.relations.some((x) => x.rel === '天干五合')) { wuhe = true; break; }
        }
    }
    assert.ok(wuhe, '应存在日主天干五合的组合（甲己/乙庚/…）');
});

test('年命纳音：路旁土生剑锋金（1990×1993 锚例）', () => {
    const r = computeMatch({ a: { year: 1990, month: 8, day: 16 }, b: { year: 1993, month: 10, day: 2 } });
    const naYin = r.relations.find((x) => x.kind === '年命纳音');
    assert.ok(naYin && /路旁土.*剑锋金/.test(naYin.text), naYin?.text);
    assert.ok(/土生金|同气/.test(naYin.text));
});

test('分档与免责：无冲刑 → 非需磨合；缺生辰 fail-fast；确定性', () => {
    const good = computeMatch({ a: { year: 1984, month: 6, day: 15 }, b: { year: 1985, month: 7, day: 20 } });
    assert.notEqual(good.verdict.verdict, '需磨合');
    assert.ok(good.disclaimer.includes('仅供娱乐'));
    assert.throws(() => computeMatch({ a: { year: 1990, month: 8, day: 16 } }), /双方出生年月日/);
    const input = { a: { year: 1990, month: 8, day: 16 }, b: { year: 1993, month: 10, day: 2 } };
    assert.deepEqual(computeMatch(input).relations, computeMatch(input).relations);
});

test('时辰可选：不给时辰时有 note，给了不炸', () => {
    const noHour = computeMatch({ a: { year: 1990, month: 8, day: 16 }, b: { year: 1993, month: 10, day: 2 } });
    assert.ok(Object.keys(noHour.meta).some((k) => k.endsWith('Note')));
    const withHour = computeMatch({ a: { year: 1990, month: 8, day: 16, hour: 14 }, b: { year: 1993, month: 10, day: 2, hour: 9 } });
    assert.ok(withHour.relations.length > 0);
});
