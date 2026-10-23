// test/regression.test.mjs — 审计回归闸。
//
// 这一份不是「功能测试」，是把 2026-10-22 审计里实跑复现过的每一个缺陷钉成断言。
// 当时 183 个测试全绿、却一个 bug 都没抓到，原因不是断言写得松，而是**参数变体没覆盖**：
//   · 起名用例恰好命中「日主中和」，绕开了出错的偏强分支；
//   · 梅花只测了时间起卦，没测报数分支的 hourForNumber；
//   · 没人测过 REST 路由这条路径（它与 MCP 工具路径不等价）；
//   · 没人按 UI 引导的「必填填完、选填留空」去打 REST。
// 所以这里每条测试都指名 Monitoring 的是当初漏掉的那种输入。别删，删了就会原样复发。

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';

import { assessName } from '../lib/engine/name.js';
import { computeMeihua } from '../lib/engine/meihua.js';
import { computeChenggu } from '../lib/engine/chenggu.js';
import { resolveBirthTime } from '../lib/engine/birth-time.js';
import { computeMatch } from '../lib/engine/match.js';
import { computeTrend } from '../lib/engine/trend.js';
import { computeBazi } from '../lib/engine/bazi.js';
import { resolveLongitude } from '../lib/engine/true-solar-time.js';
import { assertYmd } from '../lib/tools/common.js';
import { registerServerApi } from '../lib/server-api.js';

/** 起一个真实 HTTP 服务（含 cordis ctx 桩），返回 { call, close }。 */
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

    const call = async (path) => {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 5000);
        try {
            const r = await fetch(`http://127.0.0.1:${port}${path}`, {
                headers: { host: 'localhost', 'x-dsh-xuanji': '1' },
                signal: ctrl.signal,
            });
            clearTimeout(t);
            return { status: r.status, body: await r.json() };
        } catch (e) {
            clearTimeout(t);
            return { status: 0, error: e.name };
        }
    };
    const close = () => {
        process.off('unhandledRejection', onRej);
        server.close();
    };
    return { call, close, uncaught };
}

// ───────────────────────── P1：面板默认操作不再把宿主拖崩 ─────────────────────────

test('P1 面板默认用法（填时辰、城市留空）必须出结果而不是挂起', async () => {
    const { call, close, uncaught } = await startPanel();
    try {
        // 这就是 UI 引导出来的默认请求：城市写着「可选」，用户当然会留空。
        const r = await call('/api/xuanji/bazi?year=1990&month=8&day=16&hour=14&gender=male&calendar=solar');
        assert.equal(r.status, 200, `期望 200，实得 ${r.status} ${r.error ?? ''}`);
        assert.equal(r.body.ok, true);
        assert.equal(uncaught.length, 0, `不该有未捕获 rejection：${uncaught.join(' | ')}`);
    } finally { close(); }
});

test('P1 所有非法组合都必须回 400，绝不变成挂起', async () => {
    const { call, close, uncaught } = await startPanel();
    try {
        const base = '/api/xuanji/bazi?year=1990&month=8&day=16&gender=male&calendar=solar';
        const cases = [
            `${base}&hour=14&longitude=999`,
            `${base}&hour=14&city=${encodeURIComponent('不存在')}`,
            `${base}&hour=99`,
            `${base}&hour=14&minute=99`,
            '/api/xuanji/bazi?year=1990&month=13&day=1&hour=10&gender=male&calendar=lunar',
        ];
        for (const c of cases) {
            const r = await call(c);
            assert.equal(r.status, 400, `${c} 期望 400，实得 ${r.status}`);
            assert.equal(r.body.ok, false);
        }
        assert.equal(uncaught.length, 0, `不该有未捕获 rejection：${uncaught.join(' | ')}`);
    } finally { close(); }
});

// ───────────────────────── C2：缺年月日不得静默按 0 归一 ─────────────────────────

test('C2 /trend 与 /chenggu 缺 year 必须 400（不许排出公元零年的盘）', async () => {
    const { call, close } = await startPanel();
    try {
        const trend = await call('/api/xuanji/trend?month=8&day=16&gender=male&toAge=30');
        assert.equal(trend.status, 400, 'trend 缺 year 应 400');
        const cg = await call('/api/xuanji/chenggu?month=8&day=16&hour=10');
        assert.equal(cg.status, 400, 'chenggu 缺 year 应 400');
    } finally { close(); }
});

// ───────────────────────── E3：称骨 REST 面与工具面同源 ─────────────────────────

