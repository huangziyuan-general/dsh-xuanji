// src/client/views/ui.js — 面板共享组件原语。
//
// 六个视图以前各自手搓 style 对象（十六进制色值散落一地），结果：换主题就崩、
// 改一次间距要动六个文件。这里收敛成一套「有名字的积木」，视图层只写结构与数据。
//
// 颜色一律不写死，走 css.js 注入的设计令牌（currentColor + color-mix），
// 这样宿主深浅主题都成立。
import { h } from '../react.js';

/** 分区标题：小号 + 字距 + 左侧竖线。 */
export const SectionTitle = ({ children, right = null }) => h('div', { className: 'o-section-title' },
	h('span', { style: { flex: '1 1 auto', minWidth: 0 } }, children),
	right,
);

/**
 * 卡片容器。
 * @param {{ title?:string, tone?:'accent'|'gold', right?:any, children:any }} props
 */
export const Card = ({ title = null, tone = null, right = null, children }) => h('div', {
	className: `o-card${tone === 'accent' ? ' o-card-accent' : tone === 'gold' ? ' o-card-gold' : ''}`,
},
	title ? h(SectionTitle, { right }, title) : null,
	children,
);

/** 表单字段：标签 + 控件。grow=0 表示按内容收缩（如分段控件），不参与挤压。 */
export const Field = ({ label, children, grow = 1 }) => h('div', {
	className: 'o-field',
	style: {
		...(grow > 0
			? { flex: `${grow} 1 0`, minWidth: `${grow * 52}px` }
			: { flex: '0 0 auto' }),
	},
},
	h('span', { className: 'o-label' }, label),
	children,
);

/** 输入件：自动带上 advis 属性（css 选择器靠它命中皮肤）。 */
export const Input = ({ tf, placeholder, width = null, inputMode = null, type = 'text', defaultValue = '', max = null, min = null }) => h('input', {
	'data-xuanji-panel-input': '1',
	'data-tf': tf,
	type,
	placeholder,
	inputMode,
	defaultValue,
	className: 'xuanji-input',
	...(max !== null ? { max } : {}),
	...(min !== null ? { min } : {}),
	...(width ? { style: { width } } : {}),
});

export const Select = ({ tf, options, defaultValue = '' }) => h('select', {
	'data-xuanji-panel-input': '1', 'data-tf': tf, defaultValue,
}, options.map(([value, label]) => h('option', { key: value, value }, label)));

/** 分段控件（性别 / 模式）：点选切换，值写进隐藏 input 供表单统一读取。 */
export const Seg = ({ tf, options, defaultValue, disabled = false }) => h('div', {
	className: 'o-seg', 'data-seg': tf, 'data-value': defaultValue,
	...(disabled ? { 'data-disabled': '1' } : {}),
},
	h('input', { type: 'hidden', 'data-xuanji-panel-input': '1', 'data-tf': tf, defaultValue }),
	options.map(([value, label]) => h('button', {
		key: value, type: 'button', className: 'o-seg-item',
		'aria-pressed': value === defaultValue ? 'true' : 'false',
		'data-seg-value': value,
	}, label)),
);

/**
 * 历法切换：公历 / 农历。
 * 每个吃日期的页面都必须有它——没有就是「农历生日用户被静默按公历排盘」的入口，
 * 那种错误不会报错、不会崩溃，只会给用户一个看起来很专业、其实月柱差一位的盘。
 */
export const CalendarSeg = ({ defaultValue = 'solar' }) => Seg({
	tf: 'calendar',
	defaultValue,
	options: [['solar', '公历'], ['lunar', '农历']],
});

/** 闰月勾选（只在农历下有意义，由页面按当前历法决定是否渲染）。 */
export const LeapCheck = ({ checked = false }) => h('label', { className: 'o-check', title: '闰月不是每年都有，勾错等于换了一个月' },
	h('input', {
		type: 'checkbox', 'data-xuanji-panel-input': '1', 'data-tf': 'isLeapMonth',
		defaultChecked: checked,
	}),
	h('span', null, '闰月'),
);

/** 历法 + 闰月组合字段（农历时自动展开闰月勾选）。 */
export const CalendarField = ({ calendar = 'solar', leap = false }) => h(Field, { label: '历法', grow: 0 },
	h('div', { style: { display: 'flex', gap: '7px', alignItems: 'center' } },
		CalendarSeg({ defaultValue: calendar }),
		calendar === 'lunar' ? LeapCheck({ checked: leap }) : null,
	),
);

/** 历法口径说明（提交前就得让用户看见，别等排完才发现填错了历法）。 */
export const calendarHint = (calendar) => (calendar === 'lunar'
	? '按农历填（年份以正月初一为界，不是公历年）；闰月请勾「闰月」——平月与闰月四柱不同。'
	: '按公历（阳历）填；如果你记的是农历生日，切到「农历」再填。');

