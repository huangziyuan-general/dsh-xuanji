// src/client/views/fengshui-view.js — 风水页：八宅命卦 + 流年九宫飞星（年家紫白）。
// 两个子表单：命卦（生辰必填）/ 飞星（只填流年，可选）。纯渲染，state 由 panel 代理读取。
import { h } from '../react.js';
import { Card, Field, Input, Select, Seg, Badge, Glyph, StatGrid, Loading, Empty, ErrorBar, Notes, FooterNote, CalendarField, calendarHint } from './ui.js';
import { WUXING_COLOR } from './ui.js';

const EIGHT_DIRS = ['正北', '东北', '正东', '东南', '正南', '西南', '正西', '西北'];

/** 风水视图。state.fengshui = { form, fyForm, loading, fyLoading, error, fyError, result, fyResult } */
export function FengshuiView({ state }) {
	const c = state.fengshui ?? {};
	const f = c.form ?? {};
	const fy = c.fyForm ?? {};
	const calendar = f.calendar === 'lunar' ? 'lunar' : 'solar';
	return h('div', null,
		h(Card, { title: '八宅命卦', tone: 'accent' },
			h('div', { className: 'o-grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(64px, 1fr))' } },
				h(Field, { label: calendar === 'lunar' ? '农历年' : '出生年' }, Input({ tf: 'year', placeholder: '1990', inputMode: 'numeric', defaultValue: f.year ?? '' })),
				h(Field, { label: '月' }, Input({ tf: 'month', placeholder: '8', inputMode: 'numeric', defaultValue: f.month ?? '' })),
				h(Field, { label: '日' }, Input({ tf: 'day', placeholder: '16', inputMode: 'numeric', defaultValue: f.day ?? '' })),
				h('div', { className: 'o-field', style: { flex: '1 1 100px' } },
					h('span', { className: 'o-label' }, '性别'),
					h(Seg, { tf: 'gender', defaultValue: f.gender ?? '', options: [['male', '男'], ['female', '女']] }),
				),
			),
			h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '9px', alignItems: 'flex-end', marginTop: '9px' } },
				CalendarField({ calendar, leap: f.isLeapMonth === '1' }),
				h('button', {
					'data-action': 'fengshui-submit', 'data-xuanji-btn': '1', 'data-variant': 'primary',
					disabled: !!c.loading,
				}, c.loading ? '推算中…' : '算命卦'),
			),
			h('div', { className: 'o-note', style: { marginTop: '7px' } }, calendar === 'lunar' ? calendarHint(calendar) : '命卦按节气年（立春界）+性别推；时辰不需要。'),
		),
		c.error ? ErrorBar({ children: c.error }) : null,
		c.loading ? Loading({ lines: 2, text: '本地推算中…' }) : null,
		!c.loading && !c.result && !c.error
			? Empty({ glyph: '宅', title: '命卦与四吉四凶方位会落在这里', hint: '八宅通行口径：东四命宜东四宅，西四命宜西四宅；吉方宜开门、主卧、灶口。' })
			: null,
		c.result ? MingGuaResult({ result: c.result }) : null,

		// ── 流年飞星（独立子表单：只填流年，缺省当前年）──
		h(Card, { title: '流年九宫飞星', tone: 'gold' },
			h('div', { style: { display: 'flex', gap: '7px', alignItems: 'flex-end' } },
				h(Field, { label: '流年（缺省今年）' },
					Input({ tf: 'fyYear', placeholder: '如 2035', inputMode: 'numeric', defaultValue: fy.fyYear ?? '' })),
				h('button', {
					'data-action': 'fengshui-fly-submit', 'data-xuanji-btn': '1',
					disabled: !!c.fyLoading,
				}, c.fyLoading ? '飞星中…' : '看飞星'),
			),
			h('div', { className: 'o-note', style: { marginTop: '7px' } }, '年家紫白：五黄落宫宜静忌动；吉星（一白六白八白九紫 + 四绿文昌）所临方可催旺。'),
		),
		c.fyError ? ErrorBar({ children: c.fyError }) : null,
		c.fyLoading ? Loading({ lines: 2, text: '本地飞星中…' }) : null,
		c.fyResult ? FlyingResult({ result: c.fyResult }) : null,

		// 玄空飞星（坐向三盘叠加 + 格局）
		XuanKongForm({ c }),
		c.xkError ? ErrorBar({ children: c.xkError }) : null,
		c.xkLoading ? Loading({ lines: 3, text: '本地玄空排盘中…' }) : null,
		c.xkResult ? XuanKongResult({ result: c.xkResult }) : null,
	);
}