test('E3 称骨：REST 面必须走夏令时，与工具路径同结果', async () => {
    const { call, close } = await startPanel();
    try {
        // 1990-08-16 hour=1 落在 1990 夏令时区间（4/15–9/16）内，不校正就会差一个时辰。
        const rest = await call('/api/xuanji/chenggu?year=1990&month=8&day=16&hour=1&calendar=solar');
        assert.equal(rest.status, 200);
        const rt = resolveBirthTime({ year: 1990, month: 8, day: 16, hour: 1, calendar: 'solar' }, { requireHour: true });
        const tool = computeChenggu({ year: rt.solar.year, month: rt.solar.month, day: rt.solar.day, hour: rt.hour, calendar: 'solar' });
        assert.equal(
            rest.body.value.total.qian, tool.total.qian,
            `面板(${rest.body.value.total.qian} 钱) 与工具(${tool.total.qian} 钱) 必须一致`,
        );
        assert.ok((rest.body.value.meta.notes ?? []).some((n) => /夏令时/.test(n)), '夏令时校正应写进 notes');
    } finally { close(); }
});

test('E3 称骨：hourZhi 直传路径给出口径说明', async () => {
    const { call, close } = await startPanel();
    try {
        const r = await call('/api/xuanji/chenggu?year=1990&month=8&day=16&hourZhi=' + encodeURIComponent('子'));
        assert.equal(r.status, 200);
        assert.deepEqual(r.body.value.meta.notes.length > 0, true);
    } finally { close(); }
});

// ───────────────────────── C1：城市表原型链绕过 ─────────────────────────

test('C1 城市名不得命中 Object.prototype 上的键', () => {
    for (const bad of ['toString', 'constructor', 'valueOf', 'hasOwnProperty', '__proto__']) {
        assert.throws(() => resolveLongitude({ city: bad }), /不在内置经度表/, `city=${bad} 应被拒绝`);
    }
    assert.equal(resolveLongitude({ city: '成都' }).source, '内置城市表（成都）');
});

// ───────────────────────── E1：起名喜用必须「克泄耗」而不是「生扶」 ─────────────────────────

test('E1 偏强日主：喜用必须是官杀/食伤/财，绝不能把「印」算进来', () => {
    // 2026-01-01 10:00 男 → 日主乙木偏强
    const r = assessName({ surname: '李', givenName: '铭', birth: { year: 2026, month: 1, day: 1, hour: 10, gender: 'male', calendar: 'solar' } });
    const bz = r.meta.bazi;
    assert.equal(bz.strength.state, '偏强');
    const dayEl = bz.strength.dayElement;
    // 木日主偏强 → 金(官杀)/火(食伤)/土(财)；水(印) 是身强最忌的，绝不能进名单
    const expected = ['金', '火', '土'];
    assert.deepEqual([...r.favor.favorable].sort(), expected.sort(), '偏强喜用应为官杀食伤财');
    assert.ok(!r.favor.favorable.includes('水'), '「水（印）」是身强所忌，不应出现在喜用里');
    // 端到端：属「金」的「铭」必须被判为喜用
    const ming = r.chars.find((c) => c.char === '铭');
    assert.equal(ming.wuxing, '金');
    assert.match(ming.match, /喜用/, '偏强木日主用金字应判为喜用');
    assert.ok(ming.status !== '非喜用');
    assert.ok(dayEl === '木');
});

test('E1 偏弱日主：喜用必须是比劫/印', () => {
    // 找一个偏弱命例，验证另一张表没被带坏
    const r = assessName({ surname: '李', givenName: '铭', birth: { year: 2026, month: 3, day: 20, hour: 10, gender: 'male', calendar: 'solar' } });
    if (r.meta?.bazi?.strength?.state === '偏弱') {
        const dayEl = r.meta.bazi.strength.dayElement;
        assert.ok(r.favor.favorable.includes(dayEl), '偏弱应含与日主同气的比劫');
    }
});

// ───────────────────────── E2：梅花报数起卦的时辰数 ─────────────────────────

test('E2 报数起卦：23 时必须是子时 1 而不是 0/24', () => {
    // 地支序：子1 丑2 寅3 卯4 辰5 巳6 午7 未8 申9 酉10 戌11 亥12
    // 标准时辰换算：子时 23:00–00:59（序1），丑时 01:00–02:59（序2）…亥时 21:00–22:59（序12）。
    // 关键是 23 时必须是子时 1（修复前被算成 (23+1)%24=0）。
    const expected = { 0: 1, 1: 2, 2: 2, 3: 3, 12: 7, 13: 8, 22: 12, 23: 1 };
    for (const [hour, zhiSeq] of Object.entries(expected)) {
        const r = computeMeihua({ mode: 'number', num1: 8, num2: 16, hourForNumber: Number(hour) });
        const yaoOf = (...args) => ((args.reduce((a, b) => a + b, 0) % 6) + 6) % 6 || 6;
        assert.equal(r.gua.movingYao, yaoOf(8, 16, zhiSeq), `hour=${hour} 应用地支序 ${zhiSeq}`);
    }
});

