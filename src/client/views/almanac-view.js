// src/client/views/almanac-view.js — 黄历页：日期查询 + 宜忌/冲煞/方位/节气/每日一卦。
// 进入本页时由 panel 自动查「今天」，用户可改日期重查。
import { h } from '../react.js';
import { Card, Field, Input, Badge, StatGrid, Loading, Empty, ErrorBar, FooterNote, CalendarField, calendarHint } from './ui.js';

/** 黄历视图。state.almanac = { form, date, loading, error, result } */
export function AlmanacView({ state }) {
	const a = state.almanac ?? {};
	const f = a.form ?? {};
	const calendar = f.calendar === 'lunar' ? 'lunar' : 'solar';
	return h('div', null,
		h(Card, { title: '查历', tone: 'accent' },
			h('div', { style: { display: 'flex', gap: '7px', alignItems: 'flex-end', flexWrap: 'wrap' } },
				h('div', { className: 'o-field', style: { flex: '1 1 130px' } },
					h('span', { className: 'o-label' }, `日期（${calendar === 'lunar' ? '农历' : '公历'} · 留空=今天）`),
					Input({ tf: 'date', placeholder: calendar === 'lunar' ? '如 2026-07-07' : 'YYYY-MM-DD', defaultValue: a.date ?? '' }),
				),
				CalendarField({ calendar, leap: f.isLeapMonth === '1' }),
				h('button', {
					'data-action': 'almanac-submit', 'data-xuanji-btn': '1', 'data-variant': 'primary',
					disabled: !!a.loading,
				}, a.loading ? '查历中…' : '查黄历'),
			),
			h('div', { className: 'o-note', style: { marginTop: '7px' } }, calendarHint(calendar)),
		),
		a.error ? ErrorBar({ children: a.error }) : null,
		a.loading ? Loading({ lines: 4, text: '本地推历中…' }) : null,
		!a.loading && !a.result && !a.error
			? Empty({ glyph: '曆', title: '今天的黄历会自己跑出来', hint: '进入本页自动查今天；改日期可以查任意一天。' })
			: null,
		a.result ? AlmanacResult({ result: a.result }) : null,
	);
}

/** 黄历结果：日期头 + 宜忌两列 + 冲煞 + 方位格 + 节气 + 每日一卦卡。 */
function AlmanacResult({ result }) {
	const pos = result.positions ?? {};
	const jq = result.jieQi ?? {};
	const gz = result.ganzhi ?? {};
	const directions = [['喜神', pos.xiShen], ['财神', pos.caiShen], ['福神', pos.fuShen], ['阳贵', pos.yangGui], ['阴贵', pos.yinGui]]
		.filter(([, v]) => v);
	return h('div', { className: 'o-anim-rise' },
		// 日期头：公历 + 农历干支，这一页的「标题区」
		h(Card, { tone: 'gold', title: result.meta?.isToday ? '今天' : '所查之日' },
			h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' } },
				GlyphDate({ date: result.meta?.date }),
				h('span', { className: 'o-note' }, result.lunarDate ?? ''),
			),
			h('div', { style: { display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '7px' } },
				gz.year ? h(Badge, { tone: 'gold' }, `${gz.year}年`) : null,
				gz.month ? h(Badge, { tone: 'gold' }, `${gz.month}月`) : null,
				gz.day ? h(Badge, { tone: 'gold' }, `${gz.day}日`) : null,
				gz.shengXiao ? h(Badge, null, `属${gz.shengXiao}`) : null,
			),
			result.ganzhi ? h('div', { className: 'o-note', style: { marginTop: '7px' } },
				[result.zhiXing ? `值神 ${result.zhiXing}` : null, result.liuYao, result.yueXiang ? `月相 ${result.yueXiang}` : null]
					.filter(Boolean).join(' · '),
			) : null,
			result.xiu?.xiu ? h('div', { className: 'o-note' },
				`星宿 ${result.xiu.xiu}（${result.xiu.gong ?? ''}${result.xiu.animal ?? ''}）`,
			) : null,
			(result.pengZu?.gan || result.pengZu?.zhi)
				? h('div', { className: 'o-note' }, `彭祖百忌：${[result.pengZu.gan, result.pengZu.zhi].filter(Boolean).join('；')}`)
				: null,
		),
		// 宜 / 忌
		h(Card, { title: '宜忌' },
			h('div', { style: { display: 'flex', gap: '7px', flexWrap: 'wrap' } },
				YiJiCard({ title: '宜', tone: 'good', items: result.yi ?? [] }),
				YiJiCard({ title: '忌', tone: 'bad', items: result.ji ?? [] }),
			),
			result.chong?.text ? h('div', { className: 'o-note', style: { marginTop: '8px' } },
				`冲煞：${result.chong.text}${result.chong.shengXiao ? `（冲${result.chong.shengXiao}）` : ''}${result.chong.sha ? result.chong.sha : ''}`,
			) : null,
		),
		// 方位
		directions.length > 0 ? h(Card, { title: '吉神方位' },
			h(StatGrid, { items: directions.map(([k, v]) => ({ k, v, note: '' })) }),
		) : null,
		// 节气 / 节日 / 神煞
		(jq.next || jq.prev || jq.current) ? h(Card, { title: '节气' },
			h('div', { className: 'o-note' },
				[
					jq.current ? `今日交 ${jq.current.name}` : null,
					jq.prev?.name ? `${jq.prev.name} 已过` : null,
					jq.next?.name ? `下一节气 ${jq.next.name}（${jq.next.date ?? ''}）` : null,
				].filter(Boolean).join(' · '),
			),
			Array.isArray(result.festivals) && result.festivals.length > 0
				? h('div', { style: { display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '6px' } },
					result.festivals.map((f, i) => h(Badge, { key: i, tone: 'warn' }, f)))
				: null,
		) : null,
		((result.jiShen ?? []).length > 0 || (result.xiongSha ?? []).length > 0)
			? h(Card, { title: '神煞' },
				(result.jiShen ?? []).length > 0 ? h('div', null,
					h('div', { className: 'o-label', style: { marginBottom: '3px' } }, '吉神宜趋'),
					h('div', { style: { display: 'flex', gap: '4px', flexWrap: 'wrap' } },
						result.jiShen.map((x, i) => h(Badge, { key: i, tone: 'good' }, x))),
				) : null,
				(result.xiongSha ?? []).length > 0 ? h('div', { style: { marginTop: '7px' } },
					h('div', { className: 'o-label', style: { marginBottom: '3px' } }, '凶神宜忌'),
					h('div', { style: { display: 'flex', gap: '4px', flexWrap: 'wrap' } },
						result.xiongSha.map((x, i) => h(Badge, { key: i }, x))),
				) : null,
			) : null,
		result.dailyHexagram ? DailyHexCard({ hex: result.dailyHexagram }) : null,
		result.disclaimer ? FooterNote({ children: result.disclaimer }) : null,
	);
}

