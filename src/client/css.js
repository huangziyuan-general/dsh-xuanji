// src/client/css.js — 面板设计系统：设计令牌 + 组件皮肤 + 动效。
//
// 为什么全部走样式表而不是内联 style：内联给不出 :hover / :active / :focus-visible
// 与 @keyframes，而这些恰是「看起来像正经产品」的主要成分。
//
// ★ 主题自适应策略（重要，别改回硬编码色值）
//   面板不知道宿主是深是浅，也不能假设。所有表面色/描边/弱化文字都用
//   `color-mix(in srgb, currentColor N%, transparent)`：宿主的 text color 是什么，
//   我们的表面就自动跟到哪个色调上——深色宿主得到暗卡片，浅色宿主得到浅卡片，一套代码两边都成立。
//   只有「品牌色」与「五行色」这类语义色是固定值（它们不参与明暗翻转）。
//
// 面板被宿主反复装配，样式表必须查到就收养（全局单例，不重复注入、不回收）。

/** 面板根标记属性（点击代理/样式选择器的锚点）。 */
export const PANEL_ATTR = 'data-xuanji-panel';

export const STYLE_ID = 'dsh-xuanji-panel-styles';

/**
 * 样式文本（测试要验证规则齐全与注入单例）。
 * @param {string} attr 面板根属性
 * @param {string} id 样式表 id
 */