test('E2 报数起卦：不同时辰必须能动爻不同（不是常数）', () => {
    const seen = new Set();
    for (let h = 0; h < 24; h++) {
        seen.add(computeMeihua({ mode: 'number', num1: 8, num2: 16, hourForNumber: h }).gua.movingYao);
    }
    assert.ok(seen.size >= 5, `24 个时辰应产生多种动爻，实得 ${seen.size} 种`);
});

// ───────────────────────── E4/E5：合婚对称性与口径 ─────────────────────────

test('E4 合婚：属相关系必须对称（换顺序结论不变）', () => {
    const pairs = [[2022, 2016], [2016, 2022], [1990, 1993], [1993, 1990]];
    for (const [ya, yb] of pairs) {
        const ab = computeMatch({ a: { year: ya, month: 6, day: 1, gender: 'male' }, b: { year: yb, month: 6, day: 1, gender: 'female' } });
        const ba = computeMatch({ a: { year: yb, month: 6, day: 1, gender: 'female' }, b: { year: ya, month: 6, day: 1, gender: 'male' } });
        const key = (r) => r.relations.filter((x) => x.kind === '属相').map((x) => x.rel).sort().join(',');
        assert.equal(key(ab), key(ba), `${ya}/${yb} 交换双方后属相关系集合必须一致`);
    }
});

test('E4 寅巳申三刑：任取两支都要检出', () => {
    // 虎(寅)=2022, 蛇(巳)=2013, 猴(申)=2016 —— 三刑组任两支皆刑
    const combos = [[2022, 2013], [2013, 2022], [2013, 2016], [2016, 2013], [2022, 2016], [2016, 2022]];
    for (const [ya, yb] of combos) {
        const r = computeMatch({ a: { year: ya, month: 6, day: 1, gender: 'male' }, b: { year: yb, month: 6, day: 1, gender: 'female' } });
        const has = r.relations.some((x) => x.kind === '属相' && x.rel === '相刑');
        assert.equal(has, true, `${ya} 年与 ${yb} 年应检出相刑`);
    }
});

test('E5 立春界窗口：生肖与年支不得自相矛盾', () => {
    // 2026 立春 2/4、春节 2/17 —— 这段窗口内农历生肖与八字年支不同源，输出必须仍自洽
    const r = computeMatch({ a: { year: 2026, month: 2, day: 10, gender: 'male' }, b: { year: 2026, month: 2, day: 10, gender: 'female' } });
    const same = r.relations.find((x) => x.rel === '同属相');
    assert.ok(same, '同日生应检出同属相');
    const m = same.text.match(/同属(.+)（(.+)）/);
    assert.ok(m, `文案格式异常：${same.text}`);
    const SHENGXIAO_BY_ZHI = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
    const zhiFromShengxiao = SHENGXIAO_BY_ZHI.indexOf(m[1]);
    const ZHI_LIST = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
    assert.equal(ZHI_LIST[zhiFromShengxiao], m[2], `生肖「${m[1]}」与地支「${m[2]}」必须对应`);
});

// ───────────────────────── E6：人生K线必须有真实起伏 ─────────────────────────

test('E6 人生K线不得系统性单边偏高', () => {
    const t = computeTrend({ year: 1990, month: 8, day: 16, hour: 10, gender: 'male', toAge: 60 });
    const nums = JSON.stringify(t).match(/"score":-?\d+/g)?.map((s) => Number(s.split(':')[1])) ?? [];
    assert.ok(nums.length >= 40, `样本太少：${nums.length}`);
    const min = Math.min(...nums);
    const max = Math.max(...nums);
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    // 修复前 min=53 max=95 avg=72.3，全段没有低于 53 的年份，等于把起伏画成了单边上涨
    assert.ok(min < 45, `最低分应有明显低谷，实得 ${min}`);
    assert.ok(max > 55, `最高分应有明显高峰，实得 ${max}`);
    assert.ok(max - min > 25, `极差应足以体现起伏，实得 ${(max - min).toFixed(1)}`);
    assert.ok(Math.abs(avg - 50) < 30, `均值不应过度偏离中位，实得 ${avg.toFixed(1)}`);
});

// ───────────────────────── E8：三刑不得重复计数 ─────────────────────────

test('E8 八字地支关系：三刑齐全不得重复输出多条', () => {
    const r = computeBazi({ year: 2020, month: 2, day: 8, hour: 15, gender: 'male' });
    const all = Array.isArray(r.relations) ? r.relations : (r.branches?.relations ?? []);
    const xing = all.filter((x) => x.type === '相刑');
    // 修复前：三刑全见 1 条 + 两支对刑 3 条 = 4 条重复
    assert.ok(xing.length <= 1, `三刑齐全时应只报 1 条，实得 ${xing.length} 条：${xing.map((x) => x.text).join(' / ')}`);
});

// ───────────────────────── C3：日期真实性 ─────────────────────────