/** 命卦结果：命卦大字 + 东西四 + 四吉四凶方位表。 */
function MingGuaResult({ result }) {
	const mg = result.mingGua ?? {};
	const lucky = result.luckyDirections ?? [];
	const unlucky = result.unluckyDirections ?? [];
	const wuhuang = (result.yearlyFlying?.palaces ?? []).find((p) => p.num === 5);
	const dirRow = (x, color) => h('div', {
		key: x.star,
		style: { display: 'flex', justifyContent: 'space-between', fontSize: '11.5px' },
	},
		h('span', { style: { color, fontFamily: 'var(--o-serif)' } }, x.star),
		h('span', { style: { color: 'var(--o-muted)' } }, `${x.direction}（${x.palace}宫）`),
	);
	return h('div', { className: 'o-anim-rise' },
		h(Card, { tone: 'accent', title: '命卦' },
			h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '10px' } },
				h(Glyph, { tone: 'gold' }, mg.gua ?? '—'),
				h('div', { style: { display: 'flex', flexDirection: 'column', gap: '3px' } },
					mg.group ? h(Badge, { tone: mg.group.startsWith('东') ? 'good' : 'warn' }, mg.group) : null,
					mg.direction ? h('span', { className: 'o-note' }, `卦位 ${mg.direction}`) : null,
					result.meta?.birth ? h('span', { className: 'o-note' }, `生辰 ${result.meta.birth}（节气年 ${result.meta.guaYear}）`) : null,
				),
			),
			mg.compatible ? h('div', { style: { fontSize: '11.5px', lineHeight: '1.7', color: 'var(--o-muted)', marginTop: '6px' } }, mg.compatible) : null,
		),
		h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px' } },
			h(Card, { title: '四吉方位' },
				h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
					lucky.map((x) => dirRow(x, 'var(--o-lucky)')))),
			h(Card, { title: '四凶方位' },
				h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
					unlucky.map((x) => dirRow(x, 'var(--o-danger)'))),
			),
		),
		wuhuang ? h('div', { className: 'o-note', style: { marginTop: '7px' } },
			`流年五黄在${wuhuang.direction}：当年此方宜静不宜动（忌装修、动土）。`) : null,
		Notes({ items: result.meta?.notes }),
		result.disclaimer ? FooterNote({ children: result.disclaimer }) : null,
	);
}

