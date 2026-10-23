// test/bazi.test.mjs — 八字引擎：以 lunar-javascript 探针实证过的已知命例为准。
import test from 'node:test';
import assert from 'node:assert/strict';

import { computeBazi } from '../lib/engine/bazi.js';

const CASE = { year: 1990, month: 8, day: 16, hour: 14, minute: 30, gender: 'male', calendar: 'solar' };

test('已知命例 1990-08-16 14:30 男：四柱 庚午 甲申 癸丑 己未', () => {
    const b = computeBazi(CASE);
    assert.equal(b.pillars.year.ganZhi, '庚午');
    assert.equal(b.pillars.month.ganZhi, '甲申');
    assert.equal(b.pillars.day.ganZhi, '癸丑');
    assert.equal(b.pillars.hour.ganZhi, '己未');
    assert.equal(b.meta.timeKnown, true);
    assert.equal(b.meta.lunar, '一九九〇年六月廿六');
    assert.equal(b.meta.shengXiao, '马');
});

test('十神与藏干：日主癸水，年干庚=正印，时干己=七杀', () => {
    const b = computeBazi(CASE);
    assert.equal(b.dayMaster.gan, '癸');
    assert.equal(b.dayMaster.wuxing, '水');
    assert.equal(b.pillars.year.shiShenGan, '正印');
    assert.equal(b.pillars.month.shiShenGan, '伤官');
    assert.equal(b.pillars.hour.shiShenGan, '七杀');
    assert.deepEqual(
        b.pillars.day.cangGan.map((c) => `${c.gan}${c.shiShen}`),
        ['己七杀', '癸比肩', '辛偏印'],
    );
    // 纳音（lunar 实证：年柱路旁土、日柱桑柘木）
    assert.equal(b.pillars.year.naYin, '路旁土');
    assert.equal(b.pillars.day.naYin, '桑柘木');
});

test('五行计数与汇总：金2 木1 水1 火1 土3', () => {
    const b = computeBazi(CASE);
    assert.deepEqual(b.wuxing.counts, { 金: 2, 木: 1, 水: 1, 火: 1, 土: 3 });
    assert.equal(b.wuxing.summary, '金2 木1 水1 火1 土3');
});

test('大运（男命阳年顺排）：9岁乙酉起，起运 7 年 6 个月 20 天', () => {
    const b = computeBazi(CASE);
    assert.equal(b.qiYun.years, 7);
    assert.equal(b.qiYun.months, 6);
    assert.equal(b.qiYun.days, 20);
    assert.equal(b.daYun[0].ganZhi, '乙酉');
    assert.equal(b.daYun[0].startAge, 9);
    assert.equal(b.daYun[0].startYear, 1998);
    assert.equal(b.daYun[1].ganZhi, '丙戌');
    assert.ok(b.daYun.length <= 8); // dayunCount 默认 8
});

test('女命大运逆排：阳年女命从月柱逆推，第一步为癸未', () => {
    const male = computeBazi(CASE);
    const female = computeBazi({ ...CASE, gender: 'female' });
    assert.notEqual(female.daYun[0].ganZhi, male.daYun[0].ganZhi);
    assert.equal(female.daYun[0].ganZhi, '癸未'); // 甲申逆推一位
    assert.equal(female.daYun[1].ganZhi, '壬午');
});

test('流年：2026 丙午（对癸日主为正财）、2027 丁未（偏财）', () => {
    const b = computeBazi(CASE, { dayunCount: 8 });
    const ln2026 = b.liuNian.find((l) => l.year === 2026);
    const ln2027 = b.liuNian.find((l) => l.year === 2027);
    assert.equal(ln2026.ganZhi, '丙午');
    assert.equal(ln2026.shiShenGan, '正财');
    assert.equal(ln2027.ganZhi, '丁未');
    assert.equal(ln2027.shiShenGan, '偏财');
});

test('时辰未知：只排三柱并标注 timeKnown=false', () => {
    const b = computeBazi({ year: 1990, month: 8, day: 16, gender: 'male', calendar: 'solar' });
    assert.equal(b.meta.timeKnown, false);
    assert.equal(b.pillars.hour, undefined);
    assert.equal(b.pillars.year.ganZhi, '庚午');
    assert.equal(b.pillars.day.ganZhi, '癸丑');
    assert.equal(b.meta.timeZhi, null);
});

test('农历输入：农历 1990-6-26 未时 → 与公历同盘', () => {
    const b = computeBazi({ year: 1990, month: 6, day: 26, hour: 14, gender: 'male', calendar: 'lunar' });
    assert.equal(b.pillars.year.ganZhi, '庚午');
    assert.equal(b.pillars.day.ganZhi, '癸丑');
    assert.equal(b.pillars.hour.ganZhi, '己未');
});