test('C3 不存在的日期必须报错（不许静默折算成另一天）', () => {
    assert.throws(() => assertYmd({ year: 1990, month: 2, day: 30 }), /没有 30 日/);
    assert.throws(() => assertYmd({ year: 2026, month: 4, day: 31 }), /没有 31 日/);
    assert.throws(() => assertYmd({ year: 2026, month: 13, day: 1 }), /1–12/);
    // 闰年 2 月 29 日必须放行
    assert.doesNotThrow(() => assertYmd({ year: 2024, month: 2, day: 29 }));
    assert.throws(() => assertYmd({ year: 2026, month: 2, day: 29 }), /没有 29 日/);
});

// ───────────────────────── C4：REST 面必须吃宿主 ziShi 配置 ─────────────────────────

test('C4 REST /bazi 采用宿主 ziShi 配置（与工具面同口径）', async () => {
    const { call, close } = await startPanel();
    try {
        // 用 1993 年（不在 1986–1991 夏令时区间内）来隔离 ziShi 这一个变量——
        // 拿夏令时年份测会把「夏令时校正」混进来，鉴别的就不是晚子时口径了。
        const inp = { year: 1993, month: 8, day: 16, hour: 23, minute: 30, gender: 'male', calendar: 'solar', timeKnown: true };
        const toolDefault = computeBazi(inp, { ziShi: 1 }).pillars.day.ganZhi;
        const toolAlt = computeBazi(inp, { ziShi: 2 }).pillars.day.ganZhi;
        assert.notEqual(toolDefault, toolAlt, 'ziShi 两种口径应给出不同日柱，否则这条测试没有鉴别力');

        const r = await call('/api/xuanji/bazi?year=1993&month=8&day=16&hour=23&minute=30&gender=male&calendar=solar');
        assert.equal(r.status, 200);
        // startPanel 注册时透传的是 { ziShi: 1 }
        assert.equal(r.body.value.pillars.day.ganZhi, toolDefault, '面板必须跟随宿主 ziShi=1，而不是硬编码默认');
    } finally { close(); }
});

// ───────────────────────── 三道防线（必须保持有效） ─────────────────────────

test('安全：缺 fence 头 / 恶意 Origin 一律 403', async () => {
    const handlers = [];
    registerServerApi({
        inject: (_d, fn) => fn({ effect: (cb) => cb(), webServer: { register: (r) => handlers.push(r) } }),
    });
    const server = http.createServer((req, res) => {
        const h = handlers.find((x) => req.url.startsWith(x.path));
        if (!h) { res.writeHead(404); res.end(); return; }
        Promise.resolve(h.handler(req, res)).catch(() => {});
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const port = server.address().port;
    const raw = async (headers) => {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 3000);
        try {
            const r = await fetch(`http://127.0.0.1:${port}/api/xuanji/almanac`, { headers, signal: ctrl.signal });
            clearTimeout(t);
            return r.status;
        } catch { clearTimeout(t); return 0; }
    };
    // 注意：fetch 不允许调用方改写 Host 头（浏览器/undici 都会忽略），
    // DNS rebinding 这种「域名解析到 127.0.0.1 但 Host 仍是攻击者域名」的场景必须用裸 socket 才能真实模拟。
    const rawSocket = (hostHeader, extra = '') => new Promise((resolve) => {
        const sock = net.connect(port, '127.0.0.1', () => {
            sock.write(`GET /api/xuanji/almanac HTTP/1.1\r\nHost: ${hostHeader}\r\nx-dsh-xuanji: 1\r\n${extra}Connection: close\r\n\r\n`);
        });
        let buf = '';
        sock.on('data', (d) => { buf += String(d); });
        sock.on('end', () => resolve(Number(buf.split('\r\n')[0].split(' ')[1]) || 0));
        sock.on('error', () => resolve(0));
    });

    try {
        assert.equal(await raw({ host: 'localhost', 'x-dsh-xuanji': '1' }), 200, '本机 + fence 应放行');
        assert.equal(await raw({ host: 'localhost' }), 403, '缺 fence 头应拒');
        assert.equal(await raw({ host: '127.0.0.1', 'x-dsh-xuanji': '1', origin: 'https://evil.com' }), 403, '恶意 Origin 应拒');
        assert.equal(await raw({ host: 'localhost', 'x-dsh-xuanji': '1', origin: 'null' }), 403, 'Origin:null 应拒');
        // DNS rebinding：只有裸 socket 能把 Host 写成攻击者域名
        assert.equal(await rawSocket('attacker.com'), 403, 'DNS rebinding（Host 非本机）必须拒');
        assert.equal(await rawSocket('localhost.evil.com'), 403, '伪装成本机的域名后缀必须拒');
        assert.equal(await rawSocket('localhost'), 200, '裸 socket 本机 Host 应放行');
    } finally { server.close(); }
});
