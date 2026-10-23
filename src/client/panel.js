// src/client/panel.js — 右侧栏「玄机阁」面板外壳：品牌头 + 十页导航 + 视图容器。
//
// 状态机与业务校验仍放在 createXuanjiController（headless 可直测，不必渲染 React）；
// 这个文件负责「看起来像正经产品」的那一层：导航奏GRAPH、疑问 forms、交流与析木 HEADER。
//
// 交互走 `data-action` + 容器级**原生** click 代理——宿主环境里 React 合成事件不可靠
// （这也是全篇不写 onClick 的原因）。视图是纯渲染（views/*），状态改动手动 notify()。
import { h, useState, useRef, useEffect } from './react.js';
import { apiFetch } from './api.js';
import { PANEL_ATTR, ensureStyles } from './css.js';
import { TrendView } from './views/trend-view.js';
import { TarotView } from './views/tarot-view.js';
import { BaziView } from './views/bazi-view.js';
import { AlmanacView } from './views/almanac-view.js';
import { QuickView } from './views/quick-view.js';
import { ChengguView } from './views/chenggu-view.js';
import { QimenView } from './views/qimen-view.js';
import { FengshuiView } from './views/fengshui-view.js';
import { MatchView } from './views/match-view.js';
import { LiuyaoView } from './views/liuyao-view.js';

export { PANEL_ATTR };

/**
 * 面板全部视图：导航顺序即展示顺序。
 * 第三项是品牌字形（衬线体渲染的单字，比 emoji 稳，也比像素符号更有东方质感）。
 */
export const VIEWS = [
	['trend', 'K线', '線'],
	['bazi', '八字', '柱'],
	['almanac', '黄历', '曆'],
	['quick', '快占', '卜'],
	['chenggu', '称骨', '秤'],
	['tarot', '塔罗', '牌'],
	['qimen', '奇门', '门'],
	['fengshui', '风水', '宅'],
	['match', '合婚', '合'],
	['liuyao', '六爻', '爻'],
];

/** 初始状态。 */
export function initialState() {
	return {
		view: 'trend',
		trend: { form: null, loading: false, error: null, result: null },
		tarot: { mode: 'daily', question: '', loading: false, error: null, result: null, flipped: new Set() },
		bazi: { form: null, loading: false, error: null, result: null },
		almanac: { form: null, date: '', loading: false, error: null, result: null },
		quick: { kind: 'xiaoliuren', question: '', num1: '', num2: '', num3: '', loading: false, error: null, result: null },
		chenggu: { form: null, loading: false, error: null, result: null },
		qimen: { form: null, loading: false, error: null, result: null },
		fengshui: { form: null, fyForm: null, loading: false, fyLoading: false, error: null, fyError: null, result: null, fyResult: null },
		match: { form: null, loading: false, error: null, result: null },
		// 六爻：tosses 是六次摇币记录（每次三枚，true=背=阳面），只在用户点击时产生。
		liuyao: { question: '', tosses: [], loading: false, error: null, result: null },
	};
}

/**
 * 面板控制器：状态放闭包对象、改完手动 notify()——headless 测试可直测，不必渲染 React。
 * @param {{ onChange?:Function }} opts
 */
