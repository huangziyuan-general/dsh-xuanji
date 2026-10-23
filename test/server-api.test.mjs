// test/server-api.test.mjs — 面板 REST 面：路由分发、安全三防线（Host/Origin/fence）、
// 引擎 fail-fast 语义。用 ctx.inject 替身物化注册的 handler，用假 req/res 直调。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { registerServerApi } from '../lib/server-api.js';
import http from 'node:http';
import { FENCE_HEADER, PREFIX } from '../lib/server-http.js';

/** 物化 registerServerApi：抓出注册的 handler。 */
function setup() {
    let registered = null;
    let effectFn = null;
    const wctx = {
        webServer: { register: (opts) => { registered = opts; } },
        effect: (fn) => { effectFn = fn; },
    };
    const ctx = { inject: (_names, cb) => cb(wctx) };
    registerServerApi(ctx);
    assert.ok(typeof effectFn === 'function', '注册必须走 ctx.effect（宿主卸载语义）');
    effectFn();
    assert.equal(registered.kind, 'prefix');
    assert.equal(registered.path, PREFIX);
    return registered.handler;
}

/** 假 res：收 writeHead/end。 */
function makeRes() {
    return {
        status: null,
        headers: null,
        body: null,
        writeHead(status, headers) { this.status = status; this.headers = headers; },
        end(text) { this.body = text; },
        json() { return JSON.parse(this.body); },
    };
}

const req = (url, headers = {}) => ({ method: 'GET', url, headers: { host: 'localhost:3000', [FENCE_HEADER]: '1', ...headers } });

test('GET /health：返回插件名 + 版本（版本来自 package.json，单一来源）', async () => {
    const handler = setup();
    const res = makeRes();
    await handler(req(`${PREFIX}/health`), res);
    assert.equal(res.status, 200);
    const body = res.json();
    assert.equal(body.ok, true);
    const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    assert.equal(body.value.version, pkg.version);
    assert.equal(body.value.name, 'dsh-xuanji');
});

test('安全三防线：非本机 Host 403 / 非本机 Origin 403 / 缺 fence 403', async () => {
    const handler = setup();
    // Host 非本机
    let res = makeRes();
    await handler(req(`${PREFIX}/health`, { host: 'evil.example.com' }), res);
    assert.equal(res.status, 403);
    assert.equal(res.json().error.code, 'FORBIDDEN_HOST');
    // Host 大写归一（case-insensitive 头）
    res = makeRes();
    await handler(req(`${PREFIX}/health`, { host: 'LOCALHOST:8080' }), res);
    assert.equal(res.status, 200);
    // Origin 非本机
    res = makeRes();
    await handler(req(`${PREFIX}/health`, { origin: 'https://evil.example.com' }), res);
    assert.equal(res.status, 403);
    assert.equal(res.json().error.code, 'FORBIDDEN_ORIGIN');
    // Origin 畸形
    res = makeRes();
    await handler(req(`${PREFIX}/health`, { origin: '::not-a-url::' }), res);
    assert.equal(res.status, 403);
    // 缺 fence
    res = makeRes();
    await handler({ method: 'GET', url: `${PREFIX}/health`, headers: { host: 'localhost' } }, res);
    assert.equal(res.status, 403);
    assert.equal(res.json().error.code, 'FORBIDDEN');
});

test('GET /trend：合法参数走引擎（形状对齐 xuanji_trend）；参数进 query', async () => {
    const handler = setup();
    const res = makeRes();
    await handler(req(`${PREFIX}/trend?year=1990&month=8&day=16&gender=male&toAge=30`), res);
    assert.equal(res.status, 200);
    const body = res.json();
    assert.equal(body.ok, true);
    assert.equal(body.value.meta.birth, '1990-08-16');
    assert.ok(Array.isArray(body.value.points) && body.value.points.length === 30);
    assert.ok(body.value.points[0].kline && typeof body.value.points[0].kline.close === 'number');
});

test('GET /trend：引擎 fail-fast → 400 ENGINE_INPUT，错误消息原文可读', async () => {
    const handler = setup();
    const res = makeRes();
    await handler(req(`${PREFIX}/trend?year=1990&month=8&day=16`), res); // 缺 gender
    assert.equal(res.status, 400);
    const body = res.json();
    assert.equal(body.ok, false);
    assert.equal(body.error.code, 'ENGINE_INPUT');
    assert.match(body.error.message, /gender/);
});

