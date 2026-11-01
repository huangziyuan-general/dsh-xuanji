// src/client/views/mbti-view.js — MBTI 页：24 题逐题二选一 → 计分 → 十六型画像。
// 逐题推进（不是一屏铺 24 题）：面板窄，一屏一题才有「答卷」的节奏。
// 答案只存在点击里（state.mbti.answers），绝不代填——缺一题就交不了卷，纪律与引擎一致。
import { h } from '../react.js';
import { Card, Badge, Loading, Empty, ErrorBar, FooterNote } from './ui.js';

/** MBTI 视图。state.mbti = { phase:'intro'|'quiz'|'result', questions, answers:Array<0|1|null>, idx, loading, error, result } */
export function MbtiView({ state }) {
	const m = state.mbti ?? {};
	return h('div', null,
		m.error ? ErrorBar({ children: m.error }) : null,
		m.loading ? Loading({ lines: 2, text: '取题中…' }) : null,
		m.phase === 'quiz' && m.questions?.length ? MbtiQuiz({ state: m }) : null,
		m.phase === 'result' && m.result ? MbtiResult({ result: m.result }) : null,
		(!m.phase || m.phase === 'intro') && !m.loading
			? Empty({
				glyph: '性',
				title: '24 题二选一，测你的十六型',
				hint: '答案只在你点的时候产生——本地确定性计分，不联网不代答。',
				children: h('button', {
					'data-action': 'mbti-start', 'data-xuanji-btn': '1', 'data-variant': 'primary',
					disabled: !!m.loading, style: { marginTop: '10px' },
				}, '开始答卷'),
			})
			: null,
	);
}

/** 答卷态：一屏一题 + 进度条 + 已答缩略。 */
function MbtiQuiz({ state: m }) {
	const questions = m.questions ?? [];
	const answers = m.answers ?? [];
	const idx = Math.min(m.idx ?? 0, questions.length - 1);
	const q = questions[idx];
	const answered = answers.filter((a) => a === 0 || a === 1).length;
	const done = answered === questions.length;
	return h(Card, { title: `第 ${idx + 1} / ${questions.length} 题`, tone: 'accent' },
		h('div', { style: { height: '3px', background: 'var(--o-surface-2)', borderRadius: '2px', marginBottom: '10px', overflow: 'hidden' } },
			h('div', { style: { height: '100%', width: `${Math.round((answered / questions.length) * 100)}%`, background: 'var(--o-gold)', transition: 'width .2s' } })),
		h('div', { style: { fontSize: '13px', lineHeight: 1.6, marginBottom: '10px' } }, q.text),
		h('div', { style: { display: 'flex', flexDirection: 'column', gap: '7px' } },
			(q.options ?? []).map((opt, oi) => h('button', {
				key: oi,
				'data-action': 'mbti-pick', 'data-val': String(oi), 'data-xuanji-btn': '1',
				'aria-pressed': answers[idx] === oi ? 'true' : 'false',
				style: { textAlign: 'left', padding: '8px 10px' },
			}, opt)),
		),
		h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' } },
			h('button', {
				'data-action': 'mbti-prev', 'data-xuanji-btn': '1',
				disabled: idx === 0, style: { padding: '4px 10px' },
			}, '← 上一题'),
			h('span', { className: 'o-note' }, `已答 ${answered} / ${questions.length}`),
			h('button', {
				'data-action': 'mbti-submit', 'data-xuanji-btn': '1', 'data-variant': 'primary',
				disabled: !done || !!m.submitting,
				title: done ? '交卷计分' : '24 题答完才能交卷——缺一题不猜',
			}, m.submitting ? '计分中…' : '交卷'),
		),
	);
}

/** 结果态：类型大字 + 四维分数条 + 画像。 */
function MbtiResult({ result }) {
	const dims = result.dimensions ?? {};
	const dimRows = Object.entries(dims).map(([key, d]) => ({ key, ...d }));
	return h('div', { className: 'o-anim-rise' },
		h(Card, { tone: 'gold', title: '你的类型' },
			h('div', { style: { display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' } },
				h('span', { style: { fontFamily: 'var(--o-serif)', fontSize: '30px', letterSpacing: '3px' } }, result.type ?? '—'),
				h(Badge, { tone: 'gold' }, '十六型'),
			),
			result.profile ? h('div', { style: { fontSize: '12.5px', lineHeight: 1.8, marginTop: '8px' } }, result.profile) : null,
		),
		h(Card, { title: '四维倾向', right: h('span', { className: 'o-note' }, '条长 = 这一维的偏侧强度') },
			dimRows.length > 0
				? h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
					dimRows.map((d) => {
						const [a, b] = d.score ?? [0, 0];
						const total = a + b || 1;
						const leftPct = Math.round((a / total) * 100);
						const [nameA, nameB] = d.names ?? [d.key, ''];
						// 首极（E/S/T/J）是左名；命中 pole 的一侧加粗，与引擎判型口径对齐。
						const poleLeft = ['E', 'S', 'T', 'J'].includes(d.pole);
						return h('div', { key: d.key },
							h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '3px' } },
								h('span', { style: { fontWeight: poleLeft ? 600 : 400 } }, `${nameA} ${a}`),
								h('span', { className: 'o-note' }, d.label ?? ''),
								h('span', { style: { fontWeight: poleLeft ? 400 : 600 } }, `${b} ${nameB}`),
							),
							h('div', { style: { display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', background: 'var(--o-surface-2)' } },
								h('div', { style: { width: `${leftPct}%`, background: 'var(--o-gold)' } }),
								h('div', { style: { width: `${100 - leftPct}%`, background: 'var(--o-border)' } }),
							),
						);
					}))
				: null,
			h('div', { className: 'o-note', style: { marginTop: '8px' } },
				'分数只是倾向强度，不是能力高低；平票取首极并在结果里如实标注（引擎口径）。'),
		),
		result.disclaimer ? FooterNote({ children: result.disclaimer }) : null,
	);
}
