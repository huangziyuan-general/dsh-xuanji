// test/calendar.test.mjs — 历法（公历 / 农历 / 闰月）回归闸。
//
// 钉的是 2026-10-23 发现的这类缺陷：整个插件曾经只有「公历」一个口径，
// 农历生日用户填进去，排出来的是另一个人的盘——不报错、不崩溃、
// 界面上还印着用户填的那个日期，看着完全正常。比崩溃难查得多。
//
// 期望值全部来自 lunar-javascript 1.7.3 实测，不是推算出来的。

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { resolveDate, resolveDateStr, lunarMonthDays, lunarLeapMonth } from '../lib/engine/calendar.js';
import { registerServerApi } from '../lib/server-api.js';

// ───────────────────────── ① 农历 → 公历 ─────────────────────────

test('农历生日换算成公历：1990 八月十六 = 1990-10-04', () => {
    const r = resolveDate({ year: 1990, month: 8, day: 16, calendar: 'lunar' });
    assert.deepEqual(r.solar, { year: 1990, month: 10, day: 4 });
    // 原始输入必须原样带回：渲染要回显，用户才知道自己填了什么
    assert.equal(r.year, 1990);
    assert.equal(r.month, 8);
    assert.equal(r.calendar, 'lunar');
});

test('农历月天数按农历查表，不按公历：2023 二月三十是合法日子（旧实现会误拒）', () => {
    // 2023 农历二月有 30 天；旧 assertYmd 拿公历 2 月（28 天）去卡，直接把合法农历生日弹回来。
    assert.equal(lunarMonthDays(2023, 2), 30);
    const r = resolveDate({ year: 2023, month: 2, day: 30, calendar: 'lunar' });
    assert.deepEqual(r.solar, { year: 2023, month: 3, day: 21 });
});

test('闰月：2023 闰二月初一 = 2023-03-22，且闰二月只有 29 天', () => {
    assert.equal(lunarLeapMonth(2023), 2);
    assert.equal(lunarMonthDays(2023, 2, true), 29);
    const r = resolveDate({ year: 2023, month: 2, day: 1, calendar: 'lunar', isLeapMonth: true });
    assert.deepEqual(r.solar, { year: 2023, month: 3, day: 22 });
    // 闰月必须写进 notes：平月与闰月四柱不同，用户得有处核对
    assert.match(r.note, /闰月/);
});

// ───────────────────────── ② 非法农历输入必须被拒（中文可读错误） ─────────────────────────

test('闰月超出该月天数：闰二月三十被拒，且错误是中文不是库内部英文', () => {
    assert.throws(
        () => resolveDate({ year: 2023, month: 2, day: 30, calendar: 'lunar', isLeapMonth: true }),
        /闰二月只有 29 天/,
    );
});

test('闰月月份对不上：2023 勾的是闰六月（该年闰月是闰二月）被拒', () => {
    assert.throws(
        () => resolveDate({ year: 2023, month: 6, day: 1, calendar: 'lunar', isLeapMonth: true }),
        /闰二月/,
    );
});

test('该年根本没有闰月：2026 勾闰月被拒，并说明闰月不是每年都有', () => {
    assert.equal(lunarLeapMonth(2026), 0);
    assert.throws(
        () => resolveDate({ year: 2026, month: 6, day: 1, calendar: 'lunar', isLeapMonth: true }),
        /2026 年没有闰月/,
    );
});

test('农历腊月只有 29 天却填了三十：被拒（否则会被静默折算成下月初一）', () => {
    assert.equal(lunarMonthDays(2026, 12), 29);
    assert.throws(
        () => resolveDate({ year: 2026, month: 12, day: 30, calendar: 'lunar' }),
        /腊月只有 29 天/,
    );
});

test('公历口径不受影响：1990-02-30 照旧被拒', () => {
    assert.throws(() => resolveDate({ year: 1990, month: 2, day: 30 }), /该月只有 28 天/);
});

test('农历年跨公历年时要给说明（农历 1990 腊月落在 1991 年）', () => {
    const r = resolveDate({ year: 1990, month: 12, day: 15, calendar: 'lunar' });
    assert.equal(r.solar.year, 1991);
    assert.match(r.note, /落在公历 1991 年/);
});

// ───────────────────────── ③ 日期串（面板 / 工具的 date 参数） ─────────────────────────