/** 飞星结果：九宫格（洛书方位布局）+ 吉凶星着色。 */
function FlyingResult({ result }) {
	// REST /fengshui?fyYear= 返回 { yearlyFlying: {...} }，命卦结果里内嵌的同名块是裸的——两种形状都接。
	const fy = result?.yearlyFlying ?? result ?? {};
	const palaces = fy.palaces ?? [];
	// 屏幕布局：巽(东南)-离(正南)-坤(西南) / 震(正东)-中-兑(正西) / 艮(东北)-坎(正北)-乾(西北)
	const byName = {};
	for (const p of palaces) byName[p.palace] = p;
	const GRID = [
		['巽', '离', '坤'],
		['震', null, '兑'],
		['艮', '坎', '乾'],
	];
	const luckColor = (num) => (num === 5 || num === 2 ? 'var(--o-danger)' : num === 3 || num === 7 ? 'var(--o-muted)' : 'var(--o-lucky)');
	return h('div', { className: 'o-anim-rise' },
		h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '6px' } },
			h('span', { className: 'o-note' }, `中宫 ${fy.centerName ?? ''}`),
			fy.center ? h(Badge, { tone: fy.center === 5 ? 'bad' : 'gold' }, `${fy.centerName ?? ''}入中`) : null,
		),
		h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' } },
			GRID.flatMap((row, r) => row.map((name, c) => {
				if (name === null) {
					const center = byName['中'];
					return h('div', { key: '中', style: {
						border: '1px solid var(--o-gold)', borderRadius: 'var(--o-r-sm)',
						background: 'color-mix(in srgb, var(--o-gold) 8%, var(--o-surface-2))',
						padding: '6px 4px', minHeight: '54px', textAlign: 'center',
					} },
						h('div', { style: { fontSize: '9px', color: 'var(--o-ghost)' } }, '中宫'),
						h('div', { style: { fontSize: '14px', fontFamily: 'var(--o-serif)', color: luckColor(center?.num), margin: '2px 0' } }, center ? center.name : '—'),
						center ? h('div', { style: { fontSize: '10px', color: 'var(--o-muted)' } }, center.star) : null,
					);
				}
				const p = byName[name];
				return h('div', { key: name, style: {
					border: `1px solid ${p?.lucky ? 'color-mix(in srgb, var(--o-lucky) 50%, var(--o-border))' : p && p.num === 5 ? 'color-mix(in srgb, var(--o-danger) 50%, var(--o-border))' : 'var(--o-border)'}`,
					borderRadius: 'var(--o-r-sm)',
					background: 'var(--o-surface-2)',
					padding: '6px 4px', minHeight: '54px',
				} },
					h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--o-ghost)' } },
						h('span', null, p?.direction ?? name),
						p?.lucky ? h('span', { style: { color: 'var(--o-lucky)' } }, '吉') : (p && p.num === 5 ? h('span', { style: { color: 'var(--o-danger)' } }, '五黄') : null)),
					h('div', { style: { fontSize: '14px', fontFamily: 'var(--o-serif)', margin: '2px 0', color: luckColor(p?.num) } }, p?.name ?? '—'),
					p ? h('div', { style: { fontSize: '10px', color: 'var(--o-muted)' } }, p.star) : null,
				);
			})),
		),
		h('div', { className: 'o-note', style: { marginTop: '7px' } }, '年家紫白顺飞：五黄/二黑所临方当年宜静；吉星所临方可摆放催旺物。民俗参考，不构成现场勘舆结论。'),
	);
}

/** 24 山（罗盘 360° 每山 15°）下拉选项：山名 + 度数 + 元龙阴阳。 */
const MOUNTAIN_OPTS = [
	['', '选坐山…'],
	['壬', '壬 345°·地元阳'], ['子', '子 0°·天元阴'], ['癸', '癸 15°·人元阴'],
	['丑', '丑 30°·地元阴'], ['艮', '艮 45°·天元阳'], ['寅', '寅 60°·人元阳'],
	['甲', '甲 75°·地元阳'], ['卯', '卯 90°·天元阴'], ['乙', '乙 105°·人元阴'],
	['辰', '辰 120°·地元阴'], ['巽', '巽 135°·天元阳'], ['巳', '巳 150°·人元阳'],
	['丙', '丙 165°·地元阳'], ['午', '午 180°·天元阴'], ['丁', '丁 195°·人元阴'],
	['未', '未 210°·地元阴'], ['坤', '坤 225°·天元阳'], ['申', '申 240°·人元阳'],
	['庚', '庚 255°·地元阳'], ['酉', '酉 270°·天元阴'], ['辛', '辛 285°·人元阴'],
	['戌', '戌 300°·地元阴'], ['乾', '乾 315°·天元阳'], ['亥', '亥 330°·人元阳'],
];

/** 玄空表单：坐山必填 + 向山可选（缺省按对宫推）+ 年份可选（定元运）。 */
function XuanKongForm({ c }) {
	const f = c.xkForm ?? {};
	return h(Card, { title: '玄空飞星（坐向三盘叠加）', tone: 'gold' },
		h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '7px', alignItems: 'flex-end' } },
			h('div', { className: 'o-field', style: { flex: '1 1 130px' } },
				h('span', { className: 'o-label' }, '坐山（必填）'),
				h(Select, { tf: 'xkSitting', defaultValue: f.xkSitting ?? '', options: MOUNTAIN_OPTS })),
			h('div', { className: 'o-field', style: { flex: '1 1 130px' } },
				h('span', { className: 'o-label' }, '向山（可省）'),
				h(Select, {
					tf: 'xkFacing',
					defaultValue: f.xkFacing ?? '',
					options: [['', '按对宫推'], ...MOUNTAIN_OPTS.slice(1)],
				})),
			h('div', { className: 'o-field', style: { flex: '0 0 84px' } },
				h('span', { className: 'o-label' }, '年份'),
				h(Input, { tf: 'xkYear', placeholder: '缺省今年', inputMode: 'numeric', defaultValue: f.xkYear ?? '' })),
			h('button', {
				'data-action': 'xuankong-submit', 'data-xuanji-btn': '1',
				disabled: !!c.xkLoading,
			}, c.xkLoading ? '排盘中…' : '玄空排盘'),
		),
		h('div', { className: 'o-note', style: { marginTop: '7px' } },
			'三元九运三盘：运盘（当运星入中顺飞）· 山盘（坐山宫运星入中，坐山阴阳定顺逆）· 向盘（向首宫运星入中，向首阴阳定顺逆）。格局已对公开盘逐字校验。'),
	);
}

