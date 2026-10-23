// src/client/views/quick-view.js — 快占页：小六壬报三数 / 梅花报两数 二合一。
// 都是「随口报数」的轻量占法：所问何事 + 数字，秒级出结果（纯本地确定性）。
import { h } from '../react.js';
import { Card, Field, Input, Seg, Badge, Glyph, StatGrid, Loading, Empty, ErrorBar, FooterNote, toneOf, WUXING_COLOR } from './ui.js';

/** 快占视图。state.quick = { kind:'xiaoliuren'|'meihua', question, num1..3, loading, error, result } */
export function QuickView({ state }) {
	const q = state.quick ?? {};
	const kind = q.kind ?? 'xiaoliuren';
	const three = kind === 'xiaoliuren';
	return h('div', null,
		h(Card, { title: '起课', tone: 'accent' },
			h('div', { style: { display: 'flex', flexDirection: 'column', gap: '8px' } },
				h('div', { className: 'o-field' },
					h('span', { className: 'o-label' }, '占法'),
					h(Seg, {
						tf: 'kind',
						defaultValue: kind,
						options: [['xiaoliuren', '小六壬（报三数）'], ['meihua', '梅花易数（报两数）']],
					}),
				),
				h('div', { className: 'o-field' },
					h('span', { className: 'o-label' }, '所问何事'),
					Input({ tf: 'question', placeholder: '一句话，如：这周面谈顺利吗', defaultValue: q.question ?? '' }),
				),
				h('div', { className: 'o-field' },
					h('span', { className: 'o-label' }, three ? '随口报三个数（各 1–99）' : '随口报两个数（前上卦、后下卦）'),
					h('div', { style: { display: 'flex', gap: '6px' } },
						h(Input, { tf: 'num1', placeholder: three ? '数1' : '上卦数', inputMode: 'numeric', defaultValue: q.num1 ?? '' }),
						h(Input, { tf: 'num2', placeholder: three ? '数2' : '下卦数', inputMode: 'numeric', defaultValue: q.num2 ?? '' }),
						three ? h(Input, { tf: 'num3', placeholder: '数3', inputMode: 'numeric', defaultValue: q.num3 ?? '' }) : null,
					),
				),
				h('button', {
					'data-action': 'quick-cast', 'data-xuanji-btn': '1', 'data-variant': 'primary',
					disabled: !!q.loading, style: { alignSelf: 'flex-start' },
				}, q.loading ? '起课中…' : '起课'),
			),
		),
		q.error ? ErrorBar({ children: q.error }) : null,
		q.loading ? Loading({ lines: 2, text: '本地起课中…' }) : null,
		!q.loading && !q.result && !q.error
			? Empty({ glyph: '卜', title: '掐指 / 卦象会落在这里', hint: '随口报数才有「卦气」，别替用户编——这是这一页唯一不能代填的输入。' })
			: null,
		q.result ? (kind === 'meihua' ? MeihuaResult({ result: q.result }) : XiaoliurenResult({ result: q.result })) : null,
	);
}

/** 小六壬结果：三步落宫链 + 终宫吉凶卡。 */
function XiaoliurenResult({ result }) {
	const steps = result.steps ?? [];
	const r = result.result ?? {};
	const lucky = r.luck === '吉';
	return h('div', { className: 'o-anim-rise' },
		result.meta?.question ? h('div', { className: 'o-note', style: { marginBottom: '7px' } }, `所问：${result.meta.question}`) : null,
		result.meta?.originText ? h('div', { className: 'o-note', style: { marginBottom: '8px' } }, result.meta.originText) : null,
		// 三步掐指链：月 → 日 → 时，用箭头串起来，比裸 chips 更像「过程」
		h(Card, { title: '掐指三步' },
			h('div', { style: { display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' } },
				steps.flatMap((palace, i) => [
					i > 0 ? h('span', { key: `a${i}`, style: { color: 'var(--o-ghost)', fontSize: '11px' } }, '→') : null,
					h('span', {
						key: `p${i}`,
						style: {
							fontFamily: 'var(--o-serif)', fontSize: '13px', padding: '3px 10px',
							borderRadius: 'var(--o-r-sm)',
							border: '1px solid var(--o-border)',
							background: i === steps.length - 1 ? 'var(--o-surface-3)' : 'var(--o-surface-2)',
						},
					}, palace),
				]).filter(Boolean),
			),
			h('div', { style: { display: 'flex', gap: '6px', marginTop: '7px', fontSize: '9.5px', color: 'var(--o-ghost)' } },
				['月', '日', '时'].slice(0, steps.length).map((k) => h('span', { key: k }, k)),
			),
		),
		r.palace ? h(Card, { title: '落宫', tone: lucky ? 'accent' : null },
			h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '5px' } },
				h(Glyph, { tone: lucky ? 'lucky' : 'danger' }, r.palace),
				h(Badge, { tone: lucky ? 'good' : 'bad' }, r.luck ?? ''),
			),
			h('div', { style: { fontSize: '11.5px', lineHeight: 1.7, color: 'var(--o-muted)' } }, r.text ?? ''),
		) : null,
		result.disclaimer ? FooterNote({ children: result.disclaimer }) : null,
	);
}

