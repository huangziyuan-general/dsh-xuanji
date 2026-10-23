// src/client/views/tarot-view.js — 塔罗页：模式选择 + 翻牌动画 + 牌面解读。
// 翻牌是 CSS 3D flip（见 css.js 的 .xuanji-tcard 规则），点击由 panel 的代理切换 flipped 类。
import { h } from '../react.js';
import { Card, Field, Input, Seg, Badge, Loading, Empty, ErrorBar, FooterNote } from './ui.js';

/** 塔罗视图。state.tarot = { mode, question, loading, error, result, flipped:Set<index> } */
export function TarotView({ state }) {
	const t = state.tarot ?? {};
	const cards = t.result?.cards ?? (t.result?.card ? [t.result.card] : []);
	return h('div', null,
		h(Card, { title: '抽牌', tone: 'accent' },
			h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
				h('div', { className: 'o-field' },
					h('span', { className: 'o-label' }, '牌阵'),
					h(Seg, { tf: 'mode', defaultValue: t.mode ?? 'daily', options: [['daily', '每日一牌'], ['three', '三牌阵']] }),
				),
				h('div', { className: 'o-field' },
					h('span', { className: 'o-label' },
						t.mode === 'three' || t.result?.mode === 'three' ? '所问何事（三牌阵必填）' : '所问何事（可留空）'),
					h('textarea', {
						'data-xuanji-panel-input': '1', 'data-tf': 'question', className: 'xuanji-input',
						placeholder: '写一句你正在纠结的事…', rows: '2', defaultValue: t.question ?? '',
					}),
				),
				h('button', {
					'data-action': 'tarot-draw', 'data-xuanji-btn': '1', 'data-variant': 'primary',
					disabled: !!t.loading, style: { alignSelf: 'flex-start' },
				}, t.loading ? '抽牌中…' : '抽牌'),
			),
		),
		t.error ? ErrorBar({ children: t.error }) : null,
		t.loading ? Loading({ lines: 2, text: '洗牌中…' }) : null,
		cards.length > 0
			? h('div', {
				style: {
					display: 'flex', gap: '9px', flexWrap: 'wrap', justifyContent: 'center',
					padding: '4px 0 2px',
				},
			}, cards.map((c, i) => TarotCard({
				card: c,
				index: i,
				flipped: !!(t.flipped?.has?.(i) || t.flipped?.[i]),
				showPosition: cards.length > 1,
			})))
			: (!t.loading && !t.error
				? Empty({ glyph: '牌', title: '抽出来的牌会摊在这里', hint: '每日一牌同日同牌；三牌阵看过去 / 现在 / 未来。' })
				: null),
		t.result && !t.loading ? TarotText({ result: t.result, cards }) : null,
	);
}

/** 单张牌：牌背 →（点击翻面）→ 牌面。 */
export function TarotCard({ card, index, flipped, showPosition }) {
	const upright = card.orientation === '正位';
	return h('div', {
		className: `xuanji-tcard${flipped ? ' flipped' : ''}`,
		'data-action': 'card-flip',
		'data-ci': String(index),
		style: { width: '104px', height: '162px', flex: 'none' },
		'aria-label': `${card.name}（${card.orientation ?? ''}）`,
	},
		h('div', { className: 'xuanji-tcard-inner' },
			h('div', { className: 'xuanji-tface xuanji-tback' },
				h('div', { style: { fontSize: '15px', letterSpacing: '1px' } }, '☾'),
				h('div', { style: { fontSize: '9.5px', marginTop: '7px', opacity: .7 } }, '点牌翻面'),
				showPosition ? h('div', { style: { fontSize: '9.5px', marginTop: '2px', opacity: .55 } }, card.position ?? '') : null,
			),
			h('div', { className: 'xuanji-tface xuanji-tfront' },
				showPosition ? h('div', {
					style: {
						fontSize: '9px', letterSpacing: '.6px', color: 'var(--o-faint)',
						border: '1px solid var(--o-border)', borderRadius: '4px', padding: '0 5px',
					},
				}, card.position ?? '') : null,
				h('div', {
					style: {
						fontFamily: 'var(--o-serif)', fontSize: '15px', fontWeight: 500,
						lineHeight: 1.35, marginTop: '5px', letterSpacing: '.5px',
					},
				}, card.name),
				h('div', { style: { marginTop: '4px' } },
					h(Badge, { tone: upright ? 'gold' : null }, card.orientation ?? '—'),
				),
				card.keyword ? h('div', { style: { fontSize: '9.5px', marginTop: '6px', color: 'var(--o-faint)' } }, card.keyword) : null,
			),
		),
	);
}

/** 牌意文字（翻开后读）。 */
function TarotText({ result, cards }) {
	const single = result.card;
	return h(Card, { title: '牌意', tone: 'gold' },
		result.meta?.question
			? h('div', { style: { fontSize: '11.5px', color: 'var(--o-muted)', marginBottom: '7px' } }, `所问：${result.meta.question}`)
			: null,
		h('div', { style: { display: 'flex', flexDirection: 'column', gap: '7px' } },
			(single ? [single] : cards).map((c, i) => h('div', {
				key: i,
				style: {
					background: 'var(--o-surface-2)', border: '1px solid var(--o-border)',
					borderRadius: 'var(--o-r-md)', padding: '7px 9px',
				},
			},
				h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '6px', marginBottom: '2px' } },
					c.position ? h('span', { style: { fontSize: '9.5px', color: 'var(--o-faint)' } }, c.position) : null,
					h('span', { className: 'o-glyph-sm' }, c.name),
					h(Badge, { tone: c.orientation === '正位' ? 'gold' : null }, c.orientation ?? ''),
				),
				h('div', { style: { fontSize: '11px', lineHeight: 1.65, color: 'var(--o-muted)' } }, c.text ?? ''),
			)),
		),
		result.disclaimer ? FooterNote({ children: result.disclaimer }) : null,
	);
}
