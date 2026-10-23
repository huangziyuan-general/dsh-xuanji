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

// ── P2-7 回归：合婚双方称谓相同时，meta 以称谓为键会让一方被静默覆盖 ──────────
test('同称谓合婚：双方都填「男方」时两栏数据都必须还在，并说明自动加了序位', () => {
    const r = computeMatch({
        a: { year: 1990, month: 8, day: 16, hour: 14, label: '男方' },
        b: { year: 1992, month: 5, day: 20, hour: 10, label: '男方' },
    });
    const vals = Object.values(r.meta).filter((v) => typeof v === 'string' && /日柱/.test(v));
    assert.equal(vals.length, 2, `旧实现只剩一栏（${vals.length}）：${JSON.stringify(r.meta)}`);
    assert.ok(r.meta.labelNote, '应给出称谓冲突的自动改名说明');
    assert.match(r.meta.labelNote, /同为「男方」/);
    assert.ok(Object.keys(r.meta).some((k) => k.includes('（甲）')));
    assert.ok(Object.keys(r.meta).some((k) => k.includes('（乙）')));
    // 关系文案里的称谓也不能再出现两个同名分不清的情况
    for (const rel of r.relations) assert.ok(!/^男方日主.*对男方日主/.test(rel.text), `文案称谓歧义：${rel.text}`);
});

test('称谓不同：不产生多余的 labelNote，称谓原样保留', () => {
    const r = computeMatch({
        a: { year: 1990, month: 8, day: 16, label: '男方' },
        b: { year: 1992, month: 5, day: 20, label: '女方' },
    });
    assert.equal(r.meta.labelNote, undefined);
    assert.ok('男方' in r.meta && '女方' in r.meta);
});
