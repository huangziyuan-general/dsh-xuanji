// test/tables.test.mjs — 命理共享表的核心纯函数校验。
import test from 'node:test';
import assert from 'node:assert/strict';

import { tenGod, hourToZhi, yearGanZhi, JIAZI, wuxingSummary, zhiHourRange } from '../lib/engine/tables.js';

test('十神全表：日主甲木对十天干', () => {
    const expect = {
        甲: '比肩', 乙: '劫财', 丙: '食神', 丁: '伤官', 戊: '偏财',
        己: '正财', 庚: '七杀', 辛: '正官', 壬: '偏印', 癸: '正印',
    };
    for (const [gan, god] of Object.entries(expect)) {
        assert.equal(tenGod('甲', gan), god, `甲见${gan} 应为 ${god}`);
    }
});

test('十神阴阳互换：甲对乙=劫财，乙对甲=劫财（同我异性）', () => {
    assert.equal(tenGod('甲', '乙'), '劫财');
    assert.equal(tenGod('乙', '甲'), '劫财');
    assert.equal(tenGod('癸', '甲'), '伤官'); // 癸水生甲木，异性 → 伤官
});

test('时辰折算：23 点与 0 点都是子时，13 点是未时', () => {
    assert.equal(hourToZhi(23), '子');
    assert.equal(hourToZhi(0), '子');
    assert.equal(hourToZhi(1), '丑');
    assert.equal(hourToZhi(13), '未');
    assert.equal(hourToZhi(24), null);
    assert.equal(hourToZhi(-1), null);
});

test('年干支：1984 甲子、2026 丙午、60 年一循环', () => {
    assert.equal(yearGanZhi(1984), '甲子');
    assert.equal(yearGanZhi(2026), '丙午');
    assert.equal(yearGanZhi(1984 + 60), '甲子');
    assert.equal(JIAZI.length, 60);
    assert.equal(JIAZI[0], '甲子');
    assert.equal(JIAZI[59], '癸亥');
});

test('时辰时段与五行汇总文案', () => {
    assert.equal(zhiHourRange('子'), '23:00–00:59');
    assert.equal(zhiHourRange('未'), '13:00–14:59');
    assert.equal(wuxingSummary({ 金: 2, 木: 1, 水: 1, 火: 1, 土: 3 }), '金2 木1 水1 火1 土3');
});
