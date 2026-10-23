// src/client/views/bazi-view.js — 八字页：表单 → 四柱排盘 / 五行 / 刑冲合会 / 神煞 / 大运。
// 纯渲染，只读 state；输入值由 panel 的点击代理在提交时统一读取（非受控件）。
import { h } from '../react.js';
import { Card, SectionTitle, Field, Input, Select, Seg, Badge, Badges, Glyph, StatGrid, Bars, KV, Loading, Empty, ErrorBar, Notes, Divider, FooterNote, CalendarField, calendarHint, WUXING_COLOR, toneOf } from './ui.js';

const PILLAR_LABEL = [['year', '年柱'], ['month', '月柱'], ['day', '日柱'], ['hour', '时柱']];

/** 八字视图。state.bazi = { form, loading, error, result } */
export function BaziView({ state }) {
	const b = state.bazi ?? {};
	const f = b.form ?? {};
	const calendar = f.calendar === 'lunar' ? 'lunar' : 'solar';
	return h('div', null,
		h(Card, { title: '出生信息', tone: 'accent' },
			h('div', { className: 'o-grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(64px, 1fr))' } },
				h(Field, { label: calendar === 'lunar' ? '农历年' : '出生年' }, Input({ tf: 'year', placeholder: '1990', inputMode: 'numeric', defaultValue: f.year ?? '' })),
				h(Field, { label: '月' }, Input({ tf: 'month', placeholder: '8', inputMode: 'numeric', defaultValue: f.month ?? '' })),
				h(Field, { label: '日' }, Input({ tf: 'day', placeholder: '16', inputMode: 'numeric', defaultValue: f.day ?? '' })),
				h(Field, { label: '时辰 0–23（可留空）' }, Input({ tf: 'hour', placeholder: '14', inputMode: 'numeric', defaultValue: f.hour ?? '' })),
			),
			h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '9px', alignItems: 'flex-end', marginTop: '9px' } },
				CalendarField({ calendar, leap: f.isLeapMonth === '1' }),
				h(Field, { label: '性别', grow: 0 }, Seg({ tf: 'gender', defaultValue: f.gender ?? 'male', options: [['male', '男命'], ['female', '女命']] })),
				h('div', { className: 'o-field', style: { flex: '1 1 120px' } },
					h('span', { className: 'o-label' }, '出生地（可选 · 真太阳时）'),
					Input({ tf: 'city', placeholder: '如 成都 / 乌鲁木齐', defaultValue: f.city ?? '' }),
				),
				h('button', {
					'data-action': 'bazi-submit', 'data-xuanji-btn': '1', 'data-variant': 'primary',
					disabled: !!b.loading,
				}, b.loading ? '排盘中…' : '排八字'),
			),
			h('div', { className: 'o-note', style: { marginTop: '7px' } }, calendarHint(calendar)),
			h('div', { className: 'o-note', style: { marginTop: '3px' } },
				'留空出生地即按钟面时间；1986–1991 夏令时无论是否填都会自动校正。',
			),
		),
		b.error ? ErrorBar({ children: b.error }) : null,
		b.loading ? Loading({ lines: 3, text: '本地排盘中…' }) : null,
		!b.loading && !b.result && !b.error
			? Empty({ glyph: '柱', title: '四柱排盘结果会出现在这里', hint: '填上出生年月日与性别即可；时辰不知道就留空，会如实标注而不是替你猜。' })
			: null,
		b.result ? BaziResult({ result: b.result }) : null,
	);
}

