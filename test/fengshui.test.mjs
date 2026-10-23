// test/fengshui.test.mjs — 风水：命卦锚点、大游年、流年飞星、立春界、24 山与门主灶（二期）。
import test from 'node:test';
import assert from 'node:assert/strict';

import { computeFengshui, mingGua, eightStars, yearlyFlying, NINE_STARS, MOUNTAINS_24, mountainInfo, sittingFromFacing } from '../lib/engine/fengshui.js';
import { Lunar } from 'lunar-javascript';

test('命卦锚点（已查证世纪口径）：1990男坎/1990女艮/2000男离/2000女乾/2026男坎/2026女艮', () => {
    const cases = [
        [1990, 'male', '坎'], [1990, 'female', '艮'],
        [2000, 'male', '离'], [2000, 'female', '乾'],
        [2026, 'male', '坎'], [2026, 'female', '艮'],
    ];
    for (const [y, g, expect] of cases) {
        assert.equal(mingGua(y, g).gua, expect, `${y} ${g} 应为 ${expect}`);
    }
});

test('东西四命分组：坎离震巽为东四，乾坤艮兑为西四', () => {
    assert.equal(mingGua(1990, 'male').num, 1);
    const f = computeFengshui({ year: 1990, month: 8, day: 16, gender: 'male' });
    assert.equal(f.mingGua.group, '东四命');
    const f2 = computeFengshui({ year: 1990, month: 8, day: 16, gender: 'female' });
    assert.equal(f2.mingGua.group, '西四命');
});

test('大游年：八星齐全，生气配对与东西四命互合（坎巽、乾兑、震离、坤艮）', () => {
    for (const gua of ['坎', '坤', '震', '巽', '乾', '兑', '艮', '离']) {
        const stars = eightStars(gua);
        assert.equal(Object.keys(stars).length, 8, `${gua} 应有八星`);
        assert.equal(stars.伏位.palace, gua);
        assert.ok(stars.生气 && stars.延年 && stars.天医 && stars.绝命);
    }
    // 已知配对交叉验证
    assert.equal(eightStars('坎').生气.palace, '巽');
    assert.equal(eightStars('乾').生气.palace, '兑');
    assert.equal(eightStars('震').生气.palace, '离');
    assert.equal(eightStars('坤').生气.palace, '艮');
    assert.equal(eightStars('坎').延年.palace, '离');
    assert.equal(eightStars('乾').延年.palace, '坤');
});

test('流年飞星：2026 一白入中（公开事实），九宫盘 9 宫、五黄落位确定', () => {
    const f = yearlyFlying(Lunar.fromYmd(2026, 6, 1));
    assert.equal(f.center, 1);
    assert.equal(f.palaces.length, 9);
    const wuhuang = f.palaces.find((p) => p.num === 5);
    assert.ok(wuhuang);
    // 一白入中顺飞：乾宫应得二黑
    assert.equal(f.palaces.find((p) => p.palace === '乾').num, 2);
});

test('立春界：2026-01-15 生日 → 节气年 2025（命卦按上一年）', () => {
    const f = computeFengshui({ year: 2026, month: 1, day: 15, gender: 'male' });
    assert.equal(f.meta.guaYear, 2025);
    const f2 = computeFengshui({ year: 2026, month: 3, day: 1, gender: 'male' });
    assert.equal(f2.meta.guaYear, 2026);
});

test('NINE_STARS 表：九星齐全、吉星 5 颗（一白六白八白九紫 + 四绿文昌）', () => {
    assert.equal(Object.keys(NINE_STARS).length, 9);
    assert.equal(Object.values(NINE_STARS).filter((s) => s.lucky).length, 5);
});

test('fail-fast：缺性别', () => {
    assert.throws(() => computeFengshui({ year: 1990, month: 8, day: 16 }), /gender/);
});

// ── 二期：24 山 / 宅卦 / 门主灶 / 命宅配 ──

test('24 山表：24 山齐全、每山 15°、归属八卦各 3 山、子山 0°', () => {
    assert.equal(MOUNTAINS_24.length, 24);
    const byGua = {};
    for (const x of MOUNTAINS_24) byGua[x.gua] = (byGua[x.gua] ?? 0) + 1;
    for (const gua of ['坎', '艮', '震', '巽', '离', '坤', '兑', '乾']) {
        assert.equal(byGua[gua], 3, `${gua}宫应辖 3 山`);
    }
    assert.equal(MOUNTAINS_24.find((x) => x.m === '子').deg, 0);
    assert.equal(MOUNTAINS_24.find((x) => x.m === '午').deg, 180);
    // 通行归属抽查：壬子癸→坎 / 丑艮寅→艮 / 甲卯乙→震 / 戌乾亥→乾
    for (const m of ['壬', '子', '癸']) assert.equal(mountainInfo(m).gua, '坎');
    for (const m of ['丑', '艮', '寅']) assert.equal(mountainInfo(m).gua, '艮');
    for (const m of ['甲', '卯', '乙']) assert.equal(mountainInfo(m).gua, '震');
    for (const m of ['戌', '乾', '亥']) assert.equal(mountainInfo(m).gua, '乾');
});

