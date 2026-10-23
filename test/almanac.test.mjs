// test/almanac.test.mjs — 黄历引擎：以 lunar-javascript 探针实证过的 2026-10-22 为准。
import test from 'node:test';
import assert from 'node:assert/strict';

import { computeAlmanac } from '../lib/engine/almanac.js';

const D = '2026-10-22';

test('2026-10-22：农历九月初? 干支 丙午年 戊戌月 己巳日，冲猪煞东', () => {
    const a = computeAlmanac(D);
    assert.equal(a.lunarDate, '二〇二六年九月十三');
    assert.equal(a.ganzhi.year, '丙午');
    assert.equal(a.ganzhi.month, '戊戌');
    assert.equal(a.ganzhi.day, '己巳');
    assert.equal(a.ganzhi.shengXiao, '马');
    assert.equal(a.chong.shengXiao, '猪');
    assert.equal(a.chong.sha, '煞东');
    assert.equal(a.zhiXing, '危');
    assert.equal(a.xiu.xiu, '斗');
});

test('宜忌清单非空且互为独立数据（宜忌都来自引擎）', () => {
    const a = computeAlmanac(D);
    assert.ok(Array.isArray(a.yi) && a.yi.length > 0);
    assert.ok(Array.isArray(a.ji) && a.ji.length > 0);
    assert.ok(a.yi.includes('祭祀'));
    assert.ok(a.ji.includes('嫁娶'));
});

test('每日一卦：同日同卦、卦名在六十四卦内、isToday 标记（与运行日无关的固定日期）', () => {
    const a1 = computeAlmanac('2024-01-01');
    const a2 = computeAlmanac('2024-01-01');
    assert.deepEqual(a1.dailyHexagram, a2.dailyHexagram);
    assert.ok(a1.dailyHexagram);
    assert.ok(a1.dailyHexagram.kingWen >= 1 && a1.dailyHexagram.kingWen <= 64);
    assert.equal(a1.meta.isToday, false);

    const today = computeAlmanac();
    assert.equal(today.meta.isToday, true);
    assert.ok(today.dailyHexagram);
});

test('非法日期 fail-fast 报错而非静默回退今天（v0.7.0 改口径：静默回退会掩盖笔误）', () => {
    assert.throws(() => computeAlmanac('not-a-date'), /YYYY-MM-DD/);
});

test('市面对齐字段：喜神/财神/福神/阳贵/阴贵方位 + 节气（上一/下一）+ 节日字段更名 festivals', () => {
    const a = computeAlmanac('2026-10-22');
    for (const key of ['xiShen', 'caiShen', 'fuShen', 'yangGui', 'yinGui']) {
        assert.ok(typeof a.positions[key] === 'string' && /^[东西南北中正]+$/.test(a.positions[key]), `方位 ${key}=${a.positions[key]}`);
    }
    // 财神方位歌（通行口径）：2026-10-22 日干己 → 财神正北
    assert.equal(a.positions.caiShen, '正北');
    assert.equal(a.jieQi.prev.name, '寒露');
    assert.equal(a.jieQi.next.name, '霜降');
    assert.equal(a.jieQi.current, null, '非交节日 current 为 null');
    assert.ok(Array.isArray(a.festivals), 'festivals 为数组（原 yiYuan 更名）');
});