/** 排盘结果主体：四柱 → 概要 → 五行 → 关系 → 神煞 → 大运。 */
function BaziResult({ result }) {
	const P = result.pillars ?? {};
	const cards = PILLAR_LABEL.filter(([k]) => P[k]);
	return h('div', { className: 'o-anim-rise' },
		// ── 四柱 ──
		h(Card, { title: '四柱' },
			h('div', { style: { display: 'flex', gap: '6px', alignItems: 'stretch' } },
				cards.map(([key, label]) => PillarCard({ key, label, p: P[key], isDay: key === 'day' })),
			),
			result.meta?.dayunNote ? null : null,
		),
		// ── 概要：日主 / 旺衰 / 喜用 ──
		h(Card, { title: '命盘概要', tone: 'gold' },
			h(StatGrid, { items: [
				{ k: '日主', v: result.dayMaster?.gan ?? '—', note: `${result.dayMaster?.yinYang ?? ''}${result.dayMaster?.wuxing ?? ''}` },
				{ k: '旺衰（简）', v: result.strength?.state ?? '—', note: '简化判定' },
				{ k: '生肖', v: result.meta?.shengXiao ?? '—', note: result.meta?.yearGanZhi ?? '' },
				{ k: '四柱数', v: String(cards.length), note: cards.length === 3 ? '时辰未知' : '齐全' },
			] }),
			result.strength?.favorable
				? h('div', { style: { marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' } },
					h('span', { className: 'o-label' }, '喜用倾向'),
					h(Badge, { tone: 'gold' }, result.strength.favorable),
				) : null,
			result.dayMaster ? h('div', { style: { marginTop: '8px' } },
				h(KV, { rows: [
					['日主', `${result.dayMaster.gan}（${result.dayMaster.yinYang}${result.dayMaster.wuxing}）`],
				] }),
			) : null,
			Notes({ items: [...(result.meta?.notes ?? []), result.meta?.lateZiNote, result.meta?.yearScopeNote] }),
		),
		result.wuxing?.counts ? h(Card, { title: '五行分布' },
			WuxingBars({ counts: result.wuxing.counts, summary: result.wuxing.summary }),
		) : null,
		Array.isArray(result.zhiRelations) ? h(Card, { title: '刑冲合会（原局地支）' },
			RelationBadges({ relations: result.zhiRelations }),
		) : null,
		Array.isArray(result.shenSha?.stars) && result.shenSha.stars.length > 0
			? h(Card, { title: '神煞（传统查表口径）' }, ShenShaChips({ stars: result.shenSha.stars }))
			: null,
		Array.isArray(result.daYun) && result.daYun.length > 0
			? h(Card, { title: '大运' }, DayunList({ daYun: result.daYun }))
			: null,
		result.disclaimer ? FooterNote({ children: result.disclaimer }) : null,
	);
}

/** 单柱竖卡：干支大字 + 十神 + 五行 + 纳音星运 + 藏干。 */
export function PillarCard({ label, p, isDay = false }) {
	if (!p) return null;
	return h('div', {
		style: {
			flex: '1 1 0', minWidth: 0, textAlign: 'center',
			background: isDay ? 'color-mix(in srgb, var(--o-gold) 8%, var(--o-surface-2))' : 'var(--o-surface-2)',
			border: `1px solid ${isDay ? 'color-mix(in srgb, var(--o-gold) 34%, transparent)' : 'var(--o-border)'}`,
			borderRadius: 'var(--o-r-md)',
			padding: '9px 4px 7px',
			boxSizing: 'border-box',
		},
	},
		h('div', { className: 'o-label', style: { color: isDay ? 'var(--o-gold)' : undefined } }, label),
		h(Glyph, { small: true, tone: isDay ? 'gold' : null }, p.ganZhi),
		h('div', { style: { fontSize: '10.5px', color: 'var(--o-muted)', marginTop: '1px' } }, p.shiShenGan ?? ''),
		h('div', { style: { fontSize: '9.5px', color: 'var(--o-faint)', marginTop: '3px' } }, `${p.yinYang ?? ''}${p.wuxing?.gan ?? ''}·${p.wuxing?.zhi ?? ''}`),
		p.naYin ? h('div', { style: { fontSize: '9.5px', color: 'var(--o-faint)' } }, p.naYin) : null,
		p.xingYun ? h('div', { style: { fontSize: '9.5px', color: 'var(--o-lucky)', marginTop: '2px' } }, `星运 ${p.xingYun}`) : null,
		p.xunKong ? h('div', { style: { fontSize: '9.5px', color: 'var(--o-ghost)' } }, `空 ${p.xunKong}`) : null,
		Array.isArray(p.cangGan) && p.cangGan.length > 0
			? h('div', {
				style: {
					fontSize: '9px', color: 'var(--o-ghost)', marginTop: '5px', lineHeight: 1.5,
					borderTop: '1px dashed var(--o-border)', paddingTop: '4px',
				},
			}, p.cangGan.map((c) => `${c.gan}(${c.shiShen})`).join(' '))
			: null,
	);
}

/**
 * 五行计数横条（宽度按 max 归一）。
 * 这里不复用 ui.js 的 Bars 组件：五行条要三列（行名 / 条 / 数值）且各自带五行色，
 * 而且它是被 headless 测试直接调用的纯渲染出口，套一层函数组件会让调用方拿不到真实 vnode。
 */
export function WuxingBars({ counts, summary }) {
	const max = Math.max(1, ...Object.values(counts ?? {}));
	return h('div', null,
		summary ? h('div', { className: 'o-note', style: { marginBottom: '6px' } }, summary) : null,
		h('div', { className: 'o-bars' },
			['金', '木', '水', '火', '土'].flatMap((el) => {
				const v = counts?.[el] ?? 0;
				const pct = Math.round((v / max) * 100);
				return [
					h('div', { key: `${el}k`, style: { fontSize: '11px', color: WUXING_COLOR[el] } }, el),
					h('div', { key: `${el}t`, className: 'o-bar-track' },
						h('div', { className: 'o-bar-fill', style: { width: `${pct}%`, height: '100%', background: WUXING_COLOR[el] } }),
					),
					h('div', { key: `${el}v`, style: { fontSize: '10px', color: 'var(--o-faint)', textAlign: 'right', fontFamily: 'var(--o-mono)' } }, String(v)),
				];
			}),
		),
	);
}

/** 刑冲合会徽章行。 */
export function RelationBadges({ relations }) {
	if (!Array.isArray(relations)) return null;
	if (relations.length === 0) {
		return h('div', { className: 'o-note' }, '四柱地支间无明显刑冲合会。');
	}
	return h(Badges, { children: relations.map((r, i) => h(Badge, { key: i, tone: toneOf(r.tone) }, r.text)) });
}

/** 神煞 chips：吉星/凶煞/中性分色，只列名与落柱，不做吉凶渲染。 */
export function ShenShaChips({ stars }) {
	const typeTone = { 吉星: 'gold', 中性: null, 凶煞: null };
	return h(Badges, { children: stars.map((s, i) => h(Badge, {
		key: i,
		tone: typeTone[s.type] ?? null,
		title: s.rule,
	}, `${s.name}·${(s.hits ?? []).map((x) => `${x.pillar ?? ''}${x.char ?? ''}`).join('/')}`)) });
}

/** 大运行：每段一个横条卡，当前年龄段标记。 */
function DayunList({ daYun }) {
	return h('div', { style: { display: 'flex', flexDirection: 'column', gap: '5px' } },
		daYun.map((d, i) => h('div', {
			key: i,
			style: {
				display: 'flex', alignItems: 'center', gap: '8px',
				background: 'var(--o-surface-2)', border: '1px solid var(--o-border)',
				borderRadius: 'var(--o-r-sm)', padding: '5px 9px',
			},
		},
			h('span', { className: 'o-glyph-sm', style: { fontSize: '14px', minWidth: '38px' } }, d.ganZhi),
			h('span', { style: { fontSize: '10.5px', color: 'var(--o-faint)', flex: '1 1 auto' } },
				d.startYear ? `${d.startYear}–${Number(d.startYear) + 9}` : (d.startAge !== undefined ? `${d.startAge}岁起` : ''),
			),
			d.shiShenGan ? h('span', { className: 'o-note' }, d.shiShenGan) : null,
		)),
	);
}
