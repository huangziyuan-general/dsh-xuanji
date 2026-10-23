// test/chenggu.test.mjs — 称骨引擎：以通行本称骨表手算案例为金标准。
import test from 'node:test';
import assert from 'node:assert/strict';

import { computeChenggu } from '../lib/engine/chenggu.js';
import { YEAR_WEIGHT, MONTH_WEIGHT, DAY_WEIGHT, HOUR_WEIGHT } from '../lib/engine/chenggu.js';
import { JIAZI } from '../lib/engine/tables.js';

test('称骨表自检：六十甲子各有年重、月日时辰表齐全', () => {
    assert.equal(YEAR_WEIGHT.length, 60);
    assert.equal(MONTH_WEIGHT.length, 12);
    assert.equal(DAY_WEIGHT.length, 30);
    for (const gz of JIAZI) {
        const i = JIAZI.indexOf(gz);
        assert.ok(Number.isInteger(YEAR_WEIGHT[i]) && YEAR_WEIGHT[i] >= 5 && YEAR_WEIGHT[i] <= 19, `${gz} 年重越界`);
    }
    for (const [zhi, w] of Object.entries(HOUR_WEIGHT)) assert.ok(w >= 6 && w <= 16, `${zhi} 时重越界`);
});

test('手算案例：农历甲子年正月初一子时 = 12+6+5+16 = 三两九钱', () => {
    // 用例本意是农历输入，必须显式写 calendar:'lunar'——旧版靠「缺省掉进农历分支」这个
    // bug 才成立（见下方 P1-4 回归组），缺省现已按 README 承诺改成公历。
    const c = computeChenggu({ year: 1984, month: 1, day: 1, hourZhi: '子', calendar: 'lunar' });
    assert.equal(c.meta.yearGanZhi, '甲子');
    assert.equal(c.total.qian, 39);
    assert.equal(c.total.label, '三两九钱');
    assert.equal(c.weights.year.qian, 12);
    assert.equal(c.weights.month.qian, 6);
    assert.equal(c.weights.day.qian, 5);
    assert.equal(c.weights.hour.qian, 16);
});

test('公历输入自动转农历：1990-08-16 14 时（未时）= 庚午年六月廿六 = 四两二钱', () => {
    const c = computeChenggu({ year: 1990, month: 8, day: 16, hour: 14, calendar: 'solar' });
    assert.equal(c.meta.solar, '1990-08-16');
    assert.equal(c.meta.yearGanZhi, '庚午');
    assert.equal(c.total.qian, 8 + 16 + 10 + 8);
    assert.equal(c.total.label, '四两二钱');
    assert.ok(['中上'].includes(c.verdict.band));
});

test('农历月份格式：零两的钱数只写「X钱」', () => {
    // 找一个年重 < 10 的干支年：乙丑(9钱)。农历乙丑年正月十五子时 = 9+6+10+16=41=四两一钱
    const idxYichou = JIAZI.indexOf('乙丑');
    assert.equal(YEAR_WEIGHT[idxYichou], 9);
    const year = 1985; // 乙丑年
    const c = computeChenggu({ year, month: 1, day: 15, hourZhi: '子', calendar: 'lunar' });
    assert.equal(c.total.qian, 41);
    assert.equal(c.weights.year.label, '乙丑年 九钱');
});

test('时辰缺失 fail-fast（铁律：不代填）', () => {
    assert.throws(
        () => computeChenggu({ year: 1990, month: 8, day: 16, calendar: 'solar' }),
        /时辰/,
    );
});

// ── P1-4 回归：称骨必须吃 calendar.js 归一后的公历，不得自己按 calendar 缺省猜历法。
// 旧实现 `if (calendar === 'solar') … else 走农历`，而工具层 chenggu-tool.js 调了
// assertYmd 却把返回值丢掉、把原始 args 直接喂引擎——于是按 README/参数说明的
// 「缺省 solar」填公历生日，会被静默按农历算，骨重错一档（三两九钱 vs 四两二钱）。
test('缺省历法口径：不传 calendar 时按公历（README 与参数说明都写「缺省 solar」）', () => {
    const bare = computeChenggu({ year: 1990, month: 8, day: 16, hourZhi: '未' });
    const solar = computeChenggu({ year: 1990, month: 8, day: 16, hourZhi: '未', calendar: 'solar' });
    assert.equal(bare.meta.solar, '1990-08-16', '旧实现落到农历分支 → 1990-10-04');
    assert.equal(bare.total.qian, solar.total.qian, '缺省必须与显式 solar 同结果');
    assert.equal(bare.total.label, '四两二钱');
});

test('公历非法日期必须走 calendar.js 的中文校验（不再静默接受 1990-02-30）', () => {
    assert.throws(
        () => computeChenggu({ year: 1990, month: 2, day: 30, hourZhi: '未', calendar: 'solar' }),
        /该月只有 28 天|非法日期/,
    );
});

test('农历非法输入抛中文可行动错误，不把 lunar-javascript 的英文串漏给用户', () => {
    for (const input of [
        { year: 1990, month: 3, day: 30, hourZhi: '未', calendar: 'lunar' },     // 该月只有 29 天
        { year: 2026, month: 2, day: 10, hourZhi: '未', calendar: 'lunar', isLeapMonth: true }, // 2026 无闰月
    ]) {
        let msg = '';
        try { computeChenggu(input); assert.fail('应抛错'); } catch (e) { msg = String(e.message); }
        assert.ok(!/[a-z]{4,}/.test(msg.replace(/calendar|solar|lunar/g, '')), `错误消息漏英文：${msg}`);
        assert.match(msg, /农历|闰月|请核对/);
    }
});

test('闰月骨重：落柱标签要写明闰几月，不能与平月同 label', () => {
    const leap = computeChenggu({ year: 2023, month: 2, day: 15, hourZhi: '午', calendar: 'lunar', isLeapMonth: true });
    const plain = computeChenggu({ year: 2023, month: 2, day: 15, hourZhi: '午', calendar: 'lunar' });
    assert.match(leap.weights.month.label, /闰二月/);
    assert.match(plain.weights.month.label, /二月/);
    assert.notEqual(leap.weights.month.label, plain.weights.month.label);
    assert.notEqual(leap.meta.solar, plain.meta.solar, '闰月与平月必须落到不同公历日');
});

test('工具层：xuanji_chenggu 走 hourZhi 直传路径时也必须按归一后的公历算', async () => {
    const { defineChengguTool } = await import('../lib/tools/chenggu-tool.js');
    const t = defineChengguTool();
    const v = await t.execute({ year: 1990, month: 8, day: 16, hourZhi: '未' }, {});
    assert.equal(v.meta.solar, '1990-08-16', '工具层丢掉 assertYmd 返回值时会变成 1990-10-04');
    assert.equal(v.total.label, '四两二钱');
});
