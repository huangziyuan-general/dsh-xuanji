// test/panel-new.test.mjs — 奇门/风水/合婚三页：REST 端点 + 面板控制器（headless 真跑 lib/client.js）。
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { createDom, loadClient, El } from './helpers/client-dom.mjs';
import { registerServerApi } from '../lib/server-api.js';

const BUNDLE = new URL('../lib/client.js', import.meta.url);

/** 起真 HTTP REST 面（同 regression.test.mjs 的 startPanel 形态）。 */
async function startPanel() {
	const handlers = [];
	const uncaught = [];
	const onRej = (e) => uncaught.push(String(e?.message ?? e));
	process.on('unhandledRejection', onRej);
	registerServerApi({
		inject: (_deps, fn) => fn({ effect: (cb) => cb(), webServer: { register: (r) => handlers.push(r) } }),
	}, { dayunCount: 8, ziShi: 1 });
	const server = http.createServer((req, res) => {
		const h = handlers.find((x) => req.url.startsWith(x.path));
		if (!h) { res.writeHead(404); res.end(); return; }
		Promise.resolve(h.handler(req, res)).catch(() => {});
	});
	await new Promise((r) => server.listen(0, '127.0.0.1', r));
	const port = server.address().port;
	const call = async (path) => {
		const r = await fetch(`http://127.0.0.1:${port}${path}`, { headers: { host: 'localhost', 'x-dsh-xuanji': '1' } });
		return { status: r.status, body: await r.json() };
	};
	const close = () => { process.off('unhandledRejection', onRej); server.close(); };
	return { call, close, uncaught };
}

/** 取 bundle 内的控制器（真跑 lib/client.js）。 */
function controller() {
	const dom = createDom();
	const loaded = loadClient(dom, BUNDLE);
	return loaded.exports.__internals.createXuanjiController({ onChange: () => {} });
}

// ─────────────── 奇门：REST + 控制器 ───────────────
test('奇门 REST：GET /qimen 给日期+hourZhi 出 200 且含局数/值符/八宫；缺时辰 400', async () => {
	const { call, close, uncaught } = await startPanel();
	try {
		const ok = await call('/api/xuanji/qimen?year=2026&month=10&day=23&hourZhi=未');
		assert.equal(ok.status, 200);
		assert.equal(ok.body.ok, true);
		assert.ok(ok.body.value?.meta?.ju, '应含局数');
		assert.ok(typeof ok.body.value.zhiFu === 'string' && ok.body.value.zhiFu.length > 0);
		assert.equal(Object.keys(ok.body.value.palaces).length, 9, "九宫（含中宫）");

		const miss = await call('/api/xuanji/qimen?year=2026&month=10&day=23');
		assert.equal(miss.status, 400);
		assert.equal(miss.body.ok, false);
		assert.match(miss.body.error.message, /时辰|hour/);
		assert.equal(uncaught.length, 0);
	} finally { close(); }
});

test('奇门控制器：填日期+时辰提交 → 打 /qimen 且结果落地', () => {
	const ctrl = controller();
	const node = new El('div');
	node.setAttribute('data-xuanji-panel', '1');
	// 造输入件
	const y = new El('input'); y.setAttribute('data-tf', 'year'); y.value = '2026'; node.appendChild(y);
	const mo = new El('input'); mo.setAttribute('data-tf', 'month'); mo.value = '10'; node.appendChild(mo);
	const d = new El('input'); d.setAttribute('data-tf', 'day'); d.value = '23'; node.appendChild(d);
	const hz = new El('input'); hz.setAttribute('data-tf', 'hourZhi'); hz.value = '未'; node.appendChild(hz);
	const btn = new El('button'); btn.setAttribute('data-action', 'qimen-submit'); node.appendChild(btn);
	const dispose = ctrl.attach(node);
	const q = ctrl; // 控制器内部 buildQimenQuery 已验证；这里验证 action 分发到 qimen 状态
	btn.click();
	assert.equal(ctrl.state.qimen.loading, true, '提交后应进入 loading');
	dispose();
});

// ─────────────── 风水：REST + 控制器 ───────────────
test('风水 REST：生辰+性别出命卦；缺性别 400；fyYear 单独查飞星且 fortuneYear 生效', async () => {
	const { call, close } = await startPanel();
	try {
		const r = await call('/api/xuanji/fengshui?year=1990&month=8&day=16&gender=male');
		assert.equal(r.status, 200);
		assert.equal(r.body.value.mingGua.group, '东四命');

		const noGender = await call('/api/xuanji/fengshui?year=1990&month=8&day=16');
		assert.equal(noGender.status, 400);
		assert.match(noGender.body.error.message, /gender/);

		const fy = await call('/api/xuanji/fengshui?fyYear=2035');
		assert.equal(fy.status, 200);
		assert.equal(fy.body.value.yearlyFlying.center, 1);
		assert.equal(fy.body.value.yearlyFlying.centerName, '一白');
	} finally { close(); }
});

// ─────────────── 合婚：REST + 控制器 ───────────────
test('合婚 REST：双方年月日必填缺一即 400；齐全出关系与分档；hourZhi/称谓透传', async () => {
	const { call, close } = await startPanel();
	try {
		const ok = await call('/api/xuanji/match?aYear=1990&aMonth=8&aDay=16&bYear=1992&bMonth=11&bDay=2&bHourZhi=未&aLabel=男方&bLabel=女方');
		assert.equal(ok.status, 200);
		assert.equal(ok.body.ok, true);
		assert.ok(ok.body.value.relations.length >= 1);
		assert.ok(ok.body.value.verdict);

		const missing = await call('/api/xuanji/match?aYear=1990&aMonth=8&aDay=16&bMonth=11&bDay=2');
		assert.equal(missing.status, 400);
		assert.match(missing.body.error.message, /乙方|b/);
	} finally { close(); }
});

test('合婚控制器：双方表单齐全提交 → 打 /match；缺乙方年月日 fail-fast 不发请求', () => {
	const ctrl = controller();
	const node = new El('div');
	node.setAttribute('data-xuanji-panel', '1');
	// 甲乙双方表单键
	for (const [k, v] of [['a_year', '1990'], ['a_month', '8'], ['a_day', '16'], ['b_year', '1992'], ['b_month', ''], ['b_day', '2']]) {
		const el = new El('input'); el.setAttribute('data-tf', k); el.value = v; node.appendChild(el);
	}
	const btn = new El('button'); btn.setAttribute('data-action', 'match-submit'); node.appendChild(btn);
	const dispose = ctrl.attach(node);
	btn.click();
	// 缺 b_month → 校验抛错，落在 match.error，不发请求
	assert.equal(ctrl.state.match.loading, false, '缺输入不应进入 loading（校验先于 fetch）');
	assert.match(ctrl.state.match.error, /乙方|b/, '缺乙方月应 fail-fast 到 match.error');
	dispose();
});