test('YYYY-MM-DD 串按历法归一：农历 2026-07-07 = 公历 2026-08-19', () => {
    assert.equal(resolveDateStr('2026-07-07', 'lunar').date, '2026-08-19');
    assert.equal(resolveDateStr('2026-07-07').date, '2026-07-07');
});

test('日期串格式错误给中文提示（农历提示里要带闰月怎么填）', () => {
    assert.throws(() => resolveDateStr('2026/07/07'), /YYYY-MM-DD/);
    assert.throws(() => resolveDateStr('2026/07/07', 'lunar'), /闰月/);
});

// ───────────────────────── ④ REST 面：面板与工具必须同口径 ─────────────────────────

/** 起真实 HTTP 服务（含 cordis ctx 桩）。 */
async function startPanel() {
    const handlers = [];
    const uncaught = [];
    const onRej = (e) => uncaught.push(String(e?.message ?? e));
    process.on('unhandledRejection', onRej);
    registerServerApi({
        inject: (_deps, fn) => fn({
            effect: (cb) => cb(),
            webServer: { register: (r) => handlers.push(r) },
        }),
    }, { dayunCount: 8, ziShi: 1 });
    const server = http.createServer((req, res) => {
        const h = handlers.find((x) => req.url.startsWith(x.path));
        if (!h) { res.writeHead(404); res.end(); return; }
        Promise.resolve(h.handler(req, res)).catch((e) => uncaught.push(String(e?.message ?? e)));
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    const call = async (p) => {
        const r = await fetch(`http://127.0.0.1:${port}${p}`, {
            headers: { host: 'localhost', 'x-dsh-xuanji': '1' },
        });
        return { status: r.status, body: await r.json() };
    };
    return { call, close: () => { process.off('unhandledRejection', onRej); server.close(); }, uncaught };
}

test('面板 /bazi?calendar=lunar 与换算后的公历请求同盘，且标注输入历法为农历', async () => {
    const { call, close, uncaught } = await startPanel();
    try {
        const lunar = await call('/api/xuanji/bazi?year=1990&month=8&day=16&hour=14&gender=male&calendar=lunar');
        const solar = await call('/api/xuanji/bazi?year=1990&month=10&day=4&hour=14&gender=male');
        assert.equal(lunar.status, 200);
        assert.equal(solar.status, 200);
        const gz = (v) => ['year', 'month', 'day', 'hour'].map((k) => v.body.value.pillars[k].ganZhi).join(' ');
        assert.equal(gz(lunar), gz(solar));
        // 面板曾经恒标「公历」：农历用户排完看到的仍是公历，等于没给用户核对的机会
        assert.equal(lunar.body.value.meta.calendar, '农历');
        assert.equal(solar.body.value.meta.calendar, '公历');
        assert.deepEqual(uncaught, []);
    } finally {
        close();
    }
});

test('面板称骨页（只给 hourZhi 不给 hour）也吃农历：与公历换算后同重量', async () => {
    const { call, close } = await startPanel();
    try {
        const lunar = await call('/api/xuanji/chenggu?year=1990&month=8&day=16&hourZhi=%E5%AD%90&calendar=lunar');
        const solar = await call('/api/xuanji/chenggu?year=1990&month=10&day=4&hourZhi=%E5%AD%90');
        assert.equal(lunar.status, 200);
        assert.equal(lunar.body.value.total.qian, solar.body.value.total.qian);
        assert.equal(lunar.body.value.meta.inputCalendar, '农历');
    } finally {
        close();
    }
});

test('面板黄历页按农历查：农历七月初七 = 公历 2026-08-19', async () => {
    const { call, close } = await startPanel();
    try {
        const lunar = await call('/api/xuanji/almanac?date=2026-07-07&calendar=lunar');
        const solar = await call('/api/xuanji/almanac?date=2026-08-19');
        assert.equal(lunar.status, 200);
        assert.equal(lunar.body.value.meta.date, '2026-08-19');
        assert.equal(lunar.body.value.lunarDate, solar.body.value.lunarDate);
    } finally {
        close();
    }
});

test('非法农历请求回 400 且给中文原因（不是库内部英文）', async () => {
    const { call, close } = await startPanel();
    try {
        const bad = await call('/api/xuanji/almanac?date=2026-06-01&calendar=lunar&isLeapMonth=1');
        assert.equal(bad.status, 400);
        assert.match(JSON.stringify(bad.body), /没有闰月/);
    } finally {
        close();
    }
});
