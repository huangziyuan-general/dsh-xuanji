// src/client/views/daliuren-view.js — 大六壬页：占时起课 → 天地盘 / 四课 / 三传（实验性）。
// 纯渲染，只读 state；输入值由 panel 的点击代理在提交时统一读取（非受控件）。
import { h } from '../react.js';
import { Card, Field, Input, Select, Badge, Loading, Empty, ErrorBar, FooterNote, CalendarField, calendarHint } from './ui.js';

const HOUR_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const HOUR_ZHI_TIP = { 子: '23–1', 丑: '1–3', 寅: '3–5', 卯: '5–7', 辰: '7–9', 巳: '9–11', 午: '11–13', 未: '13–15', 申: '15–17', 酉: '17–19', 戌: '19–21', 亥: '21–23' };

/** 大六壬视图。state.daliuren = { form, loading, error, result } */
export function DaliurenView({ state }) {
	const c = state.daliuren ?? {};
	const f = c.form ?? {};
	const calendar = f.calendar === 'lunar' ? 'lunar' : 'solar';
	return h('div', null,
		h(Card, { title: '起课', tone: 'accent' },
			h('div', { className: 'o-grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(64px, 1fr))' } },
				h(Field, { label: calendar === 'lunar' ? '农历年' : '年份' }, Input({ tf: 'year', placeholder: '2026', inputMode: 'numeric', defaultValue: f.year ?? '' })),
				h(Field, { label: '月' }, Input({ tf: 'month', placeholder: '10', inputMode: 'numeric', defaultValue: f.month ?? '' })),
				h(Field, { label: '日' }, Input({ tf: 'day', placeholder: '23', inputMode: 'numeric', defaultValue: f.day ?? '' })),
			),
			h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '9px', alignItems: 'flex-end', marginTop: '9px' } },
				CalendarField({ calendar, leap: f.isLeapMonth === '1' }),
				h('div', { className: 'o-field', style: { flex: '1 1 130px' } },
					h('span', { className: 'o-label' }, '占时（必填）'),
					h(Select, {
						tf: 'hourZhi',
						defaultValue: f.hourZhi ?? '',
						options: [['', '选择占时…'], ...HOUR_ZHI.map((z) => [z, `${z}时（${HOUR_ZHI_TIP[z]}）`])],
					}),
				),
				h('button', {
					'data-action': 'daliuren-submit', 'data-xuanji-btn': '1', 'data-variant': 'primary',
					disabled: !!c.loading,
				}, c.loading ? '起课中…' : '起课'),
			),
			h('div', { className: 'o-note', style: { marginTop: '7px' } },
				'大六壬缺占时起不了课——选一个时辰。月将按月建六合取，天地盘、四课与贼克三传全部本地确定性计算。',
			),
		),
		c.error ? ErrorBar({ children: c.error }) : null,
		c.loading ? Loading({ lines: 3, text: '本地起课中…' }) : null,
		!c.loading && !c.result && !c.error
			? Empty({ glyph: '壬', title: '天地盘四课三传会落在这里', hint: '填日期 + 选占时起课；本引擎为实验性口径，结果页会如实标注。' })
			: null,
		c.result ? DaliurenResult({ result: c.result }) : null,
	);
}

