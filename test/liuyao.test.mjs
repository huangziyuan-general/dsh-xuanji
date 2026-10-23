// test/liuyao.test.mjs — 六爻纳甲：引擎口径 + REST 面 + 面板控制器 + 视图渲染。
// 口径锚点全部取传统通行表（乾宫纳甲、天风姤纳甲、庚日六神起例、戌月旺衰），不是拍脑袋。
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import { createDom, loadClient, El } from './helpers/client-dom.mjs';
import { registerServerApi } from '../lib/server-api.js';
import {
    computeLiuyao, parseTosses, PALACE_INDEX, EIGHT_PALACES, NAJIA, LIUSHEN_START,
    liuqinOf, wangShuaiOf,
} from '../lib/engine/liuyao.js';

const BUNDLE = new URL('../lib/client.js', import.meta.url);

/** 起真 HTTP REST 面（同 panel-new.test.mjs 形态）。 */
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

// ─────────────── 八宫表 ───────────────
test('京房八宫表：八宫×八卦 = 64 卦不重不漏，宫五行符合传统（乾兑金/离火/震巽木/坎水/艮坤土）', () => {
	assert.equal(PALACE_INDEX.size, 64);
	for (const { palace, wuxing, seq } of EIGHT_PALACES) {
		assert.equal(seq.length, 8, `${palace}宫应含八卦`);
		for (const kingWen of seq) {
			const info = PALACE_INDEX.get(kingWen);
			assert.equal(info.palace, palace);
			assert.equal(info.palaceWuxing, wuxing);
		}
	}
	assert.equal(PALACE_INDEX.get(1).palace, '乾');
	assert.equal(PALACE_INDEX.get(2).palace, '坤');
	assert.equal(PALACE_INDEX.get(1).palaceWuxing, '金');
	assert.equal(PALACE_INDEX.get(29).palaceWuxing, '水');
});

test('世应：本宫世六、一世世初、游魂世四、归魂世三；应爻与世爻隔两爻', () => {
	assert.deepEqual([PALACE_INDEX.get(1).shi, PALACE_INDEX.get(44).shi, PALACE_INDEX.get(35).shi, PALACE_INDEX.get(14).shi],
		[6, 1, 4, 3], '乾宫：本宫世六、姤(一世)世初、晋(游魂)世四、大有(归魂)世三');
	const r = computeLiuyao({ nums: [7, 7, 7, 7, 7, 7], date: '2026-10-23' });
	assert.equal(r.shiYing.shi, 6);
	assert.equal(r.shiYing.ying, 3);
	assert.ok(r.lines[5].isShi && r.lines[2].isYing);
	assert.equal(r.lines.filter((l) => l.isShi).length, 1);
	assert.equal(r.lines.filter((l) => l.isYing).length, 1);
});

// ─────────────── 纳甲 ───────────────
test('纳甲：乾为天 = 甲子甲寅甲辰壬午壬申壬戌（乾纳甲壬，内卦甲外卦壬）', () => {
	const r = computeLiuyao({ nums: [7, 7, 7, 7, 7, 7], date: '2026-10-23' });
	assert.equal(r.ben.name, '乾为天');
	assert.deepEqual(r.lines.map((l) => l.ganZhi), ['甲子', '甲寅', '甲辰', '壬午', '壬申', '壬戌']);
	assert.equal(r.ben.palace, '乾宫');
	assert.equal(r.ben.palaceWuxing, '金');
});

test('纳甲：天风姤 = 上乾下巽 → 内卦巽纳辛（丑亥酉）外卦乾纳壬（午申戌）', () => {
	// 巽 [0,1,1] 在下、乾 [1,1,1] 在上 → 初爻阴(8)、余阳(7)
	const r = computeLiuyao({ nums: [8, 7, 7, 7, 7, 7], date: '2026-10-23' });
	assert.equal(r.ben.name, '天风姤');
	assert.deepEqual(r.lines.map((l) => l.ganZhi), ['辛丑', '辛亥', '辛酉', '壬午', '壬申', '壬戌']);
	assert.equal(r.ben.gen, '一世');
	assert.equal(r.shiYing.shi, 1);
	assert.equal(r.shiYing.ying, 4);
});

test('纳甲表自洽：八经卦内卦三支与外卦三支各不重复，且阳卦顺行阴卦逆行', () => {
	for (const [name, { gan, zhi }] of Object.entries(NAJIA)) {
		assert.equal(gan.length, 2);
		assert.deepEqual([zhi[0].length, zhi[1].length], [3, 3]);
		assert.equal(new Set([...zhi[0], ...zhi[1]]).size, 6, `${name} 的六位地支应互不相同`);
	}
	assert.deepEqual(NAJIA.乾.zhi[0], ['子', '寅', '辰'], '乾（阳卦）地支顺行');
	assert.deepEqual(NAJIA.坤.zhi[0], ['未', '巳', '卯'], '坤（阴卦）地支逆行');
	assert.deepEqual(NAJIA.乾.gan, ['甲', '壬'], '乾纳甲壬');
	assert.deepEqual(NAJIA.坤.gan, ['乙', '癸'], '坤纳乙癸');
});