/** 玄空结果：格局头卡 + 三盘叠加九宫格（山/运/向 三列，旺星着色）。 */
function XuanKongResult({ result }) {
	const meta = result.meta ?? {};
	const chart = result.chart ?? [];
	const pTone = result.pattern?.key === '旺山旺向' ? 'good'
		: result.pattern?.key === '上山下水' ? 'bad'
		: (result.pattern?.key === '双星会向' || result.pattern?.key === '双星会坐') ? 'warn' : null;
	// 洛书九宫屏幕布局：巽离坤 / 震中兑 / 艮坎乾
	const GRID = [['巽', '离', '坤'], ['震', '中', '兑'], ['艮', '坎', '乾']];
	return h('div', { className: 'o-anim-rise' },
		h(Card, { tone: pTone === 'good' ? 'gold' : pTone === 'bad' ? 'accent' : null, title: '格局' },
			h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' } },
				result.pattern ? h(Badge, { tone: pTone ?? 'gold' }, result.pattern.key) : null,
				meta.periodName ? h(Badge, { tone: 'accent' }, meta.periodName) : null,
			),
			meta.sitting ? h('div', { style: { fontSize: '11px', color: 'var(--o-muted)', marginTop: '5px' } },
				`${meta.sitting}，${meta.facing}`) : null,
			result.pattern?.text ? h('div', { style: { fontSize: '11.5px', lineHeight: '1.7', color: 'var(--o-muted)', marginTop: '5px' } },
				result.pattern.text) : null,
		),
		h(Card, { title: '三盘叠加（山 / 运 / 向）' },
			h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' } },
				GRID.flatMap((row) => row.map((palace) => {
					const r = chart.find((x) => x.palace === palace);
					if (!r) return null;
					const wangShan = r.shan === meta.period;
					const wangXiang = r.xiang === meta.period;
					return h('div', { key: palace, style: {
						border: `1px solid ${wangShan || wangXiang ? 'color-mix(in srgb, var(--o-gold) 45%, var(--o-border))' : 'var(--o-border)'}`,
						borderRadius: 'var(--o-r-sm)',
						background: 'var(--o-surface-2)',
						padding: '5px 4px', minHeight: '46px',
					} },
						h('div', { style: { fontSize: '9px', color: 'var(--o-ghost)' } },
							`${palace}宫${r.direction ? '·' + r.direction : ''}`),
						h('div', { style: { display: 'flex', gap: '5px', marginTop: '3px' } },
							h('span', { style: { fontSize: '13px', fontFamily: 'var(--o-serif)', color: wangShan ? 'var(--o-gold)' : 'var(--o-text)' } }, String(r.shan)),
							h('span', { style: { fontSize: '13px', fontFamily: 'var(--o-serif)', color: 'var(--o-faint)' } }, String(r.yun)),
							h('span', { style: { fontSize: '13px', fontFamily: 'var(--o-serif)', color: wangXiang ? 'var(--o-lucky)' : 'var(--o-text)' } }, String(r.xiang)),
						),
						h('div', { style: { fontSize: '8px', color: 'var(--o-ghost)', display: 'flex', gap: '5px', marginTop: '2px' } },
							h('span', null, '山'), h('span', null, '运'), h('span', null, '向')),
					);
				})),
			),
			h('div', { className: 'o-note', style: { marginTop: '6px' } },
				'每宫三列：山星 / 运星 / 向星。金色 = 山星为当运旺星（旺丁），绿色 = 向星为当运旺星（旺财）。'),
		),
		h('div', { className: 'o-note', style: { marginTop: '7px' } }, meta.note ?? ''),
		result.disclaimer ? FooterNote({ children: result.disclaimer }) : null,
	);
}