test('GET /tarot：daily 与 three（带 question）都通；three 缺 question → 400', async () => {
    const handler = setup();
    let res = makeRes();
    await handler(req(`${PREFIX}/tarot?mode=daily&date=2026-10-22`), res);
    assert.equal(res.status, 200);
    const daily = res.json().value;
    assert.equal(daily.meta.mode, 'daily');
    assert.ok(daily.card.name);

    res = makeRes();
    await handler(req(`${PREFIX}/tarot?mode=three&question=${encodeURIComponent('该不该换工作')}&date=2026-10-22`), res);
    assert.equal(res.status, 200);
    assert.equal(res.json().value.cards.length, 3);

    res = makeRes();
    await handler(req(`${PREFIX}/tarot?mode=three`), res);
    assert.equal(res.status, 400);
    assert.match(res.json().error.message, /question/);
});

test('未知路径 404；isLeapMonth/applyDST/city 参数透传不炸', async () => {
    const handler = setup();
    const res = makeRes();
    await handler(req(`${PREFIX}/nope`), res);
    assert.equal(res.status, 404);
    const res2 = makeRes();
    await handler(req(`${PREFIX}/trend?year=1990&month=8&day=16&gender=female&isLeapMonth=0&applyDST=1&city=%E4%B8%8A%E6%B5%B7`), res2);
    assert.equal(res2.status, 200);
});

test('GET /bazi：全参数排盘（含 city 真太阳时 notes）；缺年 → 400 可读错误', async () => {
    const handler = setup();
    let res = makeRes();
    await handler(req(`${PREFIX}/bazi?year=1998&month=7&day=31&hour=14&minute=10&gender=male&city=%E6%88%90%E9%83%BD`), res);
    assert.equal(res.status, 200);
    const v = res.json().value;
    assert.equal(v.pillars.year.ganZhi, '戊寅');
    assert.equal(v.pillars.hour.ganZhi, '辛未');
    assert.ok(v.meta.notes.some((n) => n.includes('真太阳时')), 'city 应触发真太阳时校正 note');
    assert.ok(v.zhiRelations.every((r) => r.text), '刑冲合会应带可读文本');
    res = makeRes();
    await handler(req(`${PREFIX}/bazi?month=7&day=31&gender=male`), res);
    assert.equal(res.status, 400);
    assert.match(res.json().error.message, /出生|年/);
});

test('GET /almanac：缺省今天 + 指定日期；坏日期 → 400', async () => {
    const handler = setup();
    let res = makeRes();
    await handler(req(`${PREFIX}/almanac`), res);
    assert.equal(res.status, 200);
    assert.ok(res.json().value.meta.isToday === true, '缺省日期应标今天');
    assert.ok(res.json().value.positions.caiShen, '方位应有财神');
    res = makeRes();
    await handler(req(`${PREFIX}/almanac?date=2026-10-22`), res);
    assert.equal(res.status, 200);
    assert.equal(res.json().value.meta.date, '2026-10-22');
    res = makeRes();
    await handler(req(`${PREFIX}/almanac?date=not-a-date`), res);
    assert.equal(res.status, 400);
});

test('GET /xiaoliuren 与 /meihua：报数起课透传 question；缺数 → 400 可读错误', async () => {
    const handler = setup();
    let res = makeRes();
    await handler(req(`${PREFIX}/xiaoliuren?num1=3&num2=17&num3=8&question=${encodeURIComponent('测试')}`), res);
    assert.equal(res.status, 200);
    assert.equal(res.json().value.steps.length, 3);
    assert.ok(res.json().value.result.palace);
    res = makeRes();
    await handler(req(`${PREFIX}/meihua?num1=7&num2=30&question=${encodeURIComponent('测试')}`), res);
    assert.equal(res.status, 200);
    assert.ok(res.json().value.gua.ben.name);
    res = makeRes();
    await handler(req(`${PREFIX}/xiaoliuren?num1=3`), res);
    assert.equal(res.status, 400);
    assert.match(res.json().error.message, /三个|缺数/);
});

test('GET /chenggu：时辰齐全出总骨重；缺时辰 → 400 可读错误', async () => {
    const handler = setup();
    let res = makeRes();
    await handler(req(`${PREFIX}/chenggu?year=1984&month=2&day=2&hour=0`), res);
    assert.equal(res.status, 200);
    assert.equal(res.json().value.total.qian, 39, '1984-02-02 子时应为三两九钱（黄金锚例）');
    res = makeRes();
    await handler(req(`${PREFIX}/chenggu?year=1984&month=2&day=2`), res);
    assert.equal(res.status, 400);
    assert.match(res.json().error.message, /时辰/);
});