/** 梅花结果：本/互/变卦 + 体用生克断语。 */
function MeihuaResult({ result }) {
	const gua = result.gua ?? {};
	const ty = result.tiYong ?? {};
	const levelTone = ty.level === '大吉' || ty.level === '吉' ? 'good'
		: ty.level === '凶' ? 'bad' : 'warn';
	return h('div', { className: 'o-anim-rise' },
		result.meta?.question ? h('div', { className: 'o-note', style: { marginBottom: '7px' } }, `所问：${result.meta.question}`) : null,
		result.meta?.originText ? h('div', { className: 'o-note', style: { marginBottom: '8px' } }, result.meta.originText) : null,
		h(Card, { title: '卦象' },
			h('div', { style: { display: 'flex', gap: '6px', alignItems: 'stretch' } },
				GuaChip({ title: `本卦 · 动${gua.movingWen ?? ''}`, g: gua.ben, primary: true }),
				GuaChip({ title: '互卦', g: gua.hu }),
				GuaChip({ title: '变卦', g: gua.bian }),
			),
		),
		ty.ti || ty.yong ? h(Card, { title: '体用生克', tone: 'gold' },
			h(StatGrid, { items: [
				{ k: '体卦', v: ty.ti?.name ?? '—', note: ty.ti?.position ?? '' },
				{ k: '用卦', v: ty.yong?.name ?? '—', note: ty.yong?.position ?? '' },
			] }),
			ty.relation ? h('div', { style: { display: 'flex', alignItems: 'center', gap: '7px', marginTop: '8px', flexWrap: 'wrap' } },
				h(Badge, { tone: levelTone }, `${ty.relation}（${ty.level ?? ''}）`),
				ty.ti?.wuxing && ty.yong?.wuxing
					? h('span', { className: 'o-note' },
						`${WUXING_COLOR[ty.ti.wuxing] ? '' : ''}体${ty.ti.wuxing} · 用${ty.yong.wuxing}`)
					: null,
			) : null,
			ty.text ? h('div', { style: { fontSize: '11.5px', lineHeight: 1.7, color: 'var(--o-muted)', marginTop: '6px' } }, ty.text) : null,
		) : null,
		result.disclaimer ? FooterNote({ children: result.disclaimer }) : null,
	);
}

/** 单卦卡：卦画大字 + 卦名。 */
function GuaChip({ title, g, primary = false }) {
	if (!g) return null;
	return h('div', {
		style: {
			flex: '1 1 0', minWidth: 0, textAlign: 'center',
			background: primary ? 'color-mix(in srgb, var(--o-gold) 8%, var(--o-surface-2))' : 'var(--o-surface-2)',
			border: `1px solid ${primary ? 'color-mix(in srgb, var(--o-gold) 30%, transparent)' : 'var(--o-border)'}`,
			borderRadius: 'var(--o-r-md)', padding: '8px 3px',
		},
	},
		h('div', { className: 'o-label' }, title),
		h('div', { style: { fontSize: '24px', lineHeight: 1.25 } }, g.symbol ?? ''),
		h('div', { style: { fontSize: '11px', fontFamily: 'var(--o-serif)' } }, g.name),
	);
}