/** 结果：课式头卡 + 天地盘 + 四课 + 三传。实验性标注必须显眼。 */
function DaliurenResult({ result }) {
	const meta = result.meta ?? {};
	const earth = result.earth ?? [];
	const heaven = result.heaven ?? [];
	const four = (result.four ?? []).map((k, i) => ({ no: i + 1, ben: k.ben, shang: k.shang ?? null }));
	const chuan = result.sanChuan ?? [];
	return h('div', { className: 'o-anim-rise' },
		h(Card, { tone: 'gold', title: '课式' },
			h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' } },
				h('span', { style: { fontFamily: 'var(--o-serif)', fontSize: '18px' } }, `${meta.dayGanZhi ?? ''}日`),
				meta.yuejiang ? h(Badge, { tone: 'gold' }, `月将 ${meta.yuejiang}`) : null,
				meta.zhan ? h(Badge, null, `占时 ${meta.zhan}`) : null,
				meta.experimental ? h(Badge, { tone: 'bad' }, '实验性') : null,
			),
			h('div', { style: { fontSize: '11.5px', lineHeight: 1.7, color: 'var(--o-muted)', marginTop: '6px' } },
				'天地盘 = 月将加占时；四课 = 日干寄宫与日支上神；三传 = 贼克法（下克上优先）。'),
			meta.note ? Notes(meta.note) : null,
		),
		h(Card, { title: '天地盘', right: h('span', { className: 'o-note' }, '上行天盘 · 下行地盘') },
			h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '3px' } },
				earth.map((e, i) => {
					const t = heaven[i] ?? null;
					const moved = t && t !== e;
					return h('div', {
						key: e,
						style: {
							textAlign: 'center', padding: '5px 2px', borderRadius: 'var(--o-r-sm)',
							background: moved ? 'color-mix(in srgb, var(--o-gold) 7%, var(--o-surface-2))' : 'var(--o-surface-2)',
							border: `1px solid ${moved ? 'color-mix(in srgb, var(--o-gold) 35%, var(--o-border))' : 'var(--o-border)'}`,
						},
					},
						h('div', { style: { fontFamily: 'var(--o-serif)', fontSize: '14px', color: moved ? 'var(--o-gold)' : 'var(--o-ghost)' } }, t ?? '—'),
						h('div', { style: { fontSize: '10px', color: 'var(--o-ghost)' } }, e),
					);
				}),
			),
			h('div', { className: 'o-note', style: { marginTop: '6px' } },
				'金色格 = 天盘神已转动（与地盘不同）；灰格 = 伏吟不动。'),
		),
		h(Card, { title: '四课', right: h('span', { className: 'o-note' }, '上神在顶，本神在下') },
			h('div', { style: { display: 'flex', gap: '8px', justifyContent: 'center' } },
				four.map((k) => h('div', {
					key: k.no,
					style: {
						textAlign: 'center', padding: '8px 10px', borderRadius: 'var(--o-r-sm)',
						background: 'var(--o-surface-2)', border: '1px solid var(--o-border)', minWidth: '52px',
					},
				},
					h('div', { style: { fontSize: '9px', color: 'var(--o-ghost)' } }, `四课·${k.no}`),
					h('div', { style: { fontFamily: 'var(--o-serif)', fontSize: '18px', color: 'var(--o-gold)' } }, k.shang ?? '—'),
					h('div', { style: { fontFamily: 'var(--o-serif)', fontSize: '16px' } }, k.ben),
				)),
			),
			four.some((k) => k.shang === null)
				? h('div', { className: 'o-note', style: { marginTop: '6px' } },
					'有课上神缺失：四课不全则贼克法无从取传——引擎不会编造缺位，如实标注。')
				: null,
		),
		h(Card, { title: '三传（贼克法）' },
			h('div', { style: { display: 'flex', gap: '8px', justifyContent: 'center' } },
				['初传', '中传', '末传'].map((label, i) => h('div', { key: label, style: { textAlign: 'center' } },
					h(Badge, { tone: chuan[i] ? (i === 0 ? 'gold' : null) : 'bad' }, chuan[i] ?? '缺'),
					h('div', { style: { fontSize: '10px', color: 'var(--o-ghost)', marginTop: '3px' } }, label),
				))),
			h('div', { className: 'o-note', style: { marginTop: '8px' } },
				'本引擎仅实现贼克一门，中末传按首传递取口径；九宗门其余八法待经典案例对拍校准——解读必须照实说明，不得装作完整课式。'),
		),
		result.disclaimer ? FooterNote({ children: result.disclaimer }) : null,
	);
}

/** 单行备注（引擎 meta.note 是一句口吻整话）。 */
function Notes(note) {
	return h('div', { className: 'o-note', style: { marginTop: '7px' } }, note);
}