/** 日期大字（月/日拆开排，比一行字符串更像日历）。 */
function GlyphDate({ date }) {
	if (!date) return null;
	const [y, m, d] = String(date).split('-');
	return h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '5px' } },
		h('span', { style: { fontFamily: 'var(--o-serif)', fontSize: '22px', letterSpacing: '1px' } }, `${m ?? ''}/${d ?? ''}`),
		h('span', { style: { fontSize: '10.5px', color: 'var(--o-faint)' } }, y ?? ''),
	);
}

/** 宜/忌卡。 */
function YiJiCard({ title, tone, items }) {
	return h('div', {
		style: {
			flex: '1 1 120px', minWidth: 0,
			background: tone === 'good'
				? 'color-mix(in srgb, var(--o-lucky) 7%, var(--o-surface-2))'
				: 'color-mix(in srgb, var(--o-danger) 7%, var(--o-surface-2))',
			border: `1px solid ${tone === 'good'
				? 'color-mix(in srgb, var(--o-lucky) 26%, transparent)'
				: 'color-mix(in srgb, var(--o-danger) 26%, transparent)'}`,
			borderRadius: 'var(--o-r-md)', padding: '8px 10px',
		},
	},
		h('div', { style: { marginBottom: '4px' } }, h(Badge, { tone }, title)),
		h('div', { style: { fontSize: '11.5px', lineHeight: 1.7, color: 'var(--o-muted)' } },
			items.length > 0 ? items.join('、') : '——'),
	);
}

/** 每日一卦卡（确定性取卦，同日同卦）。 */
function DailyHexCard({ hex }) {
	return h(Card, { title: '每日一卦', tone: 'gold' },
		h('div', { style: { display: 'flex', alignItems: 'center', gap: '11px' } },
			h('div', {
				style: {
					fontSize: '34px', lineHeight: 1,
					color: 'var(--o-gold)', fontFamily: 'var(--o-serif)', flex: '0 0 auto',
				},
			}, hex.symbol ?? '☯'),
			h('div', { style: { minWidth: 0 } },
				h('div', { className: 'o-glyph-sm' }, hex.name ?? ''),
				hex.upper && hex.lower
					? h('div', { className: 'o-note' }, `上${hex.upper}下${hex.lower}`)
					: null,
				hex.gist ? h('div', { style: { fontSize: '11.5px', lineHeight: 1.65, color: 'var(--o-muted)', marginTop: '4px' } }, hex.gist) : null,
			),
		),
	);
}