test('向山 → 坐山按对宫反推：向午 → 坐子；非法山名 fail-fast', () => {
    const s = sittingFromFacing('午');
    assert.equal(s.m, '子');
    assert.equal(s.gua, '坎');
    assert.equal(sittingFromFacing('卯').m, '酉');
    assert.throws(() => mountainInfo('北方'), /24 山/);
    assert.throws(() => computeFengshui({ action: 'advise', sitting: '北' }), /24 山/);
});

test('advise：坐子山 → 宅卦坎（东四宅），八星盘齐全，门主灶厕四条布局', () => {
    const r = computeFengshui({ action: 'advise', sitting: '子' });
    assert.equal(r.meta.houseGua, '坎');
    assert.equal(r.meta.houseGroup, '东四宅');
    assert.equal(r.meta.sitting, '子山（罗盘 0°）');
    assert.equal(r.meta.facing, '午山（罗盘 180°）');
    assert.equal(r.houseStars.length, 8);
    assert.ok(r.houseStars.every((s) => s.role));
    // 坎宅生气在巽（东南）
    const shengqi = r.houseStars.find((s) => s.star === '生气');
    assert.equal(shengqi.palace, '巽');
    assert.equal(shengqi.direction, '东南');
    for (const key of ['door', 'stove', 'bed', 'toilet']) {
        assert.equal(typeof r.layout[key], 'string');
        assert.ok(r.layout[key].length > 10, `layout.${key} 应有实义文案`);
    }
});

test('advise：给生辰算命宅配（1990 男坎命 × 坎宅 → 东四同组相配）', () => {
    const r = computeFengshui({ action: 'advise', sitting: '子', year: 1990, month: 8, day: 16, gender: 'male' });
    assert.ok(r.mingMatch);
    assert.equal(r.mingMatch.mingGua.gua, '坎');
    assert.equal(r.mingMatch.mingGua.group, '东四命');
    assert.equal(r.mingMatch.sameGroup, true);
    assert.ok(/相配/.test(r.mingMatch.text));
});

test('advise：命宅不配时给调停口径（1990 女艮命 × 坎宅 → 不同组）', () => {
    const r = computeFengshui({ action: 'advise', sitting: '子', year: 1990, month: 8, day: 16, gender: 'female' });
    assert.equal(r.mingMatch.sameGroup, false);
    assert.ok(/不配/.test(r.mingMatch.text));
    assert.ok(/命卦吉方/.test(r.mingMatch.text), '调停文案应指向命卦吉方');
});

test('advise：缺生辰时如实标注未做命宅配，不代填', () => {
    const r = computeFengshui({ action: 'advise', facing: '午' });
    assert.equal(r.mingMatch, undefined);
    assert.ok(/未做命宅配/.test(r.meta.birthNote));
});

test('advise：坐向不自洽（非对宫）fail-fast；两侧缺一反推；都缺 fail-fast', () => {
    assert.throws(() => computeFengshui({ action: 'advise', sitting: '子', facing: '卯' }), /不自洽/);
    // 坐子向午自洽：不抛
    assert.doesNotThrow(() => computeFengshui({ action: 'advise', sitting: '子', facing: '午' }));
    assert.throws(() => computeFengshui({ action: 'advise' }), /sitting.*facing|坐山.*向山/);
});

test('natal 行为不变：不给 action 走一期路径（回归保护）', () => {
    const f = computeFengshui({ year: 1990, month: 8, day: 16, gender: 'male' });
    assert.equal(f.meta.action, undefined);
    assert.ok(f.mingGua && f.yearlyFlying && f.luckyDirections.length === 4);
});

test('工具面回归：parameters 必须声明 action（参数白名单严格校验曾漏掉它）', async () => {
    const { defineFengshuiTool } = await import('../lib/tools/fengshui-tool.js');
    const tool = defineFengshuiTool();
    const r = await tool.execute({ action: 'advise', sitting: '子' });
    assert.equal(r.meta.houseGua, '坎');
    const natal = await tool.execute({ year: 1990, month: 8, day: 16, gender: 'male' });
    assert.ok(natal.mingGua);
});