// ─────────────── 六亲 / 旺衰 / 六神 ───────────────
test('六亲：以八宫五行为我——生我父母、同我兄弟、我生子孙、克我官鬼、我克妻财', () => {
	assert.equal(liuqinOf('金', '土'), '父母');
	assert.equal(liuqinOf('金', '金'), '兄弟');
	assert.equal(liuqinOf('金', '水'), '子孙');
	assert.equal(liuqinOf('金', '火'), '官鬼');
	assert.equal(liuqinOf('金', '木'), '妻财');
	// 乾宫属金：子水子孙、寅木妻财、辰土父母、午火官鬼、申金兄弟、戌土父母
	const r = computeLiuyao({ nums: [7, 7, 7, 7, 7, 7], date: '2026-10-23' });
	assert.deepEqual(r.lines.map((l) => l.liuqin), ['子孙', '妻财', '父母', '官鬼', '兄弟', '父母']);
});

test('旺相休囚死：戌月（土）→ 土旺、金相、火休、木囚、水死', () => {
	assert.equal(wangShuaiOf('土', '土'), '旺');
	assert.equal(wangShuaiOf('土', '金'), '相');
	assert.equal(wangShuaiOf('土', '火'), '休');
	assert.equal(wangShuaiOf('土', '木'), '囚');
	assert.equal(wangShuaiOf('土', '水'), '死');
	const r = computeLiuyao({ nums: [7, 7, 7, 7, 7, 7], date: '2026-10-23' }); // 戊戌月
	assert.equal(r.meta.yueJian.ganZhi, '戊戌', '月建按节气月：2026-10-23 霜降 → 戌月');
	assert.deepEqual(r.lines.map((l) => l.wangShuai), ['死', '囚', '旺', '休', '相', '旺']);
});

test('六神：庚日起白虎，六神自初爻向上循环（白虎→玄武→青龙→朱雀→勾陈→腾蛇）', () => {
	assert.equal(LIUSHEN_START.庚, 4);
	assert.equal(LIUSHEN_START.甲, 0);
	assert.equal(LIUSHEN_START.癸, 5);
	const r = computeLiuyao({ nums: [7, 7, 7, 7, 7, 7], date: '2026-10-23' }); // 日辰庚午
	assert.equal(r.meta.riChen.ganZhi, '庚午');
	assert.deepEqual(r.lines.map((l) => l.liushen), ['白虎', '玄武', '青龙', '朱雀', '勾陈', '腾蛇']);
});

test('月破与日破：辰爻逢戌月为月破；子爻逢午日且休囚死为日破（旺相则暗动）', () => {
	const r = computeLiuyao({ nums: [7, 7, 7, 7, 7, 7], date: '2026-10-23' }); // 戌月、午日
	assert.equal(r.lines[2].chong, '月破', '甲辰爻逢戌月（辰戌冲）');
	assert.equal(r.lines[0].chong, '日破', '甲子爻水死于戌月、又逢午日冲 → 日破');
	assert.equal(r.lines[0].wangShuai, '死');
	assert.equal(r.lines[0].deLing, false);
});

test('旬空：日辰旬空落在爻支上要标出来（庚午日属甲子旬，空戌亥）', () => {
	const r = computeLiuyao({ nums: [7, 7, 7, 7, 7, 7], date: '2026-10-23' });
	assert.equal(r.meta.riChen.xunKong, '戌亥');
	assert.equal(r.lines[5].xunKong, true, '壬戌爻落旬空');
	assert.equal(r.lines[4].xunKong, false, '壬申爻不空');
});

// ─────────────── 动爻 / 变卦 ───────────────
test('动爻：老阴6/老阳9 翻转成变卦，变爻干支按变卦纳甲、六亲仍以本宫五行为我', () => {
	const r = computeLiuyao({ nums: [6, 7, 8, 9, 7, 8], date: '2026-10-23' });
	assert.equal(r.ben.name, '泽水困');
	assert.equal(r.bian.name, '水泽节');
	assert.deepEqual(r.moving.map((m) => m.idx), [1, 4]);
	// 初爻戊寅（木、妻财）动 → 变卦初爻丁巳（火、官鬼），寅木生巳火 = 化泄
	assert.equal(r.moving[0].ganZhi, '戊寅');
	assert.equal(r.moving[0].to, '丁巳');
	assert.equal(r.moving[0].rel, '化泄');
	// 四爻丁亥（水、子孙）动 → 变卦四爻戊申（金、兄弟），申金生亥水 = 化生（回头生）
	assert.equal(r.moving[1].to, '戊申');
	assert.equal(r.moving[1].rel, '化生（回头生）');
	// 变爻六亲仍以本宫（兑宫金）为「我」
	assert.equal(r.moving[0].toLiuqin, '官鬼');
	assert.equal(r.moving[1].toLiuqin, '兄弟');
});

