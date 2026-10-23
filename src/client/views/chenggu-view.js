// src/client/views/chenggu-view.js — 称骨页：出生信息 → 四柱骨重明细 + 总重盘 + 档位批语。
// 纯渲染，只读 state；输入值由 panel 的点击代理在提交时统一读取（非受控件）。
import { h } from '../react.js';
import { Card, Field, Input, Select, Badge, Glyph, Bars, Loading, Empty, ErrorBar, Notes, FooterNote, CalendarField, calendarHint } from './ui.js';

const HOUR_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const HOUR_ZHI_TIP = { 子: '23–1', 丑: '1–3', 寅: '3–5', 卯: '5–7', 辰: '7–9', 巳: '9–11', 午: '11–13', 未: '13–15', 申: '15–17', 酉: '17–19', 戌: '19–21', 亥: '21–23' };

/** 称骨视图。state.chenggu = { form, loading, error, result } */
export function ChengguView({ state }) {
	const c = state.chenggu ?? {};
	const f = c.form ?? {};
	const calendar = f.calendar === 'lunar' ? 'lunar' : 'solar';
	return h('div', null,
		h(Card, { title: '出生信息', tone: 'accent' },
			h('div', { className: 'o-grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(64px, 1fr))' } },
				h(Field, { label: calendar === 'lunar' ? '农历年' : '出生年' }, Input({ tf: 'year', placeholder: '1990', inputMode: 'numeric', defaultValue: f.year ?? '' })),
				h(Field, { label: '月' }, Input({ tf: 'month', placeholder: '8', inputMode: 'numeric', defaultValue: f.month ?? '' })),
				h(Field, { label: '日' }, Input({ tf: 'day', placeholder: '16', inputMode: 'numeric', defaultValue: f.day ?? '' })),
			),
			h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '9px', alignItems: 'flex-end', marginTop: '9px' } },
				CalendarField({ calendar, leap: f.isLeapMonth === '1' }),
				h('div', { className: 'o-field', style: { flex: '1 1 130px' } },
					h('span', { className: 'o-label' }, '时辰（必填）'),
					h(Select, {
						tf: 'hourZhi',
						defaultValue: f.hourZhi ?? '',
						options: [['', '选择时辰…'], ...HOUR_ZHI.map((z) => [z, `${z}时（${HOUR_ZHI_TIP[z]}）`])],
					}),
				),
				h('button', {
					'data-action': 'chenggu-submit', 'data-xuanji-btn': '1', 'data-variant': 'primary',
					disabled: !!c.loading,
				}, c.loading ? '称量中…' : '称骨'),
			),
			h('div', { className: 'o-note', style: { marginTop: '7px' } },
				calendar === 'lunar'
					? '按农历填写（年份以正月初一为界）；称骨必填时辰——这是四柱骨重的最后一味。'
					: '按公历填写（自动换算农历）；称骨必填时辰——这是四柱骨重的最后一味。',
			),
			calendar === 'lunar' ? h('div', { className: 'o-note', style: { marginTop: '3px' } }, calendarHint(calendar)) : null,
		),
		c.error ? ErrorBar({ children: c.error }) : null,
		c.loading ? Loading({ lines: 3, text: '本地称量中…' }) : null,
		!c.loading && !c.result && !c.error
			? Empty({ glyph: '秤', title: '骨重与批语会出现在这里', hint: '袁天罡称骨按农历四柱查骨重表求和，时辰缺一不可。' })
			: null,
		c.result ? ChengguResult({ result: c.result }) : null,
	);
}

/** 称骨结果：总重盘 + 四柱明细条 + 档位批语。 */
function ChengguResult({ result }) {
	const w = result.weights ?? {};
	const rows = [['年', w.year], ['月', w.month], ['日', w.day], ['时', w.hour]].filter(([, x]) => x);
	const maxQian = Math.max(1, ...rows.map(([, x]) => x.qian ?? 0));
	return h('div', { className: 'o-anim-rise' },
		// 总重盘：这一页的视觉主角，给足空间
		result.total ? h(Card, { tone: 'gold', title: '总骨重' },
			h('div', { style: { textAlign: 'center', padding: '4px 0 2px' } },
				h(Glyph, { tone: 'gold' }, result.total.label),
				h('div', { style: { fontSize: '10.5px', color: 'var(--o-faint)', marginTop: '2px' } }, `${result.total.qian} 钱`),
				result.verdict?.band
					? h('div', { style: { marginTop: '7px' } }, h(Badge, { tone: 'gold' }, `${result.verdict.band}档`))
					: null,
			),
			h('div', { style: { fontSize: '12px', lineHeight: 1.7, marginTop: '8px' } }, result.verdict?.text ?? ''),
			result.verdict?.source ? h('div', { className: 'o-note', style: { marginTop: '6px' } }, `批语口径：${result.verdict.source}`) : null,
		) : null,
		h(Card, { title: '四柱明细' },
			h(Bars, {
				items: rows.map(([label, x]) => ({ label: `${label}柱`, value: x.qian ?? 0, max: maxQian, color: 'var(--o-gold)' })),
			}),
			h('div', { style: { display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '8px' } },
				rows.map(([label, x]) => h('div', {
					key: label,
					style: { display: 'flex', gap: '8px', alignItems: 'baseline', fontSize: '11px' },
				},
					h('span', { style: { color: 'var(--o-faint)', minWidth: '24px' } }, `${label}柱`),
					h('span', { style: { color: 'var(--o-muted)', flex: '1 1 auto' } }, x.label),
				)),
			),
			result.meta ? h('div', { className: 'o-note', style: { marginTop: '8px' } },
				`${result.meta.solar ?? ''}（公历）｜农历 ${result.meta.lunar ?? ''}｜${result.meta.yearGanZhi ?? ''}年`
					+ (result.meta.inputCalendar ? `｜按${result.meta.inputCalendar}输入` : ''),
			) : null,
			Notes({ items: result.meta?.notes }),
		),
		result.disclaimer ? FooterNote({ children: result.disclaimer }) : null,
	);
}