export function createXuanjiController({ onChange = () => {} } = {}) {
	const state = initialState();
	const notify = () => {
		try { onChange(); } catch (error) { console.error('[dsh-xuanji] 面板重渲染失败：', error); }
	};

	/** 把错误落到「当前这一页」，而不是某个写死的 key。 */
	const failTo = (key, error) => {
		const msg = String(error?.message ?? error);
		if (state[key]) state[key] = { ...state[key], loading: false, error: msg };
		notify();
	};

	/**
	 * 从容器里读输入件当前值。
	 * 非受控 input 直接读 value；分段控件（o-seg）读 data-value，再写回隐藏 input，
	 * 这样点击代理之外的代码（如下次渲染）拿到的也是同一份值。
	 */
	const readInputs = (node) => {
		const out = {};
		if (!node) return out;
		for (const el of node.querySelectorAll('[data-tf]')) {
			// 复选框没有「值」：checked 才是用户意图（value 恒为 'on'，读它等于永远勾选）。
			// 类型两种读法都试：真 DOM 是 el.type，headless 替身里只有 attribute。
			const isCheck = el.type === 'checkbox' || el.getAttribute('type') === 'checkbox';
			out[el.getAttribute('data-tf')] = isCheck
				? (el.checked ? '1' : '')
				: String(el.value ?? '').trim();
		}
		for (const seg of node.querySelectorAll('.o-seg[data-seg]')) {
			const key = seg.getAttribute('data-seg');
			const hidden = seg.querySelector('input[data-tf]');
			if (hidden) out[key] = seg.getAttribute('data-value') ?? hidden.value;
		}
		return out;
	};

	/**
	 * 把分段控件（CSS 类 driven 的选中态）同步到 DOM：更新各按钮 aria-pressed，
	 * 并把当前值写回隐藏 input——读表单走同一套 [data-tf] 查询，不需要第二套约定。
	 */
	const syncSegs = (node) => {
		for (const seg of node.querySelectorAll('.o-seg[data-seg]')) {
			if (seg.getAttribute('data-disabled') === '1') continue;
			const current = seg.getAttribute('data-value');
			for (const btn of seg.querySelectorAll('.o-seg-item')) {
				btn.setAttribute('aria-pressed', btn.getAttribute('data-seg-value') === current ? 'true' : 'false');
			}
			const hidden = seg.querySelector('input[data-tf]');
			if (hidden) hidden.value = current ?? '';
		}
	};

	const buildTrendQuery = (f) => {
		// 空串必须当缺省：Number('') === 0 会把「没填」变成「0 年 0 月 0 日」
		const toInt = (s) => (s === '' ? null : Number(s));
		const year = toInt(f.year);
		const month = toInt(f.month);
		const day = toInt(f.day);
		if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
			throw new Error('请先填出生年月日（数字）——缺输入不猜，这是玄机阁的纪律。');
		}
		const gender = f.gender === 'female' ? 'female' : f.gender === 'male' ? 'male' : null;
		if (!gender) throw new Error('性别必须选 男 或 女（大运顺逆由性别决定）。');
		let hour = null;
		// 用 ?? ''：readInputs 只在 DOM 里真有该控件时才产出 key，
		// 缺控件时 f.hour 是 undefined，而 undefined !== '' ——会把「没这个字段」当成「填了错值」。
		if ((f.hour ?? '') !== '') {
			hour = Number(f.hour);
			if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error('时辰请填 0–23 的整数；不知道时辰就留空（会按未知时辰排盘并如实标注）。');
		}
		let toAge = 100;
		if (f.toAge !== '') {
			toAge = Number(f.toAge);
			if (!Number.isInteger(toAge) || toAge < 10 || toAge > 100) throw new Error('「画到几岁」请填 10–100 的整数。');
		}
		const q = new URLSearchParams({ year: String(year), month: String(month), day: String(day), gender });
		if (hour !== null) q.set('hour', String(hour));
		q.set('toAge', String(toAge));
		return `/trend?${q.toString()}`;
	};

	const doTrend = async (node) => {
		const f = readInputs(node);
		state.trend = { ...state.trend, form: f, loading: true, error: null };
		notify();
		try {
			const result = await apiFetch(buildTrendQuery(f));
			state.trend = { ...state.trend, loading: false, result };
		} catch (error) {
			failTo('trend', error);
			return;
		}
		notify();
	};

	const doTarot = async (node) => {
		const f = readInputs(node);
		const mode = f.mode === 'three' ? 'three' : 'daily';
		const question = f.question ?? '';
		if (mode === 'three' && !question) {
			state.tarot = { ...state.tarot, mode, question, error: '三牌阵要先问清所问何事——在输入框写一句再抽。' };
			notify();
			return;
		}
		state.tarot = { ...state.tarot, mode, question, loading: true, error: null, flipped: new Set(), result: null };
		notify();
		try {
			const q = new URLSearchParams({ mode });
			if (question) q.set('question', question);
			const result = await apiFetch(`/tarot?${q.toString()}`);
			state.tarot = { ...state.tarot, loading: false, result };
		} catch (error) {
			failTo('tarot', error);
			return;
		}
		notify();
	};

	/** 公共提交形态：读表单 → loading → fetch → 落地/报错。query 必须已含全部校验。 */
	const runView = async (node, key, buildQuery, before = null) => {
		state[key] = { ...state[key], loading: true, error: null };
		notify();
		try {
			if (before) before();
			const result = await apiFetch(buildQuery());
			state[key] = { ...state[key], loading: false, result };
		} catch (error) {
			failTo(key, error);
			return;
		}
		notify();
	};

	/** 出生三件套校验（bazi/chenggu 共用）：缺输入不猜——玄机阁纪律在面板上同样生效。 */
	const birthTriple = (f) => {
		const toInt = (s) => (s === '' ? null : Number(s));
		const year = toInt(f.year);
		const month = toInt(f.month);
		const day = toInt(f.day);
		if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
			throw new Error('请先填出生年月日（数字）——缺输入不猜，这是玄机阁的纪律。');
		}
		const q = new URLSearchParams({ year: String(year), month: String(month), day: String(day) });
		// 历法必须带上：农历生日按公历排盘会整整差一个月柱，而且不报错、不崩溃，
		// 用户会拿着一个看着很专业的错盘走人——这是比崩溃更难发现的失败。
		if (f.calendar === 'lunar') {
			q.set('calendar', 'lunar');
			if (f.isLeapMonth === '1') q.set('isLeapMonth', '1');
		}
		return q;
	};

	const buildBaziQuery = (f) => {
		const q = birthTriple(f);
		const gender = f.gender === 'female' ? 'female' : f.gender === 'male' ? 'male' : null;
		if (!gender) throw new Error('性别必须选 男 或 女（十神与大运顺逆由性别/日主决定）。');
		q.set('gender', gender);
		if ((f.hour ?? '') !== '') {
			const hour = Number(f.hour);
			if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error('时辰请填 0–23 的整数；不知道时辰就留空（会按未知时辰排盘并如实标注）。');
			q.set('hour', String(hour));
		}
		if (f.city) q.set('city', f.city);
		return `/bazi?${q.toString()}`;
	};

	const buildAlmanacQuery = (f) => {
		const date = f.date ?? '';
		if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('日期格式请用 YYYY-MM-DD，例如 2026-10-22（农历同样按年-月-日填）。');
		const q = new URLSearchParams();
		if (date) q.set('date', date);
		// 农历查询（「七月初七」这种问法）必须带历法，否则会被当成公历查成另一天
		if (f.calendar === 'lunar') {
			q.set('calendar', 'lunar');
			if (f.isLeapMonth === '1') q.set('isLeapMonth', '1');
		}
		const qs = q.toString();
		return `/almanac${qs ? `?${qs}` : ''}`;
	};

	const buildQuickQuery = (f) => {
		const kind = f.kind === 'meihua' ? 'meihua' : 'xiaoliuren';
		const question = f.question ?? '';
		const need = kind === 'xiaoliuren' ? 3 : 2;
		const nums = [f.num1 ?? '', f.num2 ?? '', f.num3 ?? ''].slice(0, need);
		if (nums.some((s) => s === '')) {
			throw new Error(kind === 'xiaoliuren'
				? '小六壬要随口报三个数（1–99）——报数是起课的一部分，别替用户编。'
				: '梅花报数要随口报两个正整数——前数上卦、后数下卦，别替用户编。');
		}
		const parsed = nums.map((s) => Number(s));
		if (parsed.some((n) => !Number.isInteger(n) || n < 1 || n > 99)) {
			throw new Error('报数请填 1–99 的正整数（随口报的数才有卦气，别填 0 或小数）。');
		}
		const q = new URLSearchParams({ num1: String(parsed[0]), num2: String(parsed[1]) });
		if (kind === 'xiaoliuren') q.set('num3', String(parsed[2]));
		if (question) q.set('question', question);
		return `/${kind === 'xiaoliuren' ? 'xiaoliuren' : 'meihua'}?${q.toString()}`;
	};

	const buildChengguQuery = (f) => {
		const q = birthTriple(f);
		if (!f.hourZhi) throw new Error('称骨必填时辰（十二时辰下拉选一个）——缺时辰四柱骨重不可算。');
		q.set('hourZhi', f.hourZhi);
		return `/chenggu?${q.toString()}`;
	};

	/** 时辰下拉（子…亥）→ 0–23 钟面小时（子=23，与引擎 hourToZhi 同口径：(h+1)%24 整 2）。 */
	const hourZhiToHour = (zhi) => {
		const ZHIS = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
		const i = ZHIS.indexOf(zhi);
		if (i < 0) throw new Error('时辰请从下拉里选一个（子丑寅卯…）——别手打，选错一个时辰盘就变。');
		const h = i * 2 + 23;
		return h >= 24 ? h - 24 : h;
	};

	const buildQimenQuery = (f) => {
		const q = birthTriple(f);
		if (!f.hourZhi) throw new Error('奇门必填时辰——缺时干整盘不可排，这是这一页唯一不能代填的输入。');
		q.set('hourZhi', f.hourZhi);
		return `/qimen?${q.toString()}`;
	};

	const buildFengshuiQuery = (f) => {
		const q = birthTriple(f);
		const gender = f.gender === 'female' ? 'female' : f.gender === 'male' ? 'male' : null;
		if (!gender) throw new Error('性别必须选 男 或 女——男女命卦算法不同，缺省不猜。');
		q.set('gender', gender);
		return `/fengshui?${q.toString()}`;
	};

	const buildFengshuiFlyQuery = (f) => {
		const fy = (f.fyYear ?? '').trim();
		const q = new URLSearchParams();
		if (fy !== '') {
			const n = Number(fy);
			if (!Number.isInteger(n) || n < 1900 || n > 2100) throw new Error('流年请填 1900–2100 的整数。');
			q.set('fyYear', String(n));
		}
		return `/fengshui${q.toString() ? `?${q.toString()}` : ''}`;
	};

	const buildMatchQuery = (f) => {
		const readSide = (prefix) => {
			const toInt = (s) => (s === '' || s === undefined ? null : Number(s));
			const year = toInt(f[`${prefix}_year`]);
			const month = toInt(f[`${prefix}_month`]);
			const day = toInt(f[`${prefix}_day`]);
			if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
				throw new Error(`${prefix === 'a' ? '甲' : '乙'}方出生年月日必填（数字）——缺输入不猜。`);
			}
			const q = new URLSearchParams();
			q.set(`${prefix}Year`, String(year));
			q.set(`${prefix}Month`, String(month));
			q.set(`${prefix}Day`, String(day));
			if (f[`${prefix}_calendar`] === 'lunar') {
				q.set(`${prefix}Calendar`, 'lunar');
				if (f[`${prefix}_isLeapMonth`] === '1') q.set(`${prefix}IsLeapMonth`, '1');
			}
			if (f[`${prefix}_hourZhi`]) q.set(`${prefix}HourZhi`, f[`${prefix}_hourZhi`]);
			if (f[`${prefix}_label`]?.trim()) q.set(`${prefix}Label`, f[`${prefix}_label`].trim());
			return q;
		};
		const qa = readSide('a');
		const qb = readSide('b');
		const params = new URLSearchParams();
		for (const [k, v] of qa) params.append(k, v);
		for (const [k, v] of qb) params.append(k, v);
		return `/match?${params.toString()}`;
	};

	const doBazi = (node) => {
		const f = readInputs(node);
		state.bazi = { ...state.bazi, form: f };
		return runView(node, 'bazi', () => buildBaziQuery(f));
	};
	const doAlmanac = (node) => {
		const f = readInputs(node);
		state.almanac = { ...state.almanac, form: f, date: f.date ?? '' };
		return runView(node, 'almanac', () => buildAlmanacQuery(f));
	};
	const doQuick = (node) => {
		const f = readInputs(node);
		state.quick = { ...state.quick, kind: f.kind === 'meihua' ? 'meihua' : 'xiaoliuren', question: f.question ?? '', num1: f.num1 ?? '', num2: f.num2 ?? '', num3: f.num3 ?? '' };
		return runView(node, 'quick', () => buildQuickQuery(f));
	};
	const doChenggu = (node) => {
		const f = readInputs(node);
		state.chenggu = { ...state.chenggu, form: f };
		return runView(node, 'chenggu', () => buildChengguQuery(f));
	};

	const doQimen = (node) => {
		const f = readInputs(node);
		state.qimen = { ...state.qimen, form: f };
		return runView(node, 'qimen', () => buildQimenQuery(f));
	};

	const doFengshui = (node) => {
		const f = readInputs(node);
		state.fengshui = { ...state.fengshui, form: f };
		const view = state.fengshui;
		state.fengshui = { ...view, loading: true, error: null };
		notify();
		return apiFetch(buildFengshuiQuery(f)).then((result) => {
			state.fengshui = { ...state.fengshui, loading: false, result };
			notify();
		}, (error) => {
			const msg = String(error?.message ?? error);
			state.fengshui = { ...state.fengshui, loading: false, error: msg };
			notify();
		});
	};

	const doFengshuiFly = (node) => {
		const f = readInputs(node);
		state.fengshui = { ...state.fengshui, fyForm: f };
		const view = state.fengshui;
		state.fengshui = { ...view, fyLoading: true, fyError: null };
		notify();
		return apiFetch(buildFengshuiFlyQuery(f)).then((result) => {
			state.fengshui = { ...state.fengshui, fyLoading: false, fyResult: result };
			notify();
		}, (error) => {
			const msg = String(error?.message ?? error);
			state.fengshui = { ...state.fengshui, fyLoading: false, fyError: msg };
			notify();
		});
	};

	const doMatch = (node) => {
		const f = readInputs(node);
		state.match = { ...state.match, form: f };
		return runView(node, 'match', () => buildMatchQuery(f));
	};

	/**
	 * 摇一爻：三枚铜钱的正反由用户这次点击产生（与传统掷币同义）。
	 * 只有这一步是随机的——成卦之后的卦象、纳甲、六亲、六神、旺衰仍是确定性计算。
	 * 引擎从不代摇：面板不预填、不补爻，少一爻就起不了卦。
	 */
	const doLiuyaoToss = () => {
		const tosses = state.liuyao.tosses ?? [];
		if (tosses.length >= 6) return;
		const toss = Array.from({ length: 3 }, () => Math.random() < 0.5);
		state.liuyao = { ...state.liuyao, tosses: [...tosses, toss], error: null };
		notify();
	};

	/** 重摇：清空六爻与结果，保留已写的问题。 */
	const doLiuyaoReset = () => {
		state.liuyao = { ...state.liuyao, tosses: [], loading: false, error: null, result: null };
		notify();
	};

	/** 六爻查询串：把六次摇币压平成 18 个「背/字」交给引擎。 */
	const buildLiuyaoQuery = () => {
		const tosses = state.liuyao.tosses ?? [];
		if (tosses.length !== 6) {
			throw new Error(`摇卦要正好六爻（当前 ${tosses.length} 爻）——先摇满六次再起卦，少一爻不成卦，也不替你补。`);
		}
		const coins = tosses.flat().map((isBack) => (isBack ? '背' : '字')).join('');
		const q = new URLSearchParams({ mode: 'coins', coins });
		const question = (state.liuyao.question ?? '').trim();
		if (question) q.set('question', question);
		return `/liuyao?${q.toString()}`;
	};

	const doLiuyaoSubmit = (node) => {
		const f = readInputs(node);
		// 问题写在 textarea 里（非受控），提交时读一次进 state，查询串与重渲染都用它。
		state.liuyao = { ...state.liuyao, question: f.question ?? '' };
		return runView(node, 'liuyao', buildLiuyaoQuery);
	};

	/** 事件代理：容器上原生 click，按 data-action 分发。返回 disposer。 */
	const attach = (node) => {
		const onClick = (event) => {
			const target = event.target?.closest?.('[data-action]');
			if (target && node.contains(target)) {
				const action = target.getAttribute('data-action');
				try {
					if (action === 'switch-view') {
						const requested = target.getAttribute('data-view');
						const known = VIEWS.some(([id]) => id === requested);
						state.view = known ? requested : 'trend';
						notify();
						// 黄历页首次进入自动查今天（缺省日期 = 服务端今天口径）
						if (state.view === 'almanac' && !state.almanac.result && !state.almanac.loading) {
							void doAlmanac(node);
						}
						return;
					}
					if (action === 'trend-submit') { void doTrend(node); return; }
					if (action === 'bazi-submit') { void doBazi(node); return; }
					if (action === 'almanac-submit') { void doAlmanac(node); return; }
					if (action === 'quick-cast') { void doQuick(node); return; }
					if (action === 'chenggu-submit') { void doChenggu(node); return; }
					if (action === 'qimen-submit') { void doQimen(node); return; }
					if (action === 'fengshui-submit') { void doFengshui(node); return; }
					if (action === 'fengshui-fly-submit') { void doFengshuiFly(node); return; }
					if (action === 'match-submit') { void doMatch(node); return; }
					if (action === 'liuyao-toss') { doLiuyaoToss(); return; }
					if (action === 'liuyao-reset') { doLiuyaoReset(); return; }
					if (action === 'liuyao-submit') { void doLiuyaoSubmit(node); return; }
					if (action === 'tarot-draw') { void doTarot(node); return; }
					if (action === 'card-flip') {
						const ci = Number(target.getAttribute('data-ci'));
						const flipped = new Set(state.tarot.flipped);
						if (flipped.has(ci)) flipped.delete(ci); else flipped.add(ci);
						state.tarot = { ...state.tarot, flipped };
						notify();
						return;
					}
				} catch (error) {
					// 【C5】表单校验错误必须落在**当前这一页**。
					// 早先无条件写进 state.trend.error，导致在快占页报错时，
					// 快占页停在「本地排盘中…」、报错要到 K 线页才看得见。
					failTo(state.view, error);
					return;
				}
			}
			// 分段控件：单独的委托分支（点的是 button 而不是 [data-action]）
			const segBtn = event.target?.closest?.('.o-seg-item');
			if (segBtn && node.contains(segBtn)) {
				// 只按 [data-seg] 找容器：'.o-seg[data-seg]' 这种复合选择器在
				// headless 测试替身里匹配不到（替身只实现了单类/单属性选择器）。
				const seg = segBtn.closest('[data-seg]');
				if (!seg || seg.getAttribute('data-disabled') === '1') return;
				const key = seg.getAttribute('data-seg');
				seg.setAttribute('data-value', segBtn.getAttribute('data-seg-value'));
			syncSegs(node);
			// 把选择回写进当前页的表单快照：视图是纯渲染，读不到 DOM 里的当前选择，
			// 而「闰月勾选」只在历法=农历时出现——不回写的话，切到农历也长不出那个勾。
			const cur = state[state.view];
			if (cur) cur.form = { ...(cur.form ?? {}), [key]: seg.getAttribute('data-value') };
			notify();
			}
		};
		node.addEventListener('click', onClick);
		return () => node.removeEventListener('click', onClick);
	};

	return { state, notify, attach };
}

