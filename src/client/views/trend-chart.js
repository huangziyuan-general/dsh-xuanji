// src/client/views/trend-chart.js — 人生K线 SVG 蜡烛图：纯数据 spec + 渲染分离。
//
// spec 是与框架无关的纯数据（测试直测），renderTrendSvg(spec, h) 才碰 React。
// 中国市场配色惯例：收阳（close≥open）红、收阴绿。每年一支蜡烛，自带 <title> 悬停提示。
//
// 视觉：大运分段交替底色 + 5/10 年移动均线 + 50 分中位参考线 + 极值点位引出标注。
// 目的不是花哨，是让「哪一步大运走高、哪一段在谷底」一眼可读——这才是这张图存在的意义。

const W = 340;
const H = 210;
const PAD_L = 26;
const PAD_R = 10;
const PAD_T = 16;
const PAD_B = 22;
const UP_COLOR = '#e0645c';
const DOWN_COLOR = '#4fa877';
const MA5_COLOR = '#d9b26a';
const MA10_COLOR = '#6ea8dc';
// 图表内部颜色用固定值而不是 CSS 变量：React 把 stroke/fill 写成 SVG presentation
// attribute，属性值里的 var() 不会被解析，整张图会静默退化成不可见（实测踩过）。
// 中性灰在深浅两套宿主主题下都可读，这正是图表配色的常规做法。
const AXIS_COLOR = '#888780';
const GRID_SUB = 'rgba(136,135,128,.45)';
const TEXT_COLOR = '#8b91a0';
const SEG_LINE = 'rgba(136,135,128,.5)';
const UP_FILL_TOP = 'rgba(224,100,92,.16)';
const DOWN_FILL_TOP = 'rgba(79,168,119,.16)';

const clamp01 = (v) => Math.max(0, Math.min(100, v));
const yOf = (v) => PAD_T + ((100 - clamp01(v)) * (H - PAD_T - PAD_B)) / 100;

/** 简单移动平均：窗口不足时返回 null（图上不画，而不是拿残缺数据误导）。 */
function movingAverage(values, win) {
	return values.map((_, i) => (i + 1 < win ? null : values.slice(i + 1 - win, i + 1).reduce((a, b) => a + b, 0) / win));
}

/** 把一串 y 平滑成 SVG path 的 d（跳过 null 段）。 */
function pathOf(ys, xOf) {
	let d = '';
	let pen = false;
	for (let i = 0; i < ys.length; i++) {
		const y = ys[i];
		if (y === null || y === undefined) { pen = false; continue; }
		d += `${pen ? 'L' : 'M'}${xOf(i).toFixed(2)} ${yOf(y).toFixed(2)}`;
		pen = true;
	}
	return d || null;
}

/**
 * 由引擎 points 生成图 spec（确定性）。
 * @param {Array<{age:number,kline:{open,close,high,low},ganZhi:string,score:number,year:number}>} points
 * @param {Array<{ganZhi:string,startAge:number,endAge:number}>} segments 大运分段（画分隔线与底色）
 */
export function buildTrendSpec(points, segments = []) {
	if (!Array.isArray(points) || points.length === 0) return null;
	const innerW = W - PAD_L - PAD_R;
	const step = innerW / points.length;
	const xOf = (i) => PAD_L + (i + 0.5) * step;

	const candles = points.map((p, i) => {
		const { open, close, high, low } = p.kline;
		const up = close >= open;
		const yO = yOf(open);
		const yC = yOf(close);
		return {
			x: +xOf(i).toFixed(2),
			up,
			score: p.score,
			wick: { y1: +yOf(high).toFixed(2), y2: +yOf(low).toFixed(2) },
			body: { y: +Math.min(yO, yC).toFixed(2), h: +Math.max(1.2, Math.abs(yO - yC)).toFixed(2) },
			title: `${p.age}岁（${p.year}，${p.ganZhi}）：${p.score}分${p.dayunGanZhi ? ` · 大运${p.dayunGanZhi}` : ''}`,
		};
	});

	// 大运分段：竖线 + 交替底色，让「哪步运对应哪一段」有横向节奏感
	const segLines = [];
	const segBands = [];
	for (const s of segments) {
		const startIdx = points.findIndex((p) => p.age === s.startAge);
		if (startIdx === -1) continue;
		const endIdx = points.findIndex((p) => p.age === s.endAge);
		const to = endIdx === -1 ? points.length - 1 : endIdx;
		if (startIdx > 0) segLines.push({ x: +(xOf(startIdx - 0.5)).toFixed(2), label: s.ganZhi });
		segBands.push({ x0: +(xOf(startIdx - 0.5)).toFixed(2), x1: +(xOf(to + 0.5)).toFixed(2), label: s.ganZhi });
	}

	// 极值：整段最高/最低，引出圆点标记，避免用户在密密麻麻的蜡烛里找
	const hi = points.reduce((a, p) => (p.score > a.score ? p : a), points[0]);
	const lo = points.reduce((a, p) => (p.score < a.score ? p : a), points[0]);
	const hiIdx = points.indexOf(hi);
	const loIdx = points.indexOf(lo);

	const scores = points.map((p) => p.score);
	const marks = [0, Math.floor(points.length / 2), points.length - 1].filter((v, i, a) => a.indexOf(v) === i);

	return {
		w: W,
		h: H,
		padL: PAD_L,
		padB: PAD_B,
		candles,
		// `segs` 是既有契约名（面板与测试都读它），新增的 segBands 是分段底色。
		segs: segLines,
		segLines,
		segBands,
		xLabels: marks.map((i) => ({ x: +xOf(i).toFixed(2), text: `${points[i].age}岁` })),
		yTicks: [0, 25, 50, 75, 100].map((v) => ({ v, y: +yOf(v).toFixed(2), major: v === 50 })),
		ma5: pathOf(movingAverage(scores, 5), xOf),
		ma10: pathOf(movingAverage(scores, 10), xOf),
		peak: { x: +xOf(hiIdx).toFixed(2), y: +yOf(hi.score).toFixed(2), label: `${hi.age}岁 ${hi.score}`, below: false },
		trough: { x: +xOf(loIdx).toFixed(2), y: +yOf(lo.score).toFixed(2), label: `${lo.age}岁 ${lo.score}`, below: true },
	};
}