test('静卦：六爻皆不动时无变卦，moving 为空', () => {
	const r = computeLiuyao({ nums: [7, 8, 7, 8, 7, 8], date: '2026-10-23' });
	assert.equal(r.bian, null);
	assert.deepEqual(r.moving, []);
	assert.ok(r.lines.every((l) => !l.moving && l.bian === null));
});

// ─────────────── 摇卦输入解析 ───────────────
test('摇卦解析：爻象数收数组与逗号串；缺爻、越界都 fail-fast（不补、不猜）', () => {
	assert.deepEqual(parseTosses({ nums: [6, 7, 8, 9, 7, 8] }).nums, [6, 7, 8, 9, 7, 8]);
	assert.deepEqual(parseTosses({ nums: '6,7,8,9,7,8' }).nums, [6, 7, 8, 9, 7, 8]);
	assert.throws(() => parseTosses({ nums: [6, 7, 8] }), /六个数|6\/7\/8\/9/);
	assert.throws(() => parseTosses({ nums: [6, 7, 8, 9, 7, 5] }), /爻象必须是/);
});

test('摇卦解析：掷币按「背=阳」——三背老阳9、两背少阳7、一背少阴8、三字老阴6', () => {
	const p = parseTosses({ mode: 'coins', coins: '背背背 背背字 背字字 字字字 背背字 字背字' });
	assert.deepEqual(p.nums, [9, 7, 8, 6, 7, 8]);
	// 1/0 记法等价于 背/字
	assert.deepEqual(parseTosses({ mode: 'coins', coins: '111110100000110010' }).nums, [9, 7, 8, 6, 7, 8]);
	assert.throws(() => parseTosses({ mode: 'coins', coins: '背背背 背背字' }), /18 个/);
});

test('摇卦元信息如实回显：tossSource 保留原始记录，让人能核对引擎读到了什么', () => {
	const r = computeLiuyao({ mode: 'coins', coins: '背背背 背背字 背字字 字字字 背背字 字背字', date: '2026-10-23' });
	assert.match(r.meta.tossSource, /掷币/);
	assert.equal(r.ben.name, '水泽节'); // 9,7,8,6,7,8 → 上坎下兑
});

// ─────────────── REST 面 ───────────────
test('六爻 REST：GET /liuyao 给六个爻象数出 200 且含本卦/世应/六爻；缺爻象 400', async () => {
	const { call, close, uncaught } = await startPanel();
	try {
		const ok = await call('/api/xuanji/liuyao?mode=numbers&nums=6,7,8,9,7,8');
		assert.equal(ok.status, 200);
		assert.equal(ok.body.ok, true);
		assert.equal(ok.body.value.ben.name, '泽水困');
		assert.equal(ok.body.value.shiYing.shi, 1);
		assert.equal(ok.body.value.lines.length, 6);

		const miss = await call('/api/xuanji/liuyao?mode=numbers');
		assert.equal(miss.status, 400);
		assert.equal(miss.body.ok, false);
		assert.match(miss.body.error.message, /六个数|爻象/);

		const coin = await call(`/api/xuanji/liuyao?mode=coins&coins=${encodeURIComponent('背背背 背背字 背字字 字字字 背背字 字背字')}`);
		assert.equal(coin.status, 200);
		assert.equal(coin.body.value.ben.name, '水泽节');
		assert.equal(uncaught.length, 0);
	} finally { close(); }
});

// ─────────────── 面板控制器 ───────────────
/** 取 bundle 内控制器（真跑 lib/client.js），并把 fetch 请求记下来。 */
function controllerWithUrls() {
	const dom = createDom();
	const urls = [];
	const loaded = loadClient(dom, BUNDLE, (url) => {
		urls.push(url);
		return Promise.resolve({ json: () => Promise.resolve({ ok: true, value: {} }) });
	});
	const ctrl = loaded.exports.__internals.createXuanjiController({ onChange: () => {} });
	return { ctrl, urls, internals: loaded.exports.__internals };
}

