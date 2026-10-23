// src/client/views/trend-view.js — 人生K线页：表单 → SVG 蜡烛图 + 大运分段 + 高低年份。
// 纯渲染，只读 state；输入值由 panel 的点击代理在提交时统一读取（非受控件）。
import { h } from '../react.js';
import { buildTrendSpec, renderTrendSvg } from './trend-chart.js';
import { Card, Field, Input, Seg, Badge, Badges, StatGrid, Loading, Empty, ErrorBar, Notes, FooterNote, CalendarField, calendarHint } from './ui.js';

/** 人生K线视图。state.trend = { form:{...}|null, loading, error, result } */
export function TrendView({ state }) {
	const t = state.trend ?? {};
	const f = t.form ?? {};
	const calendar = f.calendar === 'lunar' ? 'lunar' : 'solar';
	return h('div', null,
		h(Card, { title: '排K线', tone: 'accent' },
			h('div', { className: 'o-grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(60px, 1fr))' } },
				h(Field, { label: calendar === 'lunar' ? '农历年' : '出生年' }, Input({ tf: 'year', placeholder: '1990', inputMode: 'numeric', defaultValue: f.year ?? '' })),
				h(Field, { label: '月' }, Input({ tf: 'month', placeholder: '8', inputMode: 'numeric', defaultValue: f.month ?? '' })),
				h(Field, { label: '日' }, Input({ tf: 'day', placeholder: '16', inputMode: 'numeric', defaultValue: f.day ?? '' })),
				h(Field, { label: '画到几岁' }, Input({ tf: 'toAge', placeholder: '100', inputMode: 'numeric', defaultValue: f.toAge ?? '100' })),
			),
			h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '9px', alignItems: 'flex-end', marginTop: '9px' } },
				CalendarField({ calendar, leap: f.isLeapMonth === '1' }),
				h(Field, { label: '性别', grow: 0 }, Seg({ tf: 'gender', defaultValue: f.gender ?? 'male', options: [['male', '男命'], ['female', '女命']] })),
				h('div', { className: 'o-field', style: { flex: '1 1 96px' } },
					h('span', { className: 'o-label' }, '时辰 0–23（可留空）'),
					Input({ tf: 'hour', placeholder: '14', inputMode: 'numeric', defaultValue: f.hour ?? '' }),
				),
				h('button', {
					'data-action': 'trend-submit', 'data-xuanji-btn': '1', 'data-variant': 'primary',
					disabled: !!t.loading,
				}, t.loading ? '排盘中…' : '画K线'),
			),
			h('div', { className: 'o-note', style: { marginTop: '7px' } }, calendarHint(calendar)),
		),
		t.error ? ErrorBar({ children: t.error }) : null,
		t.loading ? Loading({ lines: 3, text: '本地排盘中…' }) : null,
		!t.loading && !t.result && !t.error
			? Empty({ glyph: '線', title: '人生K线会画在这里', hint: '按大运干支与逐年流年十神确定性计分，1 岁起到指定岁数。' })
			: null,
		t.result ? TrendResult({ result: t.result }) : null,
	);
}

/** 图 + 图例 + 分段 + 高低年份。 */
function TrendResult({ result }) {
	const spec = buildTrendSpec(result.points ?? [], result.segments ?? []);
	const best = result.highlights?.best ?? [];
	const worst = result.highlights?.worst ?? [];
	return h('div', { className: 'o-anim-rise' },
		h(Card, { title: '逐岁走势', tone: 'gold' },
			spec ? renderTrendSvg(spec, h) : h('div', { className: 'o-note' }, '没有可绘制的数据点。'),
			// 图例：均线口径要说清，否则用户会以为是额外数据
			h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '9px', marginTop: '6px', fontSize: '10px', color: 'var(--o-faint)' } },
				h('span', null, '— 5年均线'),
				h('span', null, '— 10年均线'),
				h('span', null, '虚线竖 = 大运交界'),
			),
		),
		result.meta ? h(Card, { title: '命盘基准' },
			h(StatGrid, { items: [
				{ k: '出生', v: result.meta.birth?.slice(5) ?? '—', note: result.meta.birth?.slice(0, 4) ?? '' },
				{ k: '性别', v: result.meta.gender ?? '—', note: '命' },
				{ k: '日主', v: result.meta.dayMaster ?? '—', note: '' },
				{ k: '旺衰（简）', v: result.meta.strength?.state ?? '—', note: '' },
				{ k: '输入历法', v: result.meta.calendar ?? '—', note: result.meta.lunarDate ? '' : '' },
			] }),
			result.meta.strength?.note ? h('div', { className: 'o-note', style: { marginTop: '7px' } }, result.meta.strength.note) : null,
			Notes({ items: result.meta.notes }),
		) : null,
		Array.isArray(result.segments) && result.segments.length > 0
			? h(Card, { title: '大运分段' },
				h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
					result.segments.map((s, i) => h('div', {
						key: i,
						style: {
							display: 'flex', alignItems: 'center', gap: '8px',
							background: i % 2 === 1 ? 'var(--o-surface-2)' : 'transparent',
							borderRadius: 'var(--o-r-sm)', padding: '3px 7px',
						},
					},
						h('span', { className: 'o-glyph-sm', style: { minWidth: '36px', color: 'var(--o-gold)' } }, s.ganZhi),
						h('span', { style: { fontSize: '10.5px', color: 'var(--o-faint)', flex: '1 1 auto' } }, `${s.startAge}–${s.endAge} 岁`),
					)),
				),
			) : null,
		best.length > 0 || worst.length > 0
			? h(Card, { title: '高低年份' },
				h('div', { style: { display: 'flex', flexDirection: 'column', gap: '7px' } },
					best.length > 0 ? h('div', null,
						h('div', { className: 'o-label', style: { marginBottom: '3px' } }, '顺位年份'),
						h(Badges, { children: best.map((x, i) => h(Badge, { key: i, tone: 'good' }, x)) }),
					) : null,
					worst.length > 0 ? h('div', null,
						h('div', { className: 'o-label', style: { marginBottom: '3px' } }, '谨慎年份'),
						h(Badges, { children: worst.map((x, i) => h(Badge, { key: i, tone: 'bad' }, x)) }),
					) : null,
				),
				h('div', { className: 'o-note', style: { marginTop: '7px' } },
					'「顺位/谨慎」是逐年十神与大运干支的简化计分结果，不是吉凶判词——它给的是节奏感，不是结论。',
				),
			) : null,
		result.disclaimer ? FooterNote({ children: result.disclaimer }) : null,
	);
}

/** 输入件标记（选择器用；与 css.js 的 [data-xuanji-panel-input] 对应）。 */
export const PANEL_INPUT = 'data-xuanji-panel-input';