// ── 奇门 REST 面（GET /qimen，时辰必填 fail-fast，缺时不给默认值）──

async function startQimenPanel() {
    const handlers = [];
    registerServerApi({
        inject: (_deps, fn) => fn({
            effect: (cb) => cb(),
            webServer: { register: (r) => handlers.push(r) },
        }),
    }, { dayunCount: 8, ziShi: 1 });
    const server = http.createServer((req, res) => {
        const h = handlers.find((x) => req.url.startsWith(x.path));
        if (!h) { res.writeHead(404); res.end(); return; }
        Promise.resolve(h.handler(req, res)).catch(() => {});
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    const call = async (path) => {
        const r = await fetch(`http://127.0.0.1:${port}${path}`, {
            headers: { host: 'localhost', 'x-dsh-xuanji': '1' },
        });
        return { status: r.status, body: await r.json() };
    };
    return { call, close: () => server.close() };
}

test('P 奇门 REST：GET /qimen 给日期+时辰出 200 且含局数/值符/值使/九宫', async () => {
    const { call, close } = await startQimenPanel();
    try {
        const r = await call('/api/xuanji/qimen?year=2026&month=10&day=23&hour=14');
        assert.equal(r.status, 200, `期望 200，实得 ${r.status}`);
        assert.equal(r.body.ok, true);
        assert.ok(r.body.value?.meta?.ju, '应有 ju（局数）');
        assert.equal(typeof r.body.value.zhiFu, 'string', '应有值符');
        assert.equal(typeof r.body.value.zhiShi?.gate, 'string', '应有值使门');
        assert.equal(Object.keys(r.body.value.palaces).length, 9, '九宫齐全（含中宫）');
        assert.equal(r.body.value.men[5], null, '中宫无门');
    } finally { close(); }
});

test('P 奇门 REST：缺 hour 必须 400 fail-fast（不许默认午时）', async () => {
    const { call, close } = await startQimenPanel();
    try {
        const r = await call('/api/xuanji/qimen?year=2026&month=10&day=23');
        assert.equal(r.status, 400);
        assert.equal(r.body.ok, false);
        assert.match(r.body.error.message, /hour|时辰/);
    } finally { close(); }
});

// ── REST 输入边界（AUDIT REST 面）──────────────────────────────────────────
test('R 输入边界：fyYear / fortuneYear 越界返回 400，不再一路穿到引擎', async () => {
    const { call, close } = await startQimenPanel();
    try {
        for (const q of ['fyYear=99999', 'fyYear=-99999', 'fyYear=1800']) {
            const r = await call(`/api/xuanji/fengshui?${q}`);
            assert.equal(r.status, 400, `${q} 应被拒（旧版返回 200）`);
            assert.equal(r.body.ok, false);
            assert.match(r.body.error.message, /须在 1900–2100/);
        }
        const ok = await call('/api/xuanji/fengshui?fyYear=2035');
        assert.equal(ok.status, 200, '合法流年仍要能查');
        assert.equal(ok.body.value.yearlyFlying.center, 1, '2035 应为一白入中');
    } finally { close(); }
});

test('R 输入边界：字符串 query 超长被拒，响应体不被输入线性放大', async () => {
    const { call, close } = await startQimenPanel();
    try {
        const big = 'A'.repeat(5000);
        const base = '/api/xuanji/match?aYear=1990&aMonth=8&aDay=16&bYear=1992&bMonth=5&bDay=20';
        for (const path of [`/api/xuanji/tarot?mode=single&question=${big}`, `${base}&aLabel=${big}`]) {
            const r = await call(path);
            assert.equal(r.status, 400, `${path.slice(0, 30)}… 超长输入应拒，实得 ${r.status}`);
            assert.match(r.body.error.message, /过长/);
            assert.ok(JSON.stringify(r.body).length < 2000, '响应体应远小于输入长度');
        }
    } finally { close(); }
});

test('R 错误分类：400 只回面向用户的消息，不带栈与源码路径', async () => {
    const { call, close } = await startQimenPanel();
    try {
        const bad = await call('/api/xuanji/bazi?year=abc&month=8&day=16&gender=male');
        assert.equal(bad.status, 400);
        const wire = JSON.stringify(bad.body);
        assert.ok(!/at \S+\.js:\d+/.test(wire), `响应疑似带栈：${wire.slice(0, 300)}`);
        assert.ok(!/node_modules/.test(wire), '响应不应泄露依赖路径');
    } finally { close(); }
});