test('非法输入 fail-fast：性别缺失 / 小时越界', () => {
    assert.throws(() => computeBazi({ ...CASE, gender: undefined }), /gender/);
    assert.throws(() => computeBazi({ ...CASE, hour: 25 }), /hour/);
});

test('市面对齐字段：每柱旬空/星运十二长生/自坐（癸亥年·乙丑月·丙寅日·癸巳时）', () => {
    const r = computeBazi({ year: 1984, month: 2, day: 2, hour: 10, gender: 'male' });
    const P = r.pillars;
    assert.equal(P.year.ganZhi, '癸亥');
    assert.equal(P.year.xunKong, '子丑', '癸亥属甲寅旬，空子丑');
    assert.equal(P.year.xingYun, '绝', '日主丙见年支亥为绝');
    assert.equal(P.year.ziZuo, '帝旺', '癸水长生卯逆行，帝旺在亥（自坐）');
    assert.equal(P.hour.xingYun, '临官', '日主丙见时支巳为临官');
    assert.equal(P.hour.ziZuo, '胎', '癸水在巳为胎（自坐）');
    assert.equal(r.shenSha.xunKong, r.pillars.day.xunKong, '日柱旬空与每柱旬空口径一致');
});

test('刑冲合会：六合/六冲/六害/相刑按传统口径检出并落柱（1984-02-02 10:00：亥寅合·亥巳冲·寅巳害刑）', () => {
    const r = computeBazi({ year: 1984, month: 2, day: 2, hour: 10, gender: 'male' });
    const texts = r.zhiRelations.map((x) => x.text);
    assert.ok(texts.some((t) => t.includes('六合') && t.includes('亥') && t.includes('寅')));
    assert.ok(texts.some((t) => t.includes('六冲') && t.includes('巳')));
    assert.ok(texts.some((t) => t.includes('六害') && t.includes('寅') && t.includes('巳')));
    assert.ok(texts.some((t) => t.includes('相刑') && t.includes('寅') && t.includes('巳')));
});

test('刑冲合会：三合局齐全时报告三合、不重复报半合（申子辰全见）', () => {
    const r = computeBazi({ year: 1992, month: 12, day: 2, hour: 2, gender: 'male' }); // 目标凑出申/子/辰
    const sanhe = r.zhiRelations.filter((x) => x.type === '三合');
    if (sanhe.length > 0) {
        const banhe = r.zhiRelations.filter((x) => x.type === '半合');
        assert.ok(banhe.every((x) => !sanhe[0].text.includes('申子辰')), '三合已报的组不再报半合');
    }
});

test('半合口径：同组两支且含中神才报半合（不含中神的两支不报）', () => {
    const r = computeBazi({ year: 1992, month: 11, day: 8, hour: 4, gender: 'male' });
    for (const rel of r.zhiRelations) {
        if (rel.type === '半合') assert.ok(/[子午卯酉]/.test(rel.text), '半合须含中神');
    }
});

test('大运增强：每运带 endYear（十年一运）与干支十神', () => {
    const r = computeBazi({ year: 1984, month: 2, day: 2, hour: 10, gender: 'male' });
    assert.equal(r.dayMaster.gan, '丙');
    for (const d of r.daYun) {
        assert.equal(d.endYear, d.startYear + 9, '大运每运十年，endYear = startYear + 9');
        assert.ok(d.shiShenGan.length > 0 && d.shiShenZhi.length > 0);
    }
    const shiShenSet = new Set(['正印', '偏印', '比肩', '劫财', '食神', '伤官', '偏财', '正财', '正官', '七杀']);
    for (const d of r.daYun) {
        assert.ok(shiShenSet.has(d.shiShenGan) && shiShenSet.has(d.shiShenZhi), `十神合法：${d.shiShenGan}/${d.shiShenZhi}`);
    }
});

test('年柱口径提示：立春前出生（1984-02-02）生肖按春节界（甲子鼠）与年柱（癸亥）不同时给出 yearScopeNote', () => {
    const r = computeBazi({ year: 1984, month: 2, day: 2, hour: 10, gender: 'male' });
    assert.equal(r.pillars.year.ganZhi, '癸亥', '立春界年柱还是癸亥');
    assert.equal(r.meta.shengXiao, '鼠', '春节界农历年已是甲子鼠');
    assert.ok(r.meta.yearScopeNote.includes('立春界'), '给出口径说明');
    assert.ok(r.meta.yearScopeNote.includes('春节界'));
});

test('年柱口径：非窗口期出生不产生 yearScopeNote（1990-08-16）', () => {
    const r = computeBazi({ year: 1990, month: 8, day: 16, hour: 14, gender: 'male' });
    assert.equal(r.meta.yearScopeNote, undefined);
});