/**
 * spec → SVG vnode 树。
 * @param {object} spec buildTrendSpec 的产物
 * @param {Function} h createElement
 */
export function renderTrendSvg(spec, h) {
	if (!spec) return null;
	const { w, h: hh, padL, candles, segLines, segBands, xLabels, yTicks } = spec;
	const plotW = w - padL - 10;
	const bodyW = Math.max(1.1, (plotW / candles.length) * 0.6);

	return h('svg', {
		viewBox: `0 0 ${w} ${hh}`, width: '100%', role: 'img',
		'aria-label': '人生K线蜡烛图：逐年分数与大运分段',
		style: { display: 'block', overflow: 'visible' },
	},
		h('defs', null,
			h('linearGradient', { id: 'xuanji-up', x1: '0', y1: '0', x2: '0', y2: '1' },
				h('stop', { offset: '0%', 'stop-color': UP_COLOR, 'stop-opacity': '.18' }),
				h('stop', { offset: '100%', 'stop-color': UP_COLOR, 'stop-opacity': '0' }),
			),
			h('linearGradient', { id: 'xuanji-down', x1: '0', y1: '0', x2: '0', y2: '1' },
				h('stop', { offset: '0%', 'stop-color': DOWN_COLOR, 'stop-opacity': '.18' }),
				h('stop', { offset: '100%', 'stop-color': DOWN_COLOR, 'stop-opacity': '0' }),
			),
		),
		// 大运交替底色（先画，压在最底层）
		segBands.map((b, i) => (i % 2 === 0 ? null : h('rect', {
			key: `band${i}`, x: b.x0, y: PAD_T - 4, width: Math.max(0.5, b.x1 - b.x0), height: hh - PAD_T - PAD_B + 4,
			fill: '#888780', opacity: '.06',
		}))),
		// 横向刻度网格
		yTicks.map((t) => h('g', { key: `y${t.v}` },
			h('line', {
				x1: padL, x2: w - 10, y1: t.y, y2: t.y,
				stroke: AXIS_COLOR, 'stroke-width': t.major ? 0.7 : 0.4,
				'stroke-dasharray': t.major ? '3 3' : '1 4', opacity: t.major ? 0.9 : 0.6,
			}),
			h('text', { x: padL - 3, y: t.y + 2.6, 'text-anchor': 'end', 'font-size': 6.5, fill: TEXT_COLOR }, String(t.v)),
		)),
		// 大运分隔竖线 + 段名
		segLines.map((s, i) => h('g', { key: `s${i}` },
			h('line', { x1: s.x, x2: s.x, y1: PAD_T - 4, y2: hh - PAD_B, stroke: SEG_LINE, 'stroke-width': 0.5, 'stroke-dasharray': '2 2' }),
			h('text', { x: s.x + 1.5, y: 9.5, 'font-size': 6.5, fill: '#a7adba', opacity: 0.85 }, s.label),
		)),
		// 蜡烛：影线 + 实体
		candles.map((c, i) => h('g', { key: `c${i}` },
			h('title', null, c.title),
			h('line', { x1: c.x, x2: c.x, y1: c.wick.y1, y2: c.wick.y2, stroke: c.up ? UP_COLOR : DOWN_COLOR, 'stroke-width': 0.7, opacity: 0.85 }),
			h('rect', {
				x: +(c.x - bodyW / 2).toFixed(2), y: c.body.y, width: +bodyW.toFixed(2), height: c.body.h,
				fill: c.up ? UP_COLOR : DOWN_COLOR, opacity: 0.92, rx: 0.4,
			}),
		)),
		// 均线
		spec.ma10 ? h('path', { d: spec.ma10, fill: 'none', stroke: MA10_COLOR, 'stroke-width': 0.9, 'stroke-linejoin': 'round', opacity: 0.8 }) : null,
		spec.ma5 ? h('path', { d: spec.ma5, fill: 'none', stroke: MA5_COLOR, 'stroke-width': 1.1, 'stroke-linejoin': 'round' }) : null,
		// 极值引出标记
		[
			[pit(spec.peak), UP_COLOR, -6],
			[pit(spec.trough), DOWN_COLOR, 12],
		].map(([p, color, dy], i) => (p ? h('g', { key: `pk${i}` },
			h('circle', { cx: p.x, cy: p.y, r: 1.9, fill: color }),
			h('circle', { cx: p.x, cy: p.y, r: 3.6, fill: 'none', stroke: color, 'stroke-width': 0.5, opacity: 0.55 }),
			h('text', {
				x: Math.min(Math.max(p.x, padL + 12), w - 22), y: p.y + dy,
				'text-anchor': 'middle', 'font-size': 6.8, fill: color, fontWeight: '500',
			}, p.label),
		) : null)),
		// 年龄刻度
		xLabels.map((l, i) => h('text', {
			key: `x${i}`, x: l.x, y: hh - 7, 'text-anchor': 'middle', 'font-size': 6.5, fill: TEXT_COLOR,
		}, l.text)),
	);
}

/** peak/trough 取值容错（旧 spec 可能没有这两个字段）。 */
function pit(p) {
	return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null;
}