test('六爻控制器：摇一次多一爻（每次三枚）；重摇清空；摇满六爻才起卦', () => {
	const { ctrl, urls } = controllerWithUrls();
	const node = new El('div');
	const ta = new El('textarea'); ta.setAttribute('data-tf', 'question'); ta.value = '要不要换工作'; node.appendChild(ta);
	const toss = new El('button'); toss.setAttribute('data-action', 'liuyao-toss'); node.appendChild(toss);
	const reset = new El('button'); reset.setAttribute('data-action', 'liuyao-reset'); node.appendChild(reset);
	const submit = new El('button'); submit.setAttribute('data-action', 'liuyao-submit'); node.appendChild(submit);
	const dispose = ctrl.attach(node);

	for (let i = 0; i < 5; i += 1) toss.click();
	assert.equal(ctrl.state.liuyao.tosses.length, 5);
	assert.equal(ctrl.state.liuyao.tosses[0].length, 3, '一次摇三枚');

	// 只摇五爻就提交：fail-fast，不发请求
	submit.click();
	assert.equal(urls.length, 0, '缺一爻不成卦，不该发请求');
	assert.match(ctrl.state.liuyao.error, /六爻/);

	// 摇第六爻后再提交
	toss.click();
	assert.equal(ctrl.state.liuyao.tosses.length, 6);
	submit.click();
	assert.equal(urls.length, 1);
	assert.match(urls[0], /\/liuyao\?/);
	const coins = new URLSearchParams(urls[0].split('?')[1]).get('coins');
	assert.equal([...coins].length, 18, '六爻 × 三枚 = 18 个背/字');
	assert.ok([...coins].every((c) => c === '背' || c === '字'));
	assert.equal(new URLSearchParams(urls[0].split('?')[1]).get('question'), '要不要换工作');

	// 摇满后再点不再增加
	toss.click();
	assert.equal(ctrl.state.liuyao.tosses.length, 6);

	reset.click();
	// 不 deepEqual 空数组：tosses 建在 vm 沙箱里，跨 realm 的数组与宿主 [] 不引用相等
	assert.equal(ctrl.state.liuyao.tosses.length, 0);
	assert.equal(ctrl.state.liuyao.result, null);
	dispose();
});

// ─────────────── 视图渲染 ───────────────
/** 递归收集渲染树的文本（函数组件直接调用）。 */
function collect(node, out = []) {
	if (node == null || typeof node === 'boolean') return out;
	if (typeof node === 'string' || typeof node === 'number') { out.push(String(node)); return out; }
	if (Array.isArray(node)) { for (const c of node) collect(c, out); return out; }
	if (typeof node === 'object') {
		if (typeof node.type === 'function') { collect(node.type(node.props ?? {}), out); return out; }
		if (node.props?.children !== undefined) collect(node.props.children, out);
	}
	return out;
}
const textOf = (node) => collect(node).join(' ');

test('六爻页：摇卦盘列出六爻位并有「摇第 N 爻」；未摇满时不显示结果', () => {
	const { internals } = controllerWithUrls();
	const t = textOf(internals.LiuyaoView({ state: { liuyao: { question: '', tosses: [], loading: false, error: null, result: null } } }));
	for (const name of ['上爻', '五爻', '四爻', '三爻', '二爻', '初爻']) {
		assert.ok(t.includes(name), `摇卦盘应有 ${name}`);
	}
	assert.match(t, /摇第 1 爻/);
	assert.ok(t.includes('待摇'));
});

test('六爻页：结果区渲染本卦/世应/纳甲/六亲/六神/变卦，不出现占位横线', () => {
	const { internals } = controllerWithUrls();
	const result = computeLiuyao({ nums: [6, 7, 8, 9, 7, 8], date: '2026-10-23', question: '要不要换工作' });
	const t = textOf(internals.LiuyaoView({ state: { liuyao: { question: '要不要换工作', tosses: [], loading: false, error: null, result } } }));
	assert.ok(t.includes('泽水困'), '本卦名');
	assert.ok(t.includes('世爻'), '世应行');
	assert.ok(t.includes('戊寅') && t.includes('丁亥'), '纳甲干支');
	assert.ok(t.includes('妻财') && t.includes('子孙'), '六亲');
	assert.ok(t.includes('白虎') && t.includes('腾蛇'), '六神');
	assert.ok(t.includes('水泽节'), '变卦名');
	assert.ok(t.includes('化泄') && t.includes('化生'), '动爻回头生克');
	assert.ok(t.includes('月建') && t.includes('日辰'), '天时');
	// 逐爻对账：六个爻的纳甲、六亲、六神、旺衰都要真渲染出来，不许留占位
	for (const l of result.lines) {
		assert.ok(t.includes(l.ganZhi), `六爻表应渲染 ${l.ganZhi}`);
		assert.ok(t.includes(l.liuqin), `六爻表应渲染六亲 ${l.liuqin}`);
		assert.ok(t.includes(l.liushen), `六爻表应渲染六神 ${l.liushen}`);
		assert.ok(t.includes(l.wangShuai), `六爻表应渲染旺衰 ${l.wangShuai}`);
	}
});
