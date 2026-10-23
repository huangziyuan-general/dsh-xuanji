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
    // 1980-04-09 巳时 → 申 辰 子 巳（三支各一次，无重复），是干净的三合正例。
    // 旧断言写成 `if (sanhe.length > 0)` 的条件式——三合整个漏报时它照样绿。
    const r = computeBazi({ year: 1980, month: 4, day: 9, hour: 10, gender: 'male' });
    assert.equal(Object.values(r.pillars).map((p) => p.zhi).join(''), '申辰子巳', '盘面前提：申子辰齐全且无重复支');
    const sanhe = r.zhiRelations.filter((x) => x.type === '三合');
    assert.equal(sanhe.length, 1, '申子辰全见必须报且只报一条三合');
    assert.equal(sanhe[0].text, '年、月、日支成申子辰三合水局');
    const banhe = r.zhiRelations.filter((x) => x.type === '半合');
    assert.equal(banhe.filter((x) => x.text.includes('水')).length, 0, '三合已报的组不再报该组半合');
});

// ── P1-3 回归：三合/三刑的判据必须数「不重复的地支」，不能数「出现次数」。
// 旧实现用 entries.filter(...) 得到的是命中「次数」，于是同一判据两个方向都会错：
//  · 重复支凑数 → 凭空造出不存在的三合局；
//  · 重复支挤掉判定 → 真三合/真三刑漏报，并在对刑循环里退化成多条重复行。
// 三个实盘都是遍历 1955–1975 年历实搜出来的，不是构造的假四柱。
test('三合判据：重复地支不得凑成三合局（辰子未辰无申 → 不报三合，改报子辰半合）', () => {
    const r = computeBazi({ year: 2012, month: 12, day: 12, hour: 8, gender: 'male' });
    const zs = Object.values(r.pillars).map((p) => p.zhi);
    assert.equal(zs.join(''), '辰子未辰', '盘面前提：四支辰子未辰，无申');
    assert.equal(r.zhiRelations.filter((x) => x.type === '三合').length, 0, '缺申不成申子辰局，绝不能报三合');
    const banhe = r.zhiRelations.filter((x) => x.type === '半合');
    assert.equal(banhe.length, 1, '子辰半合水（含中神子）必须报出来');
    assert.match(banhe[0].text, /半合水局/);
});

test('三合判据：三支齐全且有重复支时，真三合只报一条（子辰申辰 → 申子辰水局）', () => {
    const r = computeBazi({ year: 1960, month: 4, day: 14, hour: 8, gender: 'male' });
    const zs = Object.values(r.pillars).map((p) => p.zhi);
    assert.equal(zs.join(''), '子辰申辰', '盘面前提：申子辰齐全，辰重复（旧实现命中数=4 → 双双漏报）');
    const sanhe = r.zhiRelations.filter((x) => x.type === '三合');
    assert.equal(sanhe.length, 1, '申子辰三合水局必须报且只报一条');
    assert.match(sanhe[0].text, /申子辰三合水局/);
});

test('三刑判据：丑戌未全见（含重复支）报一条无恩之刑，不退化成多条对刑（未未戌丑）', () => {
    const r = computeBazi({ year: 1955, month: 7, day: 12, hour: 1, gender: 'male' });
    const zs = Object.values(r.pillars).map((p) => p.zhi);
    assert.equal(zs.join(''), '未未戌丑', '盘面前提：丑戌未齐全，未重复');
    const xing = r.zhiRelations.filter((x) => x.type === '相刑');
    assert.equal(xing.length, 1, '旧实现此处吐 5 条对刑且漏掉三刑全见');
    assert.match(xing[0].text, /丑戌未|无恩之刑/, '应成组报无恩之刑');
});

test('三刑判据：子卯相刑只报一条，重复的子不产生第二行（亥子卯子）', () => {
    const r = computeBazi({ year: 1960, month: 1, day: 3, hour: 23, gender: 'male' });
    const zs = Object.values(r.pillars).map((p) => p.zhi);
    assert.equal(zs.join(''), '亥子卯子', '盘面前提：子出现两次');
    const xing = r.zhiRelations.filter((x) => x.type === '相刑');
    assert.equal(xing.length, 1, '同一对「子卯」按支取值报一次，落柱合并列举');
    assert.match(xing[0].text, /无礼之刑/);
});

test('成对关系落柱：重复支合并进同一行的柱位列表，不另起一行（亥子卯子）', () => {
    const r = computeBazi({ year: 1960, month: 1, day: 3, hour: 23, gender: 'male' });
    const xing = r.zhiRelations.filter((x) => x.type === '相刑');
    assert.equal(xing.length, 1);
    // 子落在月、时两柱 —— 必须合并进同一个标签里，而不是把「子卯」报两遍
    assert.match(xing[0].text, /月、时支子|时、月支子/, `重复支的落柱要合并：${xing[0].text}`);
    for (const rel of r.zhiRelations) {
        const heads = [...rel.text.matchAll(/([年月日时]、?)+支([子丑寅卯辰巳午未申酉戌亥])/g)];
        for (const m of heads) {
            const cols = m[1].replace(/、/g, '');
            assert.equal(new Set(cols).size, cols.length, `${rel.type}：柱位标签不得重复「${m[0]}」`);
        }
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

// ── 晚子时（23:00–24:00）日柱口径：插件 ziShi 语义 1=次日（默认，与主流排盘软件一致）；2=当日。
// 实测锚点：1990-08-16 23:30 男 → ziShi=1 日柱 甲寅（次日）；ziShi=2 日柱 癸丑（当日）。
test('晚子时 ziShi=1（默认）：日柱按次日 甲寅，时柱 甲子', () => {
    const b = computeBazi({ year: 1990, month: 8, day: 16, hour: 23, minute: 30, gender: 'male' }, { ziShi: 1 });
    assert.equal(b.pillars.day.ganZhi, '甲寅');
    assert.equal(b.pillars.hour.ganZhi, '甲子');
    assert.ok(b.meta.lateZiNote);
});

test('晚子时 ziShi=2：日柱按当日 癸丑，时柱 甲子', () => {
    const b = computeBazi({ year: 1990, month: 8, day: 16, hour: 23, minute: 30, gender: 'male' }, { ziShi: 2 });
    assert.equal(b.pillars.day.ganZhi, '癸丑');
    assert.equal(b.pillars.hour.ganZhi, '甲子');
});
