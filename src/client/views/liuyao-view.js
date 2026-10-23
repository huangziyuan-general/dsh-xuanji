// src/client/views/liuyao-view.js — 六爻页：逐爻摇卦 → 本卦/变卦 + 纳甲六亲六神排盘。
// 纯渲染，只读 state；输入值由 panel 的点击代理在提交时统一读取（非受控件）。
//
// 摇卦这一步必须由用户完成：每一次点击「摇」都在浏览器里产生三枚铜钱的正反，
// 与传统掷币同义。成卦之后的卦象、纳甲、六亲、六神、旺衰仍是本地确定性计算——
// 引擎从不代摇，面板也绝不预填。
import { h } from '../react.js';
import {
	Card, Badge, Loading, Empty, ErrorBar, Notes, FooterNote, WUXING_COLOR,
} from './ui.js';

/** 六爻自上而下的显示序（摇卦自下而上，看盘自上而下）。 */
const TOP_DOWN = ['上爻', '五爻', '四爻', '三爻', '二爻', '初爻'];

/** 一爻三枚，「背」的个数 → 爻象（背为阳：3背老阳、2背少阳、1背少阴、0背老阴）。 */
const YAO_BY_BACK = [
	{ num: 6, label: '老阴', fu: '⚋', moving: true },
	{ num: 8, label: '少阴', fu: '⚋', moving: false },
	{ num: 7, label: '少阳', fu: '⚊', moving: false },
	{ num: 9, label: '老阳', fu: '⚊', moving: true },
];

/** 三枚铜钱的显示：背=阳面（实心），字=阴面（空心）。 */
function CoinRow({ coins }) {
	return h('span', { style: { display: 'inline-flex', gap: '3px', alignItems: 'center' } },
		coins.map((isBack, i) => h('span', {
			key: i,
			style: {
				display: 'inline-block', width: '9px', height: '9px', borderRadius: '50%',
				border: `1px solid ${isBack ? 'var(--o-accent)' : 'var(--o-faint)'}`,
				background: isBack ? 'var(--o-accent)' : 'transparent',
			},
		})),
	);
}

/** 摇卦盘：六行爻位（上爻在上），已摇的显示三枚铜钱与爻象。 */
function TossBoard({ tosses }) {
	return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '3px' } },
		TOP_DOWN.map((name, k) => {
			const idx = 5 - k;
			const t = tosses[idx];
			const y = t ? YAO_BY_BACK[t.filter(Boolean).length] : null;
			return h('div', {
				key: name,
				style: {
					display: 'flex', alignItems: 'center', gap: '7px',
					padding: '4px 7px', borderRadius: 'var(--o-r-sm)',
					border: `1px solid ${t ? 'var(--o-border)' : 'color-mix(in srgb, var(--o-border) 45%, transparent)'}`,
					background: t ? 'var(--o-surface-2)' : 'transparent',
					minHeight: '24px',
				},
			},
				h('span', { style: { fontSize: '10px', color: 'var(--o-faint)', width: '26px', flex: '0 0 auto' } }, name),
				t ? CoinRow({ coins: t }) : null,
				h('span', {
					style: {
						marginLeft: 'auto', fontSize: '11px', fontFamily: 'var(--o-serif)',
						color: y?.moving ? 'var(--o-gold)' : 'var(--o-text)',
					},
				}, y ? `${y.fu} ${y.label}${y.moving ? '（动）' : ''}` : '待摇'),
			);
		}),
	);
}

