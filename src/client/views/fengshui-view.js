// src/client/views/fengshui-view.js — 风水页：八宅命卦 + 流年九宫飞星（年家紫白）。
// 两个子表单：命卦（生辰必填）/ 飞星（只填流年，可选）。纯渲染，state 由 panel 代理读取。
import { h } from '../react.js';
import { Card, Field, Input, Seg, Badge, Glyph, StatGrid, Loading, Empty, ErrorBar, Notes, FooterNote, CalendarField, calendarHint } from './ui.js';
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