/** 头部副题：当前在哪一页。 */
const SUBTITLES = {
	trend: '人生K线 · 大运流年确定性计分',
	bazi: '八字排盘 · 四柱神煞刑冲合会',
	almanac: '每日黄历 · 宜忌方位与每日一卦',
	quick: '快占 · 小六壬掐指 / 梅花报数',
	chenggu: '袁天罡称骨 · 骨重四柱与批语',
	tarot: '塔罗 · 每日一牌 / 三牌阵',
	qimen: '奇门遁甲 · 时家转盘九宫星门',
	fengshui: '八宅命卦 · 四吉四凶与流年飞星',
	match: '八字合婚 · 属相十神与跨盘合会',
	liuyao: '六爻纳甲 · 摇卦成卦与动爻变卦',
};
function panelSubtitle(view) {
	return SUBTITLES[view] ?? SUBTITLES.trend;
}

/**
 * 右侧栏面板组件（slot 框架渲染它）。
 */
export function XuanjiPanel() {
	const [, forceTick] = useState(0);
	const controllerRef = useRef(null);
	const nodeRef = useRef(null);

	if (controllerRef.current === null) {
		controllerRef.current = createXuanjiController({ onChange: () => forceTick((n) => n + 1) });
	}
	const controller = controllerRef.current;

	useEffect(() => {
		ensureStyles();
		const node = nodeRef.current;
		let dispose = null;
		if (node) dispose = controller.attach(node);
		return () => { if (dispose) dispose(); };
	}, []);

	const s = controller.state;

	// ── 品牌头 ──
	const header = h('div', { className: 'o-brand' },
		h('div', { className: 'o-brand-mark' }, '☯'),
		h('div', { className: 'o-brand-text' },
			h('div', { className: 'o-brand-name' },
				h('span', null, '玄机阁'),
				h('span', { className: 'o-chip' }, 'v' + (typeof window !== 'undefined' && window.__DSH_XUANJI_VERSION__ ? window.__DSH_XUANJI_VERSION__ : '?')),
			),
			h('div', { className: 'o-brand-sub' }, panelSubtitle(s.view)),
		),
	);

	// ── 六页导航 ──
	const nav = h('div', { className: 'o-nav', role: 'tablist' },
		VIEWS.map(([id, label, glyph]) => h('button', {
			key: id,
			className: 'o-tab',
			role: 'tab',
			'aria-selected': s.view === id ? 'true' : 'false',
			'data-action': 'switch-view',
			'data-view': id,
			'data-xuanji-btn': '1',
		},
			h('span', { className: 'o-tab-glyph' }, glyph),
			h('span', { className: 'o-tab-label' }, label),
		)),
	);

	return h('div', { [PANEL_ATTR]: '1', className: 'o-root', ref: nodeRef },
		header,
		nav,
		h('div', { style: { flex: '1 1 auto', minHeight: 0 } },
			s.view === 'trend' ? h(TrendView, { state: s }) : null,
			s.view === 'bazi' ? h(BaziView, { state: s }) : null,
			s.view === 'almanac' ? h(AlmanacView, { state: s }) : null,
			s.view === 'quick' ? h(QuickView, { state: s }) : null,
			s.view === 'chenggu' ? h(ChengguView, { state: s }) : null,
			s.view === 'tarot' ? h(TarotView, { state: s }) : null,
			s.view === 'qimen' ? h(QimenView, { state: s }) : null,
			s.view === 'fengshui' ? h(FengshuiView, { state: s }) : null,
			s.view === 'match' ? h(MatchView, { state: s }) : null,
			s.view === 'liuyao' ? h(LiuyaoView, { state: s }) : null,
		),
	);
}