/** 六爻视图。state.liuyao = { question, tosses, loading, error, result } */
export function LiuyaoView({ state }) {
	const c = state.liuyao ?? {};
	const tosses = c.tosses ?? [];
	const done = tosses.length >= 6;
	return h('div', null,
		h(Card, { title: '所问何事', tone: 'accent' },
			h('div', { className: 'o-field' },
				h('span', { className: 'o-label' }, '问一句你想问的事（可留空，取用神时要用）'),
				h('textarea', {
					'data-xuanji-panel-input': '1', 'data-tf': 'question', className: 'xuanji-input',
					placeholder: '写一句你正在纠结的事…', rows: '2', defaultValue: c.question ?? '',
				}),
			),
		),
		h(Card, { title: '摇卦（六次，自下而上）', right: h('span', { className: 'o-note' }, `${tosses.length}/6`) },
			TossBoard({ tosses }),
			h('div', { className: 'o-row', style: { marginTop: '9px' } },
				h('button', {
					'data-action': 'liuyao-toss', 'data-xuanji-btn': '1', 'data-variant': 'primary',
					disabled: done,
				}, done ? '已摇满六爻' : `摇第 ${tosses.length + 1} 爻`),
				h('button', {
					'data-action': 'liuyao-reset', 'data-xuanji-btn': '1',
					disabled: tosses.length === 0,
				}, '重摇'),
				h('button', {
					'data-action': 'liuyao-submit', 'data-xuanji-btn': '1', 'data-variant': 'primary',
					disabled: !done || !!c.loading,
				}, c.loading ? '排盘中…' : '起卦'),
			),
			h('div', { className: 'o-note', style: { marginTop: '7px' } },
				'铜钱朝上一面记「背」、字面记「字」；三背老阳、三字老阴（朱熹《周易本义》筮仪口径）。六爻必须由你亲手摇出——引擎不代摇、不预设结果。',
			),
		),
		c.error ? ErrorBar({ children: c.error }) : null,
		c.loading ? Loading({ lines: 3, text: '本地排盘中…' }) : null,
		!c.loading && !c.result && !c.error
			? Empty({ glyph: '爻', title: '卦例会落在这里', hint: '摇满六爻后点「起卦」：八宫归属、世应、纳甲干支、六亲六神、旺衰旬空、动爻变卦全部本地确定性计算。' })
			: null,
		c.result ? LiuyaoResult({ result: c.result }) : null,
	);
}

