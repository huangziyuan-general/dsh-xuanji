// src/client/views/match-view.js — 合婚页：双方生辰（年/月/日 + 时辰可选 + 历法）→ 属相关系 + 双向十神 + 跨盘合会 + 分档。
// 纯渲染，只读 state；两方表单各带 data-tf 前缀（a_ / b_），提交时由 panel 代理统一读取。
import { h } from '../react.js';
import { Card, Field, Input, Seg, Select, Badge, Loading, Empty, ErrorBar, Notes, FooterNote, CalendarField, calendarHint } from './ui.js';

const HOUR_ZHI = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'];
const HOUR_ZHI_TIP = { 子: '23–1', 丑: '1–3', 寅: '3–5', 卯: '5–7', 辰: '7–9', 巳: '9–11', 午: '11–13', 未: '13–15', 申: '15–17', 酉: '17–19', 戌: '19–21', 亥: '21–23' };

/** 合婚视图。state.match = { form, loading, error, result }；form 键带 a_/b_ 前缀。 */
export function MatchView({ state }) {
	const c = state.match ?? {};
	const f = c.form ?? {};
	const ca = f.a_calendar === 'lunar' ? 'lunar' : 'solar';
	const cb = f.b_calendar === 'lunar' ? 'lunar' : 'solar';
	const oneSide = (prefix, label, cal) => {
		const fc = f[`${prefix}_calendar`] === 'lunar' ? 'lunar' : 'solar';
		const fy = f[`${prefix}_year`] ?? '';
		const fm = f[`${prefix}_month`] ?? '';
		const fd = f[`${prefix}_day`] ?? '';
		return h(Card, { title: label, tone: 'accent' },
			h('div', { className: 'o-grid', style: { gridTemplateColumns: 'repeat(auto-fit, minmax(56px, 1fr))' } },
				h(Field, { label: fc === 'lunar' ? '农历年' : '出生年' }, Input({ tf: `${prefix}_year`, placeholder: '1990', inputMode: 'numeric', defaultValue: fy })),
				h(Field, { label: '月' }, Input({ tf: `${prefix}_month`, placeholder: '8', inputMode: 'numeric', defaultValue: fm })),
				h(Field, { label: '日' }, Input({ tf: `${prefix}_day`, placeholder: '16', inputMode: 'numeric', defaultValue: fd })),
			),
			h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'flex-end', marginTop: '8px' } },
				CalendarField({ calendar: fc, leap: f[`${prefix}_isLeapMonth`] === '1' }),
				h('div', { className: 'o-field', style: { flex: '1 1 110px' } },
					h('span', { className: 'o-label' }, '时辰（可省）'),
					h(Select, {
						tf: `${prefix}_hourZhi`,
						defaultValue: f[`${prefix}_hourZhi`] ?? '',
						options: [['', '未知/不填'], ...HOUR_ZHI.map((z) => [z, `${z}时（${HOUR_ZHI_TIP[z]}）`])],
					}),
				),
			),
		);
	};
	return h('div', null,
		oneSide('a', '甲方', ca),
		oneSide('b', '乙方', cb),
		h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '9px', alignItems: 'flex-end' } },
			h('div', { className: 'o-field', style: { flex: '1 1 90px' } },
				h('span', { className: 'o-label' }, '甲方称谓'),
				Input({ tf: 'a_label', placeholder: '如 男方', defaultValue: f.a_label ?? '' })),
			h('div', { className: 'o-field', style: { flex: '1 1 90px' } },
				h('span', { className: 'o-label' }, '乙方称谓'),
				Input({ tf: 'b_label', placeholder: '如 女方', defaultValue: f.b_label ?? '' })),
			h('button', {
				'data-action': 'match-submit', 'data-xuanji-btn': '1', 'data-variant': 'primary',
				disabled: !!c.loading, alignSelf: 'flex-start',
			}, c.loading ? '合盘中…' : '合盘'),
		),
		c.error ? ErrorBar({ children: c.error }) : null,
		c.loading ? Loading({ lines: 3, text: '本地合盘中…' }) : null,
		!c.loading && !c.result && !c.error
			? Empty({ glyph: '合', title: '属相关系与双向十神会落在这里', hint: '双方出生年月日必填（时辰可省）；冲刑害一律讲「摩擦点」，绝不做必配/必离断言。' })
			: null,
		c.result ? MatchResult({ result: c.result }) : null,
	);
}

/** 合婚结果：分档头 + 关系事实分层（属相/日主/十神/跨盘/纳音）。 */
function MatchResult({ result }) {
	const v = result.verdict ?? {};
	const rels = result.relations ?? [];
	const KIND_LABEL = { 属相: '属相', 日主: '日主', 双向十神: '十神', 跨盘三合: '跨盘合', 跨盘六合: '跨盘合', 年命纳音: '纳音' };
	const groups = {};
	for (const r of rels) {
		const key = KIND_LABEL[r.kind] ?? r.kind;
		(groups[key] = groups[key] ?? []).push(r);
	}
	const toneBadge = (t) => (t === '吉' ? 'good' : t === '凶' ? 'bad' : null);
	const verdictTone = (v.verdict === '上' || v.verdict === '中上') ? 'good' : v.verdict === '中' ? 'warn' : v.verdict ? 'bad' : 'warn';
	return h('div', { className: 'o-anim-rise' },
		Object.keys(result.meta ?? {}).filter((k) => !k.endsWith('Note') && !Array.isArray(result.meta[k])).map((k) => h('div', { key: k, className: 'o-note' }, `${k}：${result.meta[k]}`)),
		h(Card, { tone: verdictTone === 'good' ? 'gold' : 'accent', title: '分档' },
			h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '8px' } },
				v.verdict ? h(Badge, { tone: verdictTone }, `${v.verdict}档`) : null,
				h('span', { style: { fontSize: '11.5px', color: 'var(--o-muted)', lineHeight: 1.7 } }, v.text ?? ''),
			),
		),
		Object.entries(groups).map(([label, items]) => h(Card, { key: label, title: label },
			h('div', { style: { display: 'flex', flexDirection: 'column', gap: '4px' } },
				items.map((r, i) => h('div', { key: i, style: { display: 'flex', gap: '7px', alignItems: 'baseline' } },
					h(Badge, { tone: toneBadge(r.tone) }, r.tone ?? '中性'),
					h('span', { style: { fontSize: '11.5px', color: 'var(--o-muted)', flex: '1 1 auto' } }, r.text),
				)),
			),
		)),
		Notes({ items: [...(result.meta?.aTimeNotes ?? []), ...(result.meta?.bTimeNotes ?? []), result.meta?.aNote, result.meta?.bNote] }),
		result.disclaimer ? FooterNote({ children: result.disclaimer }) : null,
	);
}