/** 徽章。tone: good | bad | warn | gold | accent | null */
export const Badge = ({ tone = null, title = null, children }) => h('span', {
	className: `o-badge${tone ? ` is-${tone}` : ''}`,
	...(title ? { title } : {}),
}, children);

export const Badges = ({ children }) => h('div', { className: 'o-badges' }, children);

/** 命理大字（干支/卦象/骨重）：衬线体，视觉锚点。 */
export const Glyph = ({ children, small = false, tone = null }) => h('div', {
	className: small ? 'o-glyph-sm' : 'o-glyph',
	...(tone ? { style: { color: `var(--o-${tone})` } } : {}),
}, children);

/** 指标网格。items: [{k, v, note}] */
export const StatGrid = ({ items }) => h('div', { className: 'o-stat-grid' },
	items.map((it, i) => h('div', { key: i, className: 'o-stat' },
		h('div', { className: 'o-stat-k' }, it.k),
		h('div', { className: 'o-stat-v' }, it.v),
		it.note ? h('div', { className: 'o-stat-note' }, it.note) : null,
	)),
);

/** 水平条。items: [{label, value, max, color}] */
export const Bars = ({ items, showValue = true }) => h('div', { className: 'o-bars' },
	items.flatMap((it, i) => [
		h('div', { key: `${i}k`, style: { fontSize: '11px', color: it.color } }, it.label),
		h('div', { key: `${i}t`, className: 'o-bar-track' },
			h('div', { className: 'o-bar-fill', style: { width: `${Math.round((it.value / it.max) * 100)}%`, background: it.color } }),
		),
		h('div', { key: `${i}v`, style: { fontSize: '10px', color: 'var(--o-faint)', textAlign: 'right', fontFamily: 'var(--o-mono)' } },
			showValue ? String(it.value) : ''),
	]),
);

/** 键值表。rows: [[k, v]] */
export const KV = ({ rows }) => h('div', { className: 'o-kv' },
	rows.filter(([, v]) => v !== null && v !== undefined && v !== '').flatMap(([k, v], i) => [
		h('div', { key: `${i}k`, className: 'o-kv-k' }, k),
		h('div', { key: `${i}v`, className: 'o-kv-v' }, v),
	]),
);

/** 加载骨架屏。 */
export const Loading = ({ lines = 3, text = '本地排盘中…' }) => h('div', { className: 'o-loading' },
	Array.from({ length: lines }, (_, i) => h('div', {
		key: i, className: 'o-skel',
		style: { width: `${[96, 74, 88, 62, 80][i % 5]}%`, height: i === 0 ? '11px' : '9px' },
	})),
	h('div', { style: { fontSize: '11px', color: 'var(--o-faint)', animation: 'o-breathe 1.6s ease-in-out infinite' } }, text),
);

/** 空状态：给一个「下一步做什么」的引导，而不是干瘪一行字。 */
export const Empty = ({ glyph = '☯', title, hint = null }) => h('div', { className: 'o-empty' },
	h('div', { className: 'o-empty-glyph' }, glyph),
	h('div', { className: 'o-empty-text' }, title),
	hint ? h('div', { style: { fontSize: '10.5px', opacity: .75, lineHeight: 1.6 } }, hint) : null,
);

/** 错误条。 */
export const ErrorBar = ({ children }) => h('div', { className: 'o-error' },
	h('span', { style: { fontFamily: 'var(--o-serif)', fontSize: '13px', lineHeight: 1.2 } }, '⚠'),
	h('span', { style: { flex: '1 1 auto', whiteSpace: 'pre-wrap' } }, children),
);

/** 备注行（时间口径、流派说明这类「必须让用户看见但不抢戏」的信息）。 */
export const Notes = ({ items }) => {
	const list = (items ?? []).filter(Boolean);
	if (list.length === 0) return null;
	return h('div', { className: 'o-note', style: { display: 'flex', flexDirection: 'column', gap: '1px' } },
		list.map((n, i) => h('div', { key: i, className: 'o-note-lead' }, `ℹ ${n}`)),
	);
};

export const Divider = () => h('hr', { className: 'o-divider' });

/** 免责声明页脚：全插件统一措辞由引擎给，这里只负责排得像「页脚」。 */
export const FooterNote = ({ children }) => h('div', { className: 'o-disclaimer', style: { paddingTop: '2px' } }, children);

/** 五行 → 色（传统色相，但调到两边主题都可读的明度）。 */
export const WUXING_COLOR = {
	金: '#d9b26a',
	木: '#6fb583',
	水: '#62a3d8',
	火: '#e0746a',
	土: '#c09070',
};

/** 徽章色调映射：把引擎的语义吉凶映射到设计令牌。 */
export const toneOf = (t) => (t === '吉' ? 'good' : t === '凶' ? 'bad' : t === '中性' ? null : 'accent');