/** 六爻结果：本卦头卡 → 天时 → 六爻表 → 变卦/动爻 → 六亲主事。 */
export function LiuyaoResult({ result }) {
	const m = result.meta ?? {};
	const sy = result.shiYing ?? {};
	const lines = result.lines ?? [];
	return h('div', { className: 'o-anim-rise' },
		h(Card, { tone: 'gold', title: '本卦' },
			h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' } },
				h('span', { style: { fontFamily: 'var(--o-serif)', fontSize: '17px' } }, `${result.ben?.symbol ?? ''} ${result.ben?.name ?? ''}`),
				result.ben?.palace ? h(Badge, { tone: 'gold' }, `${result.ben.palace}·${result.ben.gen}`) : null,
				result.ben?.palaceWuxing ? h(Badge, { tone: 'accent' }, `宫属${result.ben.palaceWuxing}`) : null,
			),
			h('div', { style: { fontSize: '11.5px', lineHeight: 1.7, color: 'var(--o-muted)', marginTop: '6px' } },
				`世爻 ${sy.shiName}（${sy.shiGanZhi}·${sy.shiLiuqin}）｜应爻 ${sy.yingName}（${sy.yingGanZhi}·${sy.yingLiuqin}）`),
			result.ben?.gist ? h('div', { style: { fontSize: '11.5px', lineHeight: 1.7, color: 'var(--o-muted)', marginTop: '2px' } }, result.ben.gist) : null,
		),
		h(Card, { title: '天时（月建 · 日辰）' },
			h('div', { className: 'o-badges' },
				h(Badge, { tone: 'accent', title: '以节气为界的月建，旺衰的唯一标尺' }, `月建 ${m.yueJian?.ganZhi ?? '—'}`),
				h(Badge, { tone: 'accent', title: '起卦日干支，决定旬空与六神起例' }, `日辰 ${m.riChen?.ganZhi ?? '—'}`),
				m.jieQi ? h(Badge, null, m.jieQi) : null,
				h(Badge, { tone: 'warn', title: '日辰旬空：落空的爻力减' }, `旬空 ${m.riChen?.xunKong ?? '—'}`),
			),
			m.solarText ? h('div', { className: 'o-note', style: { marginTop: '6px' } }, `${m.solarText}（${m.lunarText ?? ''}）｜${m.tossSource ?? ''}`) : null,
		),
		h(Card, { title: '六爻', right: h('span', { className: 'o-note' }, '自上而下：上爻→初爻') },
			h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
				TOP_DOWN.map((name, k) => {
					const l = lines[5 - k];
					if (!l) return null;
					return h('div', {
						key: name,
						style: {
							display: 'flex', flexDirection: 'column', gap: '2px',
							padding: '5px 7px', borderRadius: 'var(--o-r-sm)',
							border: `1px solid ${l.isShi ? 'var(--o-gold)' : 'var(--o-border)'}`,
							background: l.isShi
								? 'color-mix(in srgb, var(--o-gold) 7%, var(--o-surface-2))'
								: l.moving
									? 'color-mix(in srgb, var(--o-accent) 6%, var(--o-surface-2))'
									: 'var(--o-surface-2)',
						},
					},
						h('div', { style: { display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12px' } },
							h('span', { style: { width: '26px', flex: '0 0 auto', fontSize: '10px', color: 'var(--o-faint)' } }, name),
							// 动爻在爻画旁标出老阴「×」/老阳「○」，静爻只给爻画
							h('span', { style: { fontFamily: 'var(--o-serif)', fontSize: '13px', color: l.moving ? 'var(--o-gold)' : 'var(--o-text)' } }, `${l.fu ?? ''}${l.moving ? ` ${l.mark}` : ''}`),
							h('span', { style: { fontFamily: 'var(--o-mono)', fontSize: '11.5px' } }, l.ganZhi),
							h('span', { style: { color: WUXING_COLOR[l.wuxing] ?? 'var(--o-muted)', fontSize: '11px' } }, l.wuxing),
							h('span', { style: { marginLeft: 'auto', fontSize: '11.5px', fontFamily: 'var(--o-serif)' } }, l.liuqin),
						),
						h('div', { style: { display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap', fontSize: '10.5px', color: 'var(--o-muted)' } },
							h('span', null, l.liushen),
							h(Badge, { tone: l.deLing ? 'good' : null }, l.wangShuai),
							l.isShi ? h(Badge, { tone: 'gold' }, '世') : null,
							l.isYing ? h(Badge, { tone: 'accent' }, '应') : null,
							l.moving ? h(Badge, { tone: 'gold' }, '动') : null,
							l.xunKong ? h(Badge, { tone: 'warn' }, '旬空') : null,
							l.chong ? h(Badge, { tone: l.chong === '月破' || l.chong === '日破' ? 'bad' : 'accent' }, l.chong) : null,
							h('span', null, l.dayRel),
							l.bian ? h('span', { style: { marginLeft: 'auto', color: 'var(--o-gold)' } }, `→ ${l.bian.ganZhi}·${l.bian.liuqin}`) : null,
						),
					);
				}),
			),
		),
		result.bian ? h(Card, { title: '变卦' },
			h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' } },
				h('span', { style: { fontFamily: 'var(--o-serif)', fontSize: '15px' } }, `${result.bian.symbol ?? ''} ${result.bian.name ?? ''}`),
				h('span', { className: 'o-note' }, `上${result.bian.upper}下${result.bian.lower}`),
			),
			result.bian.gist ? h('div', { style: { fontSize: '11.5px', lineHeight: 1.7, color: 'var(--o-muted)', marginTop: '5px' } }, result.bian.gist) : null,
			(result.moving ?? []).length > 0
				? h('div', { className: 'o-badges', style: { marginTop: '7px' } },
					result.moving.map((mv, i) => h(Badge, { key: i, tone: 'gold' },
						`${mv.name} ${mv.ganZhi}（${mv.liuqin}）→ ${mv.to ?? '—'}（${mv.toLiuqin ?? '—'}）${mv.rel ?? ''}`)),
				)
				: null,
		) : null,
		Object.keys(result.liuqinGuide ?? {}).length > 0
			? h(Card, { title: '六亲主事' },
				h('div', { style: { display: 'flex', flexDirection: 'column', gap: '3px', fontSize: '11px', lineHeight: 1.6 } },
					Object.entries(result.liuqinGuide).map(([k, v]) => h('div', { key: k },
						h('span', { style: { fontFamily: 'var(--o-serif)', color: 'var(--o-text)' } }, `${k}：`),
						h('span', { style: { color: 'var(--o-muted)' } }, v ?? '—'),
					)),
				),
			)
			: null,
		Notes({ items: m.notes }),
		result.disclaimer ? FooterNote({ children: result.disclaimer }) : null,
	);
}
