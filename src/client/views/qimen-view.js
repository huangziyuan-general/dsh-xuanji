// src/client/views/qimen-view.js — 奇门页：日期+时辰 → 局数/值符/旬空 + 九宫格（地_天_门）。
// 纯渲染，只读 state；输入值由 panel 的点击代理在提交时统一读取（非受控件）。
import { h } from '../react.js';
import { Card, Field, Input, Select, Badge, Loading, Empty, ErrorBar, Notes, FooterNote, CalendarField, calendarHint } from './ui.js';

const HOUR_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const HOUR_ZHI_TIP = { 子: '23–1', 丑: '1–3', 寅: '3–5', 卯: '5–7', 辰: '7–9', 巳: '9–11', 午: '11–13', 未: '13–15', 申: '15–17', 酉: '17–19', 戌: '19–21', 亥: '21–23' };

/** 九宫格布局（屏幕位置）：巽-离-坤 / 震-中-兑 / 艮-坎-乾（洛书方位）。 */
const GRID_POS = [
	[4, 9, 2],
	[3, 5, 7],
	[8, 1, 6],
];

/** 奇门视图。state.qimen = { form, loading, error, result } */
export function QimenView({ state }) {
	const c = state.qimen ?? {};
	const f = c.form ?? {};
	const calendar = f.calendar === 'lunar' ? 'lunar' : 'solar';
	return h('div', null,
		h(Card, { title: '起盘', tone: 'accent' },
			h('div', { className: 'o-grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(64px, 1fr))' } },
				h(Field, { label: calendar === 'lunar' ? '农历年' : '年份' }, Input({ tf: 'year', placeholder: '2026', inputMode: 'numeric', defaultValue: f.year ?? '' })),
				h(Field, { label: '月' }, Input({ tf: 'month', placeholder: '10', inputMode: 'numeric', defaultValue: f.month ?? '' })),
				h(Field, { label: '日' }, Input({ tf: 'day', placeholder: '23', inputMode: 'numeric', defaultValue: f.day ?? '' })),
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
					'data-action': 'qimen-submit', 'data-xuanji-btn': '1', 'data-variant': 'primary',
					disabled: !!c.loading,
				}, c.loading ? '排盘中…' : '排盘'),
			),
			h('div', { className: 'o-note', style: { marginTop: '7px' } },
				'奇门缺时辰整盘不可排——选一个时辰再起。时辰决定值符与局数，差一个时辰盘就变。',
			),
		),
		c.error ? ErrorBar({ children: c.error }) : null,
		c.loading ? Loading({ lines: 3, text: '本地排盘中…' }) : null,
		!c.loading && !c.result && !c.error
			? Empty({ glyph: '门', title: '九宫星门会落在这里', hint: '填日期 + 选时辰起盘；阳遁阴遁、局数、值符、八宫星门全部本地确定性计算。' })
			: null,
		c.result ? QimenResult({ result: c.result }) : null,
	);
}

/** 奇门结果：局数头卡 + 九宫格 + 值符旬空备注。 */
function QimenResult({ result }) {
	const ju = result.meta?.ju ?? {};
	const tian = result.tianPan ?? {};
	const di = result.diPan ?? {};
	const men = result.men ?? {};
	const luckyGates = ['休门', '生门', '开门'];
	return h('div', { className: 'o-anim-rise' },
		h(Card, { tone: 'gold', title: '局数' },
			h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' } },
				h('span', { className: 'o-glyph-sm', style: { fontFamily: 'var(--o-serif)', fontSize: '18px' } },
					`${ju.yangDun ? '阳遁' : '阴遁'} ${ju.ju} 局`),
				ju.jq ? h(Badge, { tone: 'gold' }, `${ju.jq}节`) : null,
				ju.fuTou ? h(Badge, null, `符头${ju.fuTou}（${ju.dayGan}日）`) : null,
			),
			h('div', { style: { fontSize: '11.5px', lineHeight: 1.7, color: 'var(--o-muted)', marginTop: '6px' } },
				`时干支 ${result.meta?.ganzhi?.time ?? ''}｜值符 ${result.zhiFu ?? ''}｜旬空 ${(result.kongWang ?? []).join('、')}`),
		),
		h(Card, { title: '九宫仪奇星门', right: h('span', { className: 'o-note' }, '格内：地盘仪奇 · 天盘星(携仪) · 八门') },
			h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '5px' } },
				GRID_POS.flatMap((row, r) => row.map((p) => {
					const m = men[p];
					const isZhong = p === 5;
					const gateLucky = !isZhong && m ? luckyGates.includes(m) : false;
					return h('div', {
						key: p,
						style: {
							border: `1px solid ${isZhong ? 'var(--o-gold)' : gateLucky ? 'color-mix(in srgb, var(--o-lucky) 55%, var(--o-border))' : 'var(--o-border)'}`,
							borderRadius: 'var(--o-r-sm)',
							background: isZhong ? 'color-mix(in srgb, var(--o-gold) 7%, var(--o-surface-2))' : gateLucky ? 'color-mix(in srgb, var(--o-lucky) 6%, var(--o-surface-2))' : 'var(--o-surface-2)',
							padding: '6px 4px',
							minHeight: '56px',
						},
						title: isZhong ? '中宫（天禽寄宫，无门）' : `${result.palaces ? Object.entries(result.palaces).find(([, x]) => x.palace === p)?.direction : ''}`,
					},
						h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: 'var(--o-ghost)' } },
							h('span', null, isZhong ? '中宫' : `${p}宫`),
							!isZhong && m ? h(Badge, { tone: gateLucky ? 'good' : null, title: gateLucky ? '吉门' : null }, m) : null),
						h('div', { style: { fontSize: '12.5px', fontFamily: 'var(--o-serif)', marginTop: '2px', color: 'var(--o-text)' } },
							`${di[p] ?? '—'} → ${tian[p] ?? '—'}`),
					);
				})),
			),
			h('div', { className: 'o-note', style: { marginTop: '7px' } },
				'格内读法：地盘仪奇（三奇六仪，随局落宫）→ 天盘星（携本宫仪奇旋转落此，保环形相对序）· 右上角为八门；中宫寄天禽无门，仪奇随寄宫口径并入。'),
			Notes({ items: result.meta?.notes }),
		),
		result.disclaimer ? FooterNote({ children: result.disclaimer }) : null,
	);
}