export const buildCss = (attr = PANEL_ATTR, id = STYLE_ID) => `
/* ═══════════════════════════ ① 设计令牌 ═══════════════════════════ */
[${attr}] {
  --o-surface:      color-mix(in srgb, currentColor 5%, transparent);
  --o-surface-2:    color-mix(in srgb, currentColor 8%, transparent);
  --o-surface-3:    color-mix(in srgb, currentColor 12%, transparent);
  --o-border:       color-mix(in srgb, currentColor 13%, transparent);
  --o-border-2:     color-mix(in srgb, currentColor 22%, transparent);
  --o-text:         currentColor;
  --o-muted:        color-mix(in srgb, currentColor 68%, transparent);
  --o-faint:        color-mix(in srgb, currentColor 46%, transparent);
  --o-ghost:        color-mix(in srgb, currentColor 30%, transparent);

  /* 品牌 / 语义色（固定值，不随主题翻转） */
  --o-accent:       #7ee7d8;
  --o-accent-deep:  #2f9c8b;
  --o-gold:         #d9b26a;
  --o-danger:       #e06c63;
  --o-warn:         #d9a05b;
  --o-lucky:        #6fb583;

  /* 半径 / 阴影 / 动效 */
  --o-r-sm: 6px;
  --o-r-md: 9px;
  --o-r-lg: 13px;
  --o-shadow: 0 1px 2px color-mix(in srgb, currentColor 8%, transparent);
  --o-ease: cubic-bezier(.22,.68,.42,1);

  /* 字体：正文用系统 UI 栈，命理大字走衬线（宋体一类），在两边主题里都稳 */
  --o-font: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", system-ui, -apple-system, "Segoe UI", sans-serif;
  --o-serif: "Songti SC", "STSong", "Noto Serif CJK SC", "Source Han Serif SC", "SimSun", Georgia, serif;
  --o-mono: ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace;

  color: inherit;
  font-family: var(--o-font);
}

/* ═══════════════════════════ ② 布局骨架 ═══════════════════════════ */
[${attr}].o-root {
  display: flex;
  flex-direction: column;
  gap: 11px;
  height: 100%;
  box-sizing: border-box;
  padding: 13px 12px 14px;
  font-size: 12.5px;
  line-height: 1.62;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-width: thin;
  -webkit-font-smoothing: antialiased;
}

/* 品牌头部：一行式，左侧是卦象符号，右侧是版本徽标 */
.o-brand {
  display: flex; align-items: center; gap: 9px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--o-border);
}
.o-brand-mark {
  width: 30px; height: 30px; flex: 0 0 30px;
  display: flex; align-items: center; justify-content: center;
  border-radius: 9px;
  font-family: var(--o-serif);
  font-size: 15px;
  color: var(--o-gold);
  background: radial-gradient(circle at 32% 26%,
    color-mix(in srgb, var(--o-gold) 22%, transparent),
    color-mix(in srgb, currentColor 7%, transparent) 72%);
  border: 1px solid color-mix(in srgb, var(--o-gold) 26%, transparent);
  box-shadow: inset 0 0 12px color-mix(in srgb, var(--o-gold) 12%, transparent);
}
.o-brand-text { min-width: 0; flex: 1 1 auto; }
.o-brand-name {
  display: flex; align-items: center; gap: 6px;
  font-size: 13.5px; font-weight: 600; letter-spacing: .5px;
}
.o-brand-sub {
  font-size: 10.5px; color: var(--o-faint);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.o-chip {
  font-size: 9.5px; line-height: 1.5; padding: 0 5px;
  border-radius: 5px; color: var(--o-faint);
  border: 1px solid var(--o-border);
  font-family: var(--o-mono);
}

/* ═══════════════════════════ ③ 导航 ═══════════════════════════ */
.o-nav {
  /* 自适应列数：九页时排 3×3，十页（含六爻）时自动排成两行，不再留孤零零一个空位 */
  display: grid; grid-template-columns: repeat(auto-fit, minmax(58px, 1fr)); gap: 3px; padding: 3px;
  background: var(--o-surface);
  border: 1px solid var(--o-border);
  border-radius: 11px;
}
.o-tab {
  display: flex; flex-direction: column; align-items: center; gap: 1px;
  padding: 4px 1px 3px;
  border: 0; border-radius: 8px;
  background: transparent; color: var(--o-muted);
  font-family: inherit; font-size: 11px; font-weight: 500;
  cursor: pointer; position: relative;
  transition: background .16s var(--o-ease), color .16s var(--o-ease);
}
.o-tab:hover { background: var(--o-surface-2); color: var(--o-text); }
.o-tab[aria-selected="true"] {
  background: var(--o-surface-3);
  color: var(--o-text);
  box-shadow: var(--o-shadow);
}
.o-tab-glyph { font-size: 12px; line-height: 1.1; font-family: var(--o-serif); }
.o-tab-label { font-size: 10px; white-space: nowrap; }
.o-tab[aria-selected="true"]::after {
  content: ""; position: absolute; left: 50%; bottom: 1px;
  width: 13px; height: 2px; margin-left: -6.5px;
  border-radius: 2px; background: var(--o-accent);
}

/* ═══════════════════════════ ④ 卡片 / 分区 ═══════════════════════════ */
.o-card {
  background: var(--o-surface);
  border: 1px solid var(--o-border);
  border-radius: var(--o-r-lg);
  padding: 11px 12px;
  animation: o-rise .26s var(--o-ease) both;
}
.o-card + .o-card { margin-top: 9px; }
.o-card-accent {
  border-color: color-mix(in srgb, var(--o-accent) 32%, var(--o-border));
  background: linear-gradient(160deg,
    color-mix(in srgb, var(--o-accent) 6%, transparent), var(--o-surface) 62%);
}
.o-card-gold {
  border-color: color-mix(in srgb, var(--o-gold) 30%, var(--o-border));
  background: linear-gradient(160deg,
    color-mix(in srgb, var(--o-gold) 7%, transparent), var(--o-surface) 62%);
}

.o-section-title {
  display: flex; align-items: center; gap: 6px;
  font-size: 10.5px; font-weight: 600; letter-spacing: .9px;
  color: var(--o-faint);
  margin-bottom: 8px;
}
.o-section-title::before {
  content: ""; width: 2.5px; height: 11px; border-radius: 2px;
  background: var(--o-accent); opacity: .75; flex: 0 0 2.5px;
}
.o-divider { height: 1px; background: var(--o-border); border: 0; margin: 10px 0; }

/* ═══════════════════════════ ⑤ 表单 ═══════════════════════════ */
.o-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.o-label {
  font-size: 10px; color: var(--o-faint);
  letter-spacing: .4px; padding-left: 1px;
}
.o-grid { display: grid; gap: 8px; }
.o-row { display: flex; flex-wrap: wrap; gap: 7px; align-items: flex-end; }

[${attr}] input[${attr}-input], [${attr}] select[${attr}-input], [${attr}] textarea[${attr}-input] {
  width: 100%; box-sizing: border-box;
  background: var(--o-surface-2);
  color: var(--o-text);
  border: 1px solid var(--o-border);
  border-radius: var(--o-r-sm);
  padding: 5px 7px;
  font-family: inherit; font-size: 12.5px;
  transition: border-color .16s var(--o-ease), background .16s var(--o-ease), box-shadow .16s var(--o-ease);
}
[${attr}] input[${attr}-input]::placeholder { color: var(--o-ghost); }
[${attr}] input[${attr}-input]:hover, [${attr}] select[${attr}-input]:hover { border-color: var(--o-border-2); }
[${attr}] input[${attr}-input]:focus, [${attr}] select[${attr}-input]:focus, [${attr}] textarea[${attr}-input]:focus {
  outline: none;
  border-color: color-mix(in srgb, var(--o-accent) 58%, transparent);
  box-shadow: 0 0 0 2.5px color-mix(in srgb, var(--o-accent) 15%, transparent);
  background: var(--o-surface-3);
}
[${attr}] select[${attr}-input] { cursor: pointer; }
[${attr}] textarea[${attr}-input] { resize: vertical; min-height: 46px; line-height: 1.55; }

/* 时辰等「小步进」输入：把原生箭头换成视觉一致的组 */
.o-stepper { display: flex; align-items: center; gap: 4px; }
.o-stepper-btn {
  width: 21px; height: 21px; flex: 0 0 21px;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--o-border); border-radius: 5px;
  background: var(--o-surface-2); color: var(--o-muted);
  font-size: 12px; line-height: 1; cursor: pointer; padding: 0;
  transition: background .14s var(--o-ease), color .14s var(--o-ease);
}
.o-stepper-btn:hover { background: var(--o-surface-3); color: var(--o-text); }

/* 分段控件（性别 / 模式切换） */
.o-seg {
  display: inline-flex; padding: 2px; gap: 2px;
  background: var(--o-surface-2);
  border: 1px solid var(--o-border); border-radius: 9px;
}
.o-seg-item {
  padding: 3px 11px; border: 0; border-radius: 7px;
  background: transparent; color: var(--o-muted);
  font-family: inherit; font-size: 11.5px; cursor: pointer;
  transition: background .16s var(--o-ease), color .16s var(--o-ease);
}
.o-seg-item[aria-pressed="true"] {
  background: var(--o-surface-3); color: var(--o-text);
  box-shadow: var(--o-shadow); font-weight: 600;
}

/* 复选框（闰月）：原生 checkbox 在两种主题下都会掉成系统灰，自己画一枚 */
.o-check {
  display: inline-flex; align-items: center; gap: 5px;
  font-size: 11px; color: var(--o-muted); cursor: pointer;
  user-select: none;
}
.o-check input[type="checkbox"] {
  appearance: none; -webkit-appearance: none;
  width: 14px; height: 14px; flex: 0 0 14px; margin: 0;
  border: 1px solid var(--o-border-2); border-radius: 4px;
  background: var(--o-surface-2); cursor: pointer;
  display: grid; place-content: center;
  transition: background .14s var(--o-ease), border-color .14s var(--o-ease);
}
.o-check input[type="checkbox"]:checked {
  background: color-mix(in srgb, var(--o-gold) 26%, var(--o-surface-2));
  border-color: color-mix(in srgb, var(--o-gold) 55%, transparent);
}
.o-check input[type="checkbox"]:checked::after {
  content: ""; width: 5px; height: 8px;
  border: solid var(--o-gold); border-width: 0 1.6px 1.6px 0;
  transform: translateY(-1px) rotate(42deg);
}

/* ═══════════════════════════ ⑥ 按钮 ═══════════════════════════ */
[${attr}] button[data-xuanji-btn] {
  cursor: pointer;
  font-family: inherit;
  font-size: 12px;
  border-radius: var(--o-r-md);
  border: 1px solid var(--o-border-2);
  background: var(--o-surface-2);
  color: var(--o-text);
  padding: 6px 15px;
  transition: background .16s var(--o-ease), border-color .16s var(--o-ease), color .16s var(--o-ease), transform .1s var(--o-ease);
}
[${attr}] button[data-xuanji-btn]:hover:not(:disabled) {
  background: var(--o-surface-3);
  border-color: color-mix(in srgb, currentColor 30%, transparent);
}
[${attr}] button[data-xuanji-btn]:active:not(:disabled) { transform: translateY(.5px); }
[${attr}] button[data-xuanji-btn]:focus-visible {
  outline: none;
  box-shadow: 0 0 0 2.5px color-mix(in srgb, var(--o-accent) 22%, transparent);
}
[${attr}] button[data-xuanji-btn][data-variant="primary"] {
  background: var(--o-accent-deep);
  border-color: color-mix(in srgb, var(--o-accent-deep) 76%, transparent);
  color: #fff; font-weight: 600;
  box-shadow: 0 1px 3px color-mix(in srgb, var(--o-accent-deep) 26%, transparent);
}
[${attr}] button[data-xuanji-btn][data-variant="primary"]:hover:not(:disabled) {
  background: color-mix(in srgb, var(--o-accent-deep) 88%, #fff);
}
[${attr}] button[data-xuanji-btn][data-variant="ghost"] {
  background: transparent; border-color: transparent; color: var(--o-muted);
}
[${attr}] button[data-xuanji-btn][data-variant="ghost"]:hover:not(:disabled) {
  background: var(--o-surface-2); color: var(--o-text);
}
[${attr}] button[data-xuanji-btn]:disabled { opacity: .45; cursor: default; }

/* ═══════════════════════════ ⑦ 徽章 / 标签 ═══════════════════════════ */
.o-badge {
  display: inline-flex; align-items: center; gap: 3px;
  font-size: 10.5px; line-height: 1.5; padding: 1.5px 7px;
  border-radius: 999px;
  border: 1px solid var(--o-border-2);
  background: var(--o-surface-2);
  color: var(--o-muted);
  white-space: nowrap;
}
.o-badge.is-good  { color: var(--o-lucky);  border-color: color-mix(in srgb, var(--o-lucky) 40%, transparent); background: color-mix(in srgb, var(--o-lucky) 10%, transparent); }
.o-badge.is-bad   { color: var(--o-danger); border-color: color-mix(in srgb, var(--o-danger) 40%, transparent); background: color-mix(in srgb, var(--o-danger) 10%, transparent); }
.o-badge.is-warn  { color: var(--o-warn);   border-color: color-mix(in srgb, var(--o-warn) 40%, transparent);  background: color-mix(in srgb, var(--o-warn) 10%, transparent); }
.o-badge.is-gold  { color: var(--o-gold);   border-color: color-mix(in srgb, var(--o-gold) 40%, transparent);  background: color-mix(in srgb, var(--o-gold) 10%, transparent); }
.o-badge.is-accent{ color: var(--o-accent); border-color: color-mix(in srgb, var(--o-accent) 40%, transparent); background: color-mix(in srgb, var(--o-accent) 10%, transparent); }
.o-badges { display: flex; flex-wrap: wrap; gap: 4px; }

/* ═══════════════════════════ ⑧ 数据展示 ═══════════════════════════ */
/* 命理大字：干支 / 卦象 / 骨重，用衬线体，这是「看起来专业」的关键一笔 */
.o-glyph {
  font-family: var(--o-serif);
  letter-spacing: 2.5px;
  font-size: 25px; line-height: 1.12; font-weight: 500;
}
.o-glyph-sm { font-family: var(--o-serif); font-size: 17px; letter-spacing: 1.5px; }

.o-stat-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(62px, 1fr)); gap: 7px; }
.o-stat {
  background: var(--o-surface-2);
  border: 1px solid var(--o-border);
  border-radius: var(--o-r-md);
  padding: 7px 8px; text-align: center;
}
.o-stat-k { font-size: 9.5px; color: var(--o-faint); letter-spacing: .5px; }
.o-stat-v { font-size: 15px; font-family: var(--o-serif); margin-top: 1px; }
.o-stat-note { font-size: 9.5px; color: var(--o-ghost); }

.o-bar-track {
  background: var(--o-surface-2); border-radius: 3px;
  height: 7px; overflow: hidden;
  border: 1px solid color-mix(in srgb, currentColor 6%, transparent);
}
.o-bar-fill {
  height: 100%; border-radius: 3px;
  transition: width .5s var(--o-ease);
}
.o-bars { display: grid; grid-template-columns: 22px 1fr 26px; gap: 5px 7px; align-items: center; }

.o-kv { display: grid; grid-template-columns: auto 1fr; gap: 3px 10px; font-size: 11.5px; }
.o-kv-k { color: var(--o-faint); white-space: nowrap; }
.o-kv-v { color: var(--o-text); }

.o-note { font-size: 10.5px; color: var(--o-faint); line-height: 1.65; }
.o-note-lead { color: var(--o-muted); }
.o-disclaimer { font-size: 10px; color: var(--o-ghost); line-height: 1.7; }

/* ═══════════════════════════ ⑨ 状态：加载 / 空 / 错误 ═══════════════════════════ */
.o-loading { display: flex; flex-direction: column; gap: 7px; padding: 12px 0; }
.o-skel {
  height: 9px; border-radius: 5px;
  background: linear-gradient(90deg, var(--o-surface) 25%, var(--o-surface-3) 46%, var(--o-surface) 66%);
  background-size: 260% 100%;
  animation: o-shimmer 1.3s linear infinite;
}
.o-empty {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  padding: 22px 10px; text-align: center;
  color: var(--o-ghost);
}
.o-empty-glyph {
  font-family: var(--o-serif); font-size: 26px; opacity: .4;
  filter: saturate(.5);
}
.o-empty-text { font-size: 11.5px; line-height: 1.6; max-width: 230px; }

/* 错误条——要做到「看得见就知道下一步干什么」，而不是一行红字 */
.o-error {
  display: flex; gap: 7px; align-items: flex-start;
  padding: 8px 10px; border-radius: var(--o-r-md);
  border: 1px solid color-mix(in srgb, var(--o-danger) 34%, transparent);
  background: color-mix(in srgb, var(--o-danger) 9%, transparent);
  color: var(--o-danger);
  font-size: 11.5px; line-height: 1.6;
  animation: o-rise .2s var(--o-ease) both;
}

/* ═══════════════════════════ ⑩ 动效 ═══════════════════════════ */
@keyframes o-rise {
  from { opacity: 0; transform: translateY(5px); }
  to   { opacity: 1; transform: none; }
}
@keyframes o-shimmer {
  from { background-position: 130% 0; }
  to   { background-position: -30% 0; }
}
@keyframes o-fade {
  from { opacity: 0; } to { opacity: 1; }
}
@keyframes o-breathe {
  0%, 100% { opacity: .55; } 50% { opacity: 1; }
}
.o-anim-rise { animation: o-rise .26s var(--o-ease) both; }
.o-anim-fade { animation: o-fade .3s var(--o-ease) both; }

/* ── 塔罗翻牌（CSS 3D flip）：保留类名，皮肤换成令牌 ── */
.xuanji-tcard { perspective: 780px; cursor: pointer; }
.xuanji-tcard-inner {
  position: relative; width: 100%; height: 100%;
  transform-style: preserve-3d;
  transition: transform .62s var(--o-ease);
}
.xuanji-tcard.flipped .xuanji-tcard-inner { transform: rotateY(180deg); }
.xuanji-tface {
  position: absolute; inset: 0;
  backface-visibility: hidden; -webkit-backface-visibility: hidden;
  border-radius: var(--o-r-lg);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 10px 8px; text-align: center; box-sizing: border-box;
  border: 1px solid var(--o-border);
}
.xuanji-tback {
  background:
    radial-gradient(circle at 50% 34%, color-mix(in srgb, var(--o-gold) 15%, transparent), transparent 62%),
    var(--o-surface-2);
  color: var(--o-gold);
  border-color: color-mix(in srgb, var(--o-gold) 24%, transparent);
}
.xuanji-tfront {
  background: linear-gradient(165deg, var(--o-surface-2), var(--o-surface) 78%);
  color: var(--o-text);
  transform: rotateY(180deg);
}

@media (prefers-reduced-motion: reduce) {
  .o-card, .o-anim-rise, .o-anim-fade, .o-error { animation: none; }
  .o-skel { animation: none; }
  .xuanji-tcard-inner { transition: none; }
  .o-bar-fill { transition: none; }
}
`;

/** 注入交互态样式表（幂等：查到就收养）。 */
export function ensureStyles(doc = (typeof document !== 'undefined' ? document : null)) {
	if (!doc) return null;
	let el = doc.getElementById(STYLE_ID);
	if (el) return el;
	el = doc.createElement('style');
	el.id = STYLE_ID;
	el.textContent = buildCss();
	doc.head.appendChild(el);
	return el;
}
