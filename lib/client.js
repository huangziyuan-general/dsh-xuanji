// ⚠️ 自动生成，请勿直接编辑 —— 改 src/client/ 后跑 npm run build。
// 源码：src/client/index.js（+ forge-tab.js / panel.js / views/*）
// 本产物是经典脚本：dsh 的 client-modules 按 CJS factory 执行它。
window.__ModuleLoader__.load({
	id: "dsh-xuanji",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;

var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.js
var index_exports = {};
__export(index_exports, {
  PLUGIN_VERSION: () => PLUGIN_VERSION,
  __internals: () => __internals,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/forge-tab.js
var TAB_ID = "dsh-xuanji";
var TAB_KIND = "xuanji";
function tabDefinition() {
  return {
    id: TAB_ID,
    kind: TAB_KIND,
    priority: "extension",
    title: () => "🔮 玄机阁",
    guide: [{
      order: 91,
      title: () => "玄机阁",
      description: () => "人生K线图与每日塔罗（本地确定性排盘）"
    }]
  };
}
function registerXuanjiTab(ctx, Panel) {
  ctx.effect(
    () => ctx.sidebarRightTabs.register(tabDefinition()),
    "dsh-xuanji: 右侧栏 tab 类型"
  );
  ctx.effect(() => ctx.slots.inject("sidebar.right.pane.tab", () => ctx.slots.register({
    name: "sidebar.right.pane.tab",
    key: TAB_ID
  }, Panel)), "dsh-xuanji: 右侧栏 tab 内容");
}
function openXuanjiTab(ctx, opts = {}) {
  const timer = opts.timer ?? setTimeout;
  const log = opts.log ?? console;
  const maxTries = opts.maxTries ?? 120;
  let tries = 0;
  let opened = false;
  let disposed = false;
  const attempt = () => {
    if (disposed || opened) return true;
    try {
      ctx.sidebarRight.openTab(TAB_KIND);
      opened = true;
      log.info("[dsh-xuanji] 已打开右侧栏 tab（玄机阁）");
      return true;
    } catch (error) {
      tries += 1;
      if (tries < maxTries) {
        timer(attempt, 250);
      } else {
        log.warn("[dsh-xuanji] 自动打开右侧栏 tab 失败，可从右侧栏 guide 页手动进入", error);
      }
      return false;
    }
  };
  timer(attempt, 400);
  return () => {
    disposed = true;
  };
}

// src/client/react.js
var reactNamespace = __toESM(require("react"), 1);
function pickFunction(namespace, name) {
  if (!namespace) return void 0;
  if (typeof namespace[name] === "function") return namespace[name];
  const wrapped = namespace.default;
  if (wrapped && typeof wrapped[name] === "function") return wrapped[name];
  return void 0;
}
function pickValue(namespace, name) {
  if (!namespace) return void 0;
  if (namespace[name] !== void 0) return namespace[name];
  const wrapped = namespace.default;
  return wrapped ? wrapped[name] : void 0;
}
var createElement = pickFunction(reactNamespace, "createElement");
var h = createElement;
var Fragment = pickValue(reactNamespace, "Fragment");
var Component = pickValue(reactNamespace, "Component");
var useState = pickFunction(reactNamespace, "useState");
var useRef = pickFunction(reactNamespace, "useRef");
var useEffect = pickFunction(reactNamespace, "useEffect");

// src/client/api.js
var API_BASE = "/api/xuanji";
var FENCE = "x-dsh-xuanji";
var FETCH_TIMEOUT_MS = 12e3;
async function apiFetch(path) {
  const timeoutMs = FETCH_TIMEOUT_MS;
  const ac = typeof AbortController === "function" && timeoutMs > 0 ? new AbortController() : null;
  const timer = ac ? setTimeout(() => ac.abort(), timeoutMs) : null;
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      signal: ac?.signal,
      headers: { [FENCE]: "1" }
    });
  } catch (error) {
    const aborted = error?.name === "AbortError";
    if (aborted) {
      throw new Error(`请求超时：${path}（${Math.round(timeoutMs / 1e3)} 秒无响应，服务可能没起或被浏览器扩展/代理拦截）`);
    }
    throw new Error(`网络错误：${String(error?.message ?? error)}`);
  } finally {
    if (timer) clearTimeout(timer);
  }
  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`响应不是 JSON（HTTP ${response.status}）—— 页面可能过期，硬刷新（Cmd+Shift+R）后再试`);
  }
  if (!payload.ok) {
    const err = new Error(payload.error?.message ?? `HTTP ${response.status}`);
    err.code = payload.error?.code ?? "";
    err.status = response.status;
    throw err;
  }
  return payload.value;
}

// src/client/css.js
var PANEL_ATTR = "data-xuanji-panel";
var STYLE_ID = "dsh-xuanji-panel-styles";
var buildCss = (attr = PANEL_ATTR, id = STYLE_ID) => `
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
  display: flex; gap: 3px; padding: 3px;
  background: var(--o-surface);
  border: 1px solid var(--o-border);
  border-radius: 11px;
}
.o-tab {
  flex: 1 1 0; min-width: 0;
  display: flex; flex-direction: column; align-items: center; gap: 1px;
  padding: 5px 2px 4px;
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
.o-tab-glyph { font-size: 13px; line-height: 1.1; font-family: var(--o-serif); }
.o-tab-label { font-size: 10.5px; white-space: nowrap; }
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
function ensureStyles(doc = typeof document !== "undefined" ? document : null) {
  if (!doc) return null;
  let el = doc.getElementById(STYLE_ID);
  if (el) return el;
  el = doc.createElement("style");
  el.id = STYLE_ID;
  el.textContent = buildCss();
  doc.head.appendChild(el);
  return el;
}

// src/client/views/trend-chart.js
var W = 340;
var H = 210;
var PAD_L = 26;
var PAD_R = 10;
var PAD_T = 16;
var PAD_B = 22;
var UP_COLOR = "#e0645c";
var DOWN_COLOR = "#4fa877";
var MA5_COLOR = "#d9b26a";
var MA10_COLOR = "#6ea8dc";
var AXIS_COLOR = "#888780";
var TEXT_COLOR = "#8b91a0";
var SEG_LINE = "rgba(136,135,128,.5)";
var clamp01 = (v) => Math.max(0, Math.min(100, v));
var yOf = (v) => PAD_T + (100 - clamp01(v)) * (H - PAD_T - PAD_B) / 100;
function movingAverage(values, win) {
  return values.map((_, i) => i + 1 < win ? null : values.slice(i + 1 - win, i + 1).reduce((a, b) => a + b, 0) / win);
}
function pathOf(ys, xOf) {
  let d = "";
  let pen = false;
  for (let i = 0; i < ys.length; i++) {
    const y = ys[i];
    if (y === null || y === void 0) {
      pen = false;
      continue;
    }
    d += `${pen ? "L" : "M"}${xOf(i).toFixed(2)} ${yOf(y).toFixed(2)}`;
    pen = true;
  }
  return d || null;
}
function buildTrendSpec(points, segments = []) {
  if (!Array.isArray(points) || points.length === 0) return null;
  const innerW = W - PAD_L - PAD_R;
  const step = innerW / points.length;
  const xOf = (i) => PAD_L + (i + 0.5) * step;
  const candles = points.map((p, i) => {
    const { open, close, high, low } = p.kline;
    const up = close >= open;
    const yO = yOf(open);
    const yC = yOf(close);
    return {
      x: +xOf(i).toFixed(2),
      up,
      score: p.score,
      wick: { y1: +yOf(high).toFixed(2), y2: +yOf(low).toFixed(2) },
      body: { y: +Math.min(yO, yC).toFixed(2), h: +Math.max(1.2, Math.abs(yO - yC)).toFixed(2) },
      title: `${p.age}岁（${p.year}，${p.ganZhi}）：${p.score}分${p.dayunGanZhi ? ` · 大运${p.dayunGanZhi}` : ""}`
    };
  });
  const segLines = [];
  const segBands = [];
  for (const s of segments) {
    const startIdx = points.findIndex((p) => p.age === s.startAge);
    if (startIdx === -1) continue;
    const endIdx = points.findIndex((p) => p.age === s.endAge);
    const to = endIdx === -1 ? points.length - 1 : endIdx;
    if (startIdx > 0) segLines.push({ x: +xOf(startIdx - 0.5).toFixed(2), label: s.ganZhi });
    segBands.push({ x0: +xOf(startIdx - 0.5).toFixed(2), x1: +xOf(to + 0.5).toFixed(2), label: s.ganZhi });
  }
  const hi = points.reduce((a, p) => p.score > a.score ? p : a, points[0]);
  const lo = points.reduce((a, p) => p.score < a.score ? p : a, points[0]);
  const hiIdx = points.indexOf(hi);
  const loIdx = points.indexOf(lo);
  const scores = points.map((p) => p.score);
  const marks = [0, Math.floor(points.length / 2), points.length - 1].filter((v, i, a) => a.indexOf(v) === i);
  return {
    w: W,
    h: H,
    padL: PAD_L,
    padB: PAD_B,
    candles,
    // `segs` 是既有契约名（面板与测试都读它），新增的 segBands 是分段底色。
    segs: segLines,
    segLines,
    segBands,
    xLabels: marks.map((i) => ({ x: +xOf(i).toFixed(2), text: `${points[i].age}岁` })),
    yTicks: [0, 25, 50, 75, 100].map((v) => ({ v, y: +yOf(v).toFixed(2), major: v === 50 })),
    ma5: pathOf(movingAverage(scores, 5), xOf),
    ma10: pathOf(movingAverage(scores, 10), xOf),
    peak: { x: +xOf(hiIdx).toFixed(2), y: +yOf(hi.score).toFixed(2), label: `${hi.age}岁 ${hi.score}`, below: false },
    trough: { x: +xOf(loIdx).toFixed(2), y: +yOf(lo.score).toFixed(2), label: `${lo.age}岁 ${lo.score}`, below: true }
  };
}
function renderTrendSvg(spec, h2) {
  if (!spec) return null;
  const { w, h: hh, padL, candles, segLines, segBands, xLabels, yTicks } = spec;
  const plotW = w - padL - 10;
  const bodyW = Math.max(1.1, plotW / candles.length * 0.6);
  return h2(
    "svg",
    {
      viewBox: `0 0 ${w} ${hh}`,
      width: "100%",
      role: "img",
      "aria-label": "人生K线蜡烛图：逐年分数与大运分段",
      style: { display: "block", overflow: "visible" }
    },
    h2(
      "defs",
      null,
      h2(
        "linearGradient",
        { id: "xuanji-up", x1: "0", y1: "0", x2: "0", y2: "1" },
        h2("stop", { offset: "0%", "stop-color": UP_COLOR, "stop-opacity": ".18" }),
        h2("stop", { offset: "100%", "stop-color": UP_COLOR, "stop-opacity": "0" })
      ),
      h2(
        "linearGradient",
        { id: "xuanji-down", x1: "0", y1: "0", x2: "0", y2: "1" },
        h2("stop", { offset: "0%", "stop-color": DOWN_COLOR, "stop-opacity": ".18" }),
        h2("stop", { offset: "100%", "stop-color": DOWN_COLOR, "stop-opacity": "0" })
      )
    ),
    // 大运交替底色（先画，压在最底层）
    segBands.map((b, i) => i % 2 === 0 ? null : h2("rect", {
      key: `band${i}`,
      x: b.x0,
      y: PAD_T - 4,
      width: Math.max(0.5, b.x1 - b.x0),
      height: hh - PAD_T - PAD_B + 4,
      fill: "#888780",
      opacity: ".06"
    })),
    // 横向刻度网格
    yTicks.map((t) => h2(
      "g",
      { key: `y${t.v}` },
      h2("line", {
        x1: padL,
        x2: w - 10,
        y1: t.y,
        y2: t.y,
        stroke: AXIS_COLOR,
        "stroke-width": t.major ? 0.7 : 0.4,
        "stroke-dasharray": t.major ? "3 3" : "1 4",
        opacity: t.major ? 0.9 : 0.6
      }),
      h2("text", { x: padL - 3, y: t.y + 2.6, "text-anchor": "end", "font-size": 6.5, fill: TEXT_COLOR }, String(t.v))
    )),
    // 大运分隔竖线 + 段名
    segLines.map((s, i) => h2(
      "g",
      { key: `s${i}` },
      h2("line", { x1: s.x, x2: s.x, y1: PAD_T - 4, y2: hh - PAD_B, stroke: SEG_LINE, "stroke-width": 0.5, "stroke-dasharray": "2 2" }),
      h2("text", { x: s.x + 1.5, y: 9.5, "font-size": 6.5, fill: "#a7adba", opacity: 0.85 }, s.label)
    )),
    // 蜡烛：影线 + 实体
    candles.map((c, i) => h2(
      "g",
      { key: `c${i}` },
      h2("title", null, c.title),
      h2("line", { x1: c.x, x2: c.x, y1: c.wick.y1, y2: c.wick.y2, stroke: c.up ? UP_COLOR : DOWN_COLOR, "stroke-width": 0.7, opacity: 0.85 }),
      h2("rect", {
        x: +(c.x - bodyW / 2).toFixed(2),
        y: c.body.y,
        width: +bodyW.toFixed(2),
        height: c.body.h,
        fill: c.up ? UP_COLOR : DOWN_COLOR,
        opacity: 0.92,
        rx: 0.4
      })
    )),
    // 均线
    spec.ma10 ? h2("path", { d: spec.ma10, fill: "none", stroke: MA10_COLOR, "stroke-width": 0.9, "stroke-linejoin": "round", opacity: 0.8 }) : null,
    spec.ma5 ? h2("path", { d: spec.ma5, fill: "none", stroke: MA5_COLOR, "stroke-width": 1.1, "stroke-linejoin": "round" }) : null,
    // 极值引出标记
    [
      [pit(spec.peak), UP_COLOR, -6],
      [pit(spec.trough), DOWN_COLOR, 12]
    ].map(([p, color, dy], i) => p ? h2(
      "g",
      { key: `pk${i}` },
      h2("circle", { cx: p.x, cy: p.y, r: 1.9, fill: color }),
      h2("circle", { cx: p.x, cy: p.y, r: 3.6, fill: "none", stroke: color, "stroke-width": 0.5, opacity: 0.55 }),
      h2("text", {
        x: Math.min(Math.max(p.x, padL + 12), w - 22),
        y: p.y + dy,
        "text-anchor": "middle",
        "font-size": 6.8,
        fill: color,
        fontWeight: "500"
      }, p.label)
    ) : null),
    // 年龄刻度
    xLabels.map((l, i) => h2("text", {
      key: `x${i}`,
      x: l.x,
      y: hh - 7,
      "text-anchor": "middle",
      "font-size": 6.5,
      fill: TEXT_COLOR
    }, l.text))
  );
}
function pit(p) {
  return p && Number.isFinite(p.x) && Number.isFinite(p.y) ? p : null;
}

// src/client/views/ui.js
var SectionTitle = ({ children, right = null }) => h(
  "div",
  { className: "o-section-title" },
  h("span", { style: { flex: "1 1 auto", minWidth: 0 } }, children),
  right
);
var Card = ({ title = null, tone = null, right = null, children }) => h(
  "div",
  {
    className: `o-card${tone === "accent" ? " o-card-accent" : tone === "gold" ? " o-card-gold" : ""}`
  },
  title ? h(SectionTitle, { right }, title) : null,
  children
);
var Field = ({ label, children, grow = 1, span = 0 }) => h(
  "div",
  {
    className: "o-field",
    style: {
      // span：在 o-grid（grid 布局）里跨几列；grow：在 flex 行里占几份。两套布局各取所需。
      ...span > 0 ? { gridColumn: `span ${span}` } : {},
      ...grow > 0 ? { flex: `${grow} 1 0`, minWidth: `${grow * 52}px` } : { flex: "0 0 auto" }
    }
  },
  h("span", { className: "o-label" }, label),
  children
);
var Input = ({ tf, placeholder, width = null, inputMode = null, type = "text", defaultValue = "", max = null, min = null }) => h("input", {
  "data-xuanji-panel-input": "1",
  "data-tf": tf,
  type,
  placeholder,
  inputMode,
  defaultValue,
  className: "xuanji-input",
  ...max !== null ? { max } : {},
  ...min !== null ? { min } : {},
  ...width ? { style: { width } } : {}
});
var Select = ({ tf, options, defaultValue = "" }) => h("select", {
  "data-xuanji-panel-input": "1",
  "data-tf": tf,
  defaultValue
}, options.map(([value, label]) => h("option", { key: value, value }, label)));
var HOUR_ZHI = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
function hourToZhi(hour) {
  return HOUR_ZHI[Math.floor((Number(hour) + 1) % 24 / 2)];
}
var HOUR_OPTIONS = [
  ["", "不知道时辰（留空）"],
  ...Array.from({ length: 24 }, (_, h2) => [
    String(h2),
    `${String(h2).padStart(2, "0")} 时 · ${hourToZhi(h2)}时`
  ])
];
var HourSelect = ({ tf = "hour", defaultValue = "" }) => Select({
  tf,
  options: HOUR_OPTIONS,
  defaultValue: defaultValue ?? ""
});
var Seg = ({ tf, options, defaultValue, disabled = false }) => h(
  "div",
  {
    className: "o-seg",
    "data-seg": tf,
    "data-value": defaultValue,
    ...disabled ? { "data-disabled": "1" } : {}
  },
  h("input", { type: "hidden", "data-xuanji-panel-input": "1", "data-tf": tf, defaultValue }),
  options.map(([value, label]) => h("button", {
    key: value,
    type: "button",
    className: "o-seg-item",
    "aria-pressed": value === defaultValue ? "true" : "false",
    "data-seg-value": value
  }, label))
);
var CalendarSeg = ({ defaultValue = "solar" }) => Seg({
  tf: "calendar",
  defaultValue,
  options: [["solar", "公历"], ["lunar", "农历"]]
});
var LeapCheck = ({ checked = false }) => h(
  "label",
  { className: "o-check", title: "闰月不是每年都有，勾错等于换了一个月" },
  h("input", {
    type: "checkbox",
    "data-xuanji-panel-input": "1",
    "data-tf": "isLeapMonth",
    defaultChecked: checked
  }),
  h("span", null, "闰月")
);
var CalendarField = ({ calendar = "solar", leap = false }) => h(
  Field,
  { label: "历法", grow: 0 },
  h(
    "div",
    { style: { display: "flex", gap: "7px", alignItems: "center" } },
    CalendarSeg({ defaultValue: calendar }),
    calendar === "lunar" ? LeapCheck({ checked: leap }) : null
  )
);
var calendarHint = (calendar) => calendar === "lunar" ? "按农历填（年份以正月初一为界，不是公历年）；闰月请勾「闰月」——平月与闰月四柱不同。" : "按公历（阳历）填；如果你记的是农历生日，切到「农历」再填。";
var Badge = ({ tone = null, title = null, children }) => h("span", {
  className: `o-badge${tone ? ` is-${tone}` : ""}`,
  ...title ? { title } : {}
}, children);
var Badges = ({ children }) => h("div", { className: "o-badges" }, children);
var Glyph = ({ children, small = false, tone = null }) => h("div", {
  className: small ? "o-glyph-sm" : "o-glyph",
  ...tone ? { style: { color: `var(--o-${tone})` } } : {}
}, children);
var StatGrid = ({ items }) => h(
  "div",
  { className: "o-stat-grid" },
  items.map((it, i) => h(
    "div",
    { key: i, className: "o-stat" },
    h("div", { className: "o-stat-k" }, it.k),
    h("div", { className: "o-stat-v" }, it.v),
    it.note ? h("div", { className: "o-stat-note" }, it.note) : null
  ))
);
var Bars = ({ items, showValue = true }) => h(
  "div",
  { className: "o-bars" },
  items.flatMap((it, i) => [
    h("div", { key: `${i}k`, style: { fontSize: "11px", color: it.color } }, it.label),
    h(
      "div",
      { key: `${i}t`, className: "o-bar-track" },
      h("div", { className: "o-bar-fill", style: { width: `${Math.round(it.value / it.max * 100)}%`, background: it.color } })
    ),
    h(
      "div",
      { key: `${i}v`, style: { fontSize: "10px", color: "var(--o-faint)", textAlign: "right", fontFamily: "var(--o-mono)" } },
      showValue ? String(it.value) : ""
    )
  ])
);
var KV = ({ rows }) => h(
  "div",
  { className: "o-kv" },
  rows.filter(([, v]) => v !== null && v !== void 0 && v !== "").flatMap(([k, v], i) => [
    h("div", { key: `${i}k`, className: "o-kv-k" }, k),
    h("div", { key: `${i}v`, className: "o-kv-v" }, v)
  ])
);
var Loading = ({ lines = 3, text = "本地排盘中…" }) => h(
  "div",
  { className: "o-loading" },
  Array.from({ length: lines }, (_, i) => h("div", {
    key: i,
    className: "o-skel",
    style: { width: `${[96, 74, 88, 62, 80][i % 5]}%`, height: i === 0 ? "11px" : "9px" }
  })),
  h("div", { style: { fontSize: "11px", color: "var(--o-faint)", animation: "o-breathe 1.6s ease-in-out infinite" } }, text)
);
var Empty = ({ glyph = "☯", title, hint = null }) => h(
  "div",
  { className: "o-empty" },
  h("div", { className: "o-empty-glyph" }, glyph),
  h("div", { className: "o-empty-text" }, title),
  hint ? h("div", { style: { fontSize: "10.5px", opacity: 0.75, lineHeight: 1.6 } }, hint) : null
);
var ErrorBar = ({ children }) => h(
  "div",
  { className: "o-error" },
  h("span", { style: { fontFamily: "var(--o-serif)", fontSize: "13px", lineHeight: 1.2 } }, "⚠"),
  h("span", { style: { flex: "1 1 auto", whiteSpace: "pre-wrap" } }, children)
);
var Notes = ({ items }) => {
  const list = (items ?? []).filter(Boolean);
  if (list.length === 0) return null;
  return h(
    "div",
    { className: "o-note", style: { display: "flex", flexDirection: "column", gap: "1px" } },
    list.map((n, i) => h("div", { key: i, className: "o-note-lead" }, `ℹ ${n}`))
  );
};
var FooterNote = ({ children }) => h("div", { className: "o-disclaimer", style: { paddingTop: "2px" } }, children);
var WUXING_COLOR = {
  金: "#d9b26a",
  木: "#6fb583",
  水: "#62a3d8",
  火: "#e0746a",
  土: "#c09070"
};
var toneOf = (t) => t === "吉" ? "good" : t === "凶" ? "bad" : t === "中性" ? null : "accent";

// src/client/views/trend-view.js
function TrendView({ state }) {
  const t = state.trend ?? {};
  const f = t.form ?? {};
  const calendar = f.calendar === "lunar" ? "lunar" : "solar";
  return h(
    "div",
    null,
    h(
      Card,
      { title: "排K线", tone: "accent" },
      h(
        "div",
        { className: "o-grid", style: { gridTemplateColumns: "repeat(auto-fit, minmax(60px, 1fr))" } },
        h(Field, { label: calendar === "lunar" ? "农历年" : "出生年" }, Input({ tf: "year", placeholder: "1990", inputMode: "numeric", defaultValue: f.year ?? "" })),
        h(Field, { label: "月" }, Input({ tf: "month", placeholder: "8", inputMode: "numeric", defaultValue: f.month ?? "" })),
        h(Field, { label: "日" }, Input({ tf: "day", placeholder: "16", inputMode: "numeric", defaultValue: f.day ?? "" })),
        h(Field, { label: "画到几岁" }, Input({ tf: "toAge", placeholder: "100", inputMode: "numeric", defaultValue: f.toAge ?? "100" }))
      ),
      h(
        "div",
        { style: { display: "flex", flexWrap: "wrap", gap: "9px", alignItems: "flex-end", marginTop: "9px" } },
        CalendarField({ calendar, leap: f.isLeapMonth === "1" }),
        h(Field, { label: "性别", grow: 0 }, Seg({ tf: "gender", defaultValue: f.gender ?? "male", options: [["male", "男命"], ["female", "女命"]] })),
        h(
          "div",
          { className: "o-field", style: { flex: "1 1 96px" } },
          h("span", { className: "o-label" }, "出生时辰（可留空）"),
          HourSelect({ defaultValue: f.hour ?? "" })
        ),
        h("button", {
          "data-action": "trend-submit",
          "data-xuanji-btn": "1",
          "data-variant": "primary",
          disabled: !!t.loading
        }, t.loading ? "排盘中…" : "画K线")
      ),
      h("div", { className: "o-note", style: { marginTop: "7px" } }, calendarHint(calendar))
    ),
    t.error ? ErrorBar({ children: t.error }) : null,
    t.loading ? Loading({ lines: 3, text: "本地排盘中…" }) : null,
    !t.loading && !t.result && !t.error ? Empty({ glyph: "線", title: "人生K线会画在这里", hint: "按大运干支与逐年流年十神确定性计分，1 岁起到指定岁数。" }) : null,
    t.result ? TrendResult({ result: t.result }) : null
  );
}
function TrendResult({ result }) {
  const spec = buildTrendSpec(result.points ?? [], result.segments ?? []);
  const best = result.highlights?.best ?? [];
  const worst = result.highlights?.worst ?? [];
  return h(
    "div",
    { className: "o-anim-rise" },
    h(
      Card,
      { title: "逐岁走势", tone: "gold" },
      spec ? renderTrendSvg(spec, h) : h("div", { className: "o-note" }, "没有可绘制的数据点。"),
      // 图例：均线口径要说清，否则用户会以为是额外数据
      h(
        "div",
        { style: { display: "flex", flexWrap: "wrap", gap: "9px", marginTop: "6px", fontSize: "10px", color: "var(--o-faint)" } },
        h("span", null, "— 5年均线"),
        h("span", null, "— 10年均线"),
        h("span", null, "虚线竖 = 大运交界")
      )
    ),
    result.meta ? h(
      Card,
      { title: "命盘基准" },
      h(StatGrid, { items: [
        { k: "出生", v: result.meta.birth?.slice(5) ?? "—", note: result.meta.birth?.slice(0, 4) ?? "" },
        { k: "性别", v: result.meta.gender ?? "—", note: "命" },
        { k: "日主", v: result.meta.dayMaster ?? "—", note: "" },
        { k: "旺衰（简）", v: result.meta.strength?.state ?? "—", note: "" },
        { k: "输入历法", v: result.meta.calendar ?? "—", note: result.meta.lunarDate ? "" : "" }
      ] }),
      result.meta.strength?.note ? h("div", { className: "o-note", style: { marginTop: "7px" } }, result.meta.strength.note) : null,
      Notes({ items: result.meta.notes })
    ) : null,
    Array.isArray(result.segments) && result.segments.length > 0 ? h(
      Card,
      { title: "大运分段" },
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "4px" } },
        result.segments.map((s, i) => h(
          "div",
          {
            key: i,
            style: {
              display: "flex",
              alignItems: "center",
              gap: "8px",
              background: i % 2 === 1 ? "var(--o-surface-2)" : "transparent",
              borderRadius: "var(--o-r-sm)",
              padding: "3px 7px"
            }
          },
          h("span", { className: "o-glyph-sm", style: { minWidth: "36px", color: "var(--o-gold)" } }, s.ganZhi),
          h("span", { style: { fontSize: "10.5px", color: "var(--o-faint)", flex: "1 1 auto" } }, `${s.startAge}–${s.endAge} 岁`)
        ))
      )
    ) : null,
    best.length > 0 || worst.length > 0 ? h(
      Card,
      { title: "高低年份" },
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "7px" } },
        best.length > 0 ? h(
          "div",
          null,
          h("div", { className: "o-label", style: { marginBottom: "3px" } }, "顺位年份"),
          h(Badges, { children: best.map((x, i) => h(Badge, { key: i, tone: "good" }, x)) })
        ) : null,
        worst.length > 0 ? h(
          "div",
          null,
          h("div", { className: "o-label", style: { marginBottom: "3px" } }, "谨慎年份"),
          h(Badges, { children: worst.map((x, i) => h(Badge, { key: i, tone: "bad" }, x)) })
        ) : null
      ),
      h(
        "div",
        { className: "o-note", style: { marginTop: "7px" } },
        "「顺位/谨慎」是逐年十神与大运干支的简化计分结果，不是吉凶判词——它给的是节奏感，不是结论。"
      )
    ) : null,
    result.disclaimer ? FooterNote({ children: result.disclaimer }) : null
  );
}

// src/client/views/tarot-view.js
function TarotView({ state }) {
  const t = state.tarot ?? {};
  const cards = t.result?.cards ?? (t.result?.card ? [t.result.card] : []);
  return h(
    "div",
    null,
    h(
      Card,
      { title: "抽牌", tone: "accent" },
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "8px" } },
        h(
          "div",
          { className: "o-field" },
          h("span", { className: "o-label" }, "牌阵"),
          h(Seg, { tf: "mode", defaultValue: t.mode ?? "daily", options: [["daily", "每日一牌"], ["three", "三牌阵"]] })
        ),
        h(
          "div",
          { className: "o-field" },
          h(
            "span",
            { className: "o-label" },
            t.mode === "three" || t.result?.mode === "three" ? "所问何事（三牌阵必填）" : "所问何事（可留空）"
          ),
          h("textarea", {
            "data-xuanji-panel-input": "1",
            "data-tf": "question",
            className: "xuanji-input",
            placeholder: "写一句你正在纠结的事…",
            rows: "2",
            defaultValue: t.question ?? ""
          })
        ),
        h("button", {
          "data-action": "tarot-draw",
          "data-xuanji-btn": "1",
          "data-variant": "primary",
          disabled: !!t.loading,
          style: { alignSelf: "flex-start" }
        }, t.loading ? "抽牌中…" : "抽牌")
      )
    ),
    t.error ? ErrorBar({ children: t.error }) : null,
    t.loading ? Loading({ lines: 2, text: "洗牌中…" }) : null,
    cards.length > 0 ? h("div", {
      style: {
        display: "flex",
        gap: "9px",
        flexWrap: "wrap",
        justifyContent: "center",
        padding: "4px 0 2px"
      }
    }, cards.map((c, i) => TarotCard({
      card: c,
      index: i,
      flipped: !!(t.flipped?.has?.(i) || t.flipped?.[i]),
      showPosition: cards.length > 1
    }))) : !t.loading && !t.error ? Empty({ glyph: "牌", title: "抽出来的牌会摊在这里", hint: "每日一牌同日同牌；三牌阵看过去 / 现在 / 未来。" }) : null,
    t.result && !t.loading ? TarotText({ result: t.result, cards }) : null
  );
}
function TarotCard({ card, index, flipped, showPosition }) {
  const upright = card.orientation === "正位";
  return h(
    "div",
    {
      className: `xuanji-tcard${flipped ? " flipped" : ""}`,
      "data-action": "card-flip",
      "data-ci": String(index),
      style: { width: "104px", height: "162px", flex: "none" },
      "aria-label": `${card.name}（${card.orientation ?? ""}）`
    },
    h(
      "div",
      { className: "xuanji-tcard-inner" },
      h(
        "div",
        { className: "xuanji-tface xuanji-tback" },
        h("div", { style: { fontSize: "15px", letterSpacing: "1px" } }, "☾"),
        h("div", { style: { fontSize: "9.5px", marginTop: "7px", opacity: 0.7 } }, "点牌翻面"),
        showPosition ? h("div", { style: { fontSize: "9.5px", marginTop: "2px", opacity: 0.55 } }, card.position ?? "") : null
      ),
      h(
        "div",
        { className: "xuanji-tface xuanji-tfront" },
        showPosition ? h("div", {
          style: {
            fontSize: "9px",
            letterSpacing: ".6px",
            color: "var(--o-faint)",
            border: "1px solid var(--o-border)",
            borderRadius: "4px",
            padding: "0 5px"
          }
        }, card.position ?? "") : null,
        h("div", {
          style: {
            fontFamily: "var(--o-serif)",
            fontSize: "15px",
            fontWeight: 500,
            lineHeight: 1.35,
            marginTop: "5px",
            letterSpacing: ".5px"
          }
        }, card.name),
        h(
          "div",
          { style: { marginTop: "4px" } },
          h(Badge, { tone: upright ? "gold" : null }, card.orientation ?? "—")
        ),
        card.keyword ? h("div", { style: { fontSize: "9.5px", marginTop: "6px", color: "var(--o-faint)" } }, card.keyword) : null
      )
    )
  );
}
function TarotText({ result, cards }) {
  const single = result.card;
  return h(
    Card,
    { title: "牌意", tone: "gold" },
    result.meta?.question ? h("div", { style: { fontSize: "11.5px", color: "var(--o-muted)", marginBottom: "7px" } }, `所问：${result.meta.question}`) : null,
    h(
      "div",
      { style: { display: "flex", flexDirection: "column", gap: "7px" } },
      (single ? [single] : cards).map((c, i) => h(
        "div",
        {
          key: i,
          style: {
            background: "var(--o-surface-2)",
            border: "1px solid var(--o-border)",
            borderRadius: "var(--o-r-md)",
            padding: "7px 9px"
          }
        },
        h(
          "div",
          { style: { display: "flex", alignItems: "baseline", gap: "6px", marginBottom: "2px" } },
          c.position ? h("span", { style: { fontSize: "9.5px", color: "var(--o-faint)" } }, c.position) : null,
          h("span", { className: "o-glyph-sm" }, c.name),
          h(Badge, { tone: c.orientation === "正位" ? "gold" : null }, c.orientation ?? "")
        ),
        h("div", { style: { fontSize: "11px", lineHeight: 1.65, color: "var(--o-muted)" } }, c.text ?? "")
      ))
    ),
    result.disclaimer ? FooterNote({ children: result.disclaimer }) : null
  );
}

// src/client/views/bazi-view.js
var PILLAR_LABEL = [["year", "年柱"], ["month", "月柱"], ["day", "日柱"], ["hour", "时柱"]];
function BaziView({ state }) {
  const b = state.bazi ?? {};
  const f = b.form ?? {};
  const calendar = f.calendar === "lunar" ? "lunar" : "solar";
  return h(
    "div",
    null,
    h(
      Card,
      { title: "出生信息", tone: "accent" },
      h(
        "div",
        { className: "o-grid", style: { gridTemplateColumns: "repeat(auto-fit, minmax(64px, 1fr))" } },
        h(Field, { label: calendar === "lunar" ? "农历年" : "出生年" }, Input({ tf: "year", placeholder: "1990", inputMode: "numeric", defaultValue: f.year ?? "" })),
        h(Field, { label: "月" }, Input({ tf: "month", placeholder: "8", inputMode: "numeric", defaultValue: f.month ?? "" })),
        h(Field, { label: "日" }, Input({ tf: "day", placeholder: "16", inputMode: "numeric", defaultValue: f.day ?? "" })),
        h(Field, { label: "时辰（可留空）", span: 2 }, HourSelect({ defaultValue: f.hour ?? "" }))
      ),
      h(
        "div",
        { style: { display: "flex", flexWrap: "wrap", gap: "9px", alignItems: "flex-end", marginTop: "9px" } },
        CalendarField({ calendar, leap: f.isLeapMonth === "1" }),
        h(Field, { label: "性别", grow: 0 }, Seg({ tf: "gender", defaultValue: f.gender ?? "male", options: [["male", "男命"], ["female", "女命"]] })),
        h(
          "div",
          { className: "o-field", style: { flex: "1 1 120px" } },
          h("span", { className: "o-label" }, "出生地（可选 · 真太阳时）"),
          Input({ tf: "city", placeholder: "如 成都 / 乌鲁木齐", defaultValue: f.city ?? "" })
        ),
        h("button", {
          "data-action": "bazi-submit",
          "data-xuanji-btn": "1",
          "data-variant": "primary",
          disabled: !!b.loading
        }, b.loading ? "排盘中…" : "排八字")
      ),
      h("div", { className: "o-note", style: { marginTop: "7px" } }, calendarHint(calendar)),
      h(
        "div",
        { className: "o-note", style: { marginTop: "3px" } },
        "留空出生地即按钟面时间；1986–1991 夏令时无论是否填都会自动校正。"
      )
    ),
    b.error ? ErrorBar({ children: b.error }) : null,
    b.loading ? Loading({ lines: 3, text: "本地排盘中…" }) : null,
    !b.loading && !b.result && !b.error ? Empty({ glyph: "柱", title: "四柱排盘结果会出现在这里", hint: "填上出生年月日与性别即可；时辰不知道就留空，会如实标注而不是替你猜。" }) : null,
    b.result ? BaziResult({ result: b.result }) : null
  );
}
function BaziResult({ result }) {
  const P = result.pillars ?? {};
  const cards = PILLAR_LABEL.filter(([k]) => P[k]);
  return h(
    "div",
    { className: "o-anim-rise" },
    // ── 四柱 ──
    h(
      Card,
      { title: "四柱" },
      h(
        "div",
        { style: { display: "flex", gap: "6px", alignItems: "stretch" } },
        cards.map(([key, label]) => PillarCard({ key, label, p: P[key], isDay: key === "day" }))
      ),
      result.meta?.dayunNote ? null : null
    ),
    // ── 概要：日主 / 旺衰 / 喜用 ──
    h(
      Card,
      { title: "命盘概要", tone: "gold" },
      h(StatGrid, { items: [
        { k: "日主", v: result.dayMaster?.gan ?? "—", note: `${result.dayMaster?.yinYang ?? ""}${result.dayMaster?.wuxing ?? ""}` },
        { k: "旺衰（简）", v: result.strength?.state ?? "—", note: "简化判定" },
        { k: "生肖", v: result.meta?.shengXiao ?? "—", note: result.meta?.yearGanZhi ?? "" },
        { k: "四柱数", v: String(cards.length), note: cards.length === 3 ? "时辰未知" : "齐全" }
      ] }),
      result.strength?.favorable ? h(
        "div",
        { style: { marginTop: "8px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" } },
        h("span", { className: "o-label" }, "喜用倾向"),
        h(Badge, { tone: "gold" }, result.strength.favorable)
      ) : null,
      result.dayMaster ? h(
        "div",
        { style: { marginTop: "8px" } },
        h(KV, { rows: [
          ["日主", `${result.dayMaster.gan}（${result.dayMaster.yinYang}${result.dayMaster.wuxing}）`]
        ] })
      ) : null,
      Notes({ items: [...result.meta?.notes ?? [], result.meta?.lateZiNote, result.meta?.yearScopeNote] })
    ),
    result.wuxing?.counts ? h(
      Card,
      { title: "五行分布" },
      WuxingBars({ counts: result.wuxing.counts, summary: result.wuxing.summary })
    ) : null,
    Array.isArray(result.zhiRelations) ? h(
      Card,
      { title: "刑冲合会（原局地支）" },
      RelationBadges({ relations: result.zhiRelations })
    ) : null,
    Array.isArray(result.shenSha?.stars) && result.shenSha.stars.length > 0 ? h(Card, { title: "神煞（传统查表口径）" }, ShenShaChips({ stars: result.shenSha.stars })) : null,
    Array.isArray(result.daYun) && result.daYun.length > 0 ? h(Card, { title: "大运" }, DayunList({ daYun: result.daYun })) : null,
    result.disclaimer ? FooterNote({ children: result.disclaimer }) : null
  );
}
function PillarCard({ label, p, isDay = false }) {
  if (!p) return null;
  return h(
    "div",
    {
      style: {
        flex: "1 1 0",
        minWidth: 0,
        textAlign: "center",
        background: isDay ? "color-mix(in srgb, var(--o-gold) 8%, var(--o-surface-2))" : "var(--o-surface-2)",
        border: `1px solid ${isDay ? "color-mix(in srgb, var(--o-gold) 34%, transparent)" : "var(--o-border)"}`,
        borderRadius: "var(--o-r-md)",
        padding: "9px 4px 7px",
        boxSizing: "border-box"
      }
    },
    h("div", { className: "o-label", style: { color: isDay ? "var(--o-gold)" : void 0 } }, label),
    h(Glyph, { small: true, tone: isDay ? "gold" : null }, p.ganZhi),
    h("div", { style: { fontSize: "10.5px", color: "var(--o-muted)", marginTop: "1px" } }, p.shiShenGan ?? ""),
    h("div", { style: { fontSize: "9.5px", color: "var(--o-faint)", marginTop: "3px" } }, `${p.yinYang ?? ""}${p.wuxing?.gan ?? ""}·${p.wuxing?.zhi ?? ""}`),
    p.naYin ? h("div", { style: { fontSize: "9.5px", color: "var(--o-faint)" } }, p.naYin) : null,
    p.xingYun ? h("div", { style: { fontSize: "9.5px", color: "var(--o-lucky)", marginTop: "2px" } }, `星运 ${p.xingYun}`) : null,
    p.xunKong ? h("div", { style: { fontSize: "9.5px", color: "var(--o-ghost)" } }, `空 ${p.xunKong}`) : null,
    Array.isArray(p.cangGan) && p.cangGan.length > 0 ? h("div", {
      style: {
        fontSize: "9px",
        color: "var(--o-ghost)",
        marginTop: "5px",
        lineHeight: 1.5,
        borderTop: "1px dashed var(--o-border)",
        paddingTop: "4px"
      }
    }, p.cangGan.map((c) => `${c.gan}(${c.shiShen})`).join(" ")) : null
  );
}
function WuxingBars({ counts, summary }) {
  const max = Math.max(1, ...Object.values(counts ?? {}));
  return h(
    "div",
    null,
    summary ? h("div", { className: "o-note", style: { marginBottom: "6px" } }, summary) : null,
    h(
      "div",
      { className: "o-bars" },
      ["金", "木", "水", "火", "土"].flatMap((el) => {
        const v = counts?.[el] ?? 0;
        const pct = Math.round(v / max * 100);
        return [
          h("div", { key: `${el}k`, style: { fontSize: "11px", color: WUXING_COLOR[el] } }, el),
          h(
            "div",
            { key: `${el}t`, className: "o-bar-track" },
            h("div", { className: "o-bar-fill", style: { width: `${pct}%`, height: "100%", background: WUXING_COLOR[el] } })
          ),
          h("div", { key: `${el}v`, style: { fontSize: "10px", color: "var(--o-faint)", textAlign: "right", fontFamily: "var(--o-mono)" } }, String(v))
        ];
      })
    )
  );
}
function RelationBadges({ relations }) {
  if (!Array.isArray(relations)) return null;
  if (relations.length === 0) {
    return h("div", { className: "o-note" }, "四柱地支间无明显刑冲合会。");
  }
  return h(Badges, { children: relations.map((r, i) => h(Badge, { key: i, tone: toneOf(r.tone) }, r.text)) });
}
function ShenShaChips({ stars }) {
  const typeTone = { 吉星: "gold", 中性: null, 凶煞: null };
  return h(Badges, { children: stars.map((s, i) => h(Badge, {
    key: i,
    tone: typeTone[s.type] ?? null,
    title: s.rule
  }, `${s.name}·${(s.hits ?? []).map((x) => `${x.pillar ?? ""}${x.char ?? ""}`).join("/")}`)) });
}
function DayunList({ daYun }) {
  return h(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "5px" } },
    daYun.map((d, i) => h(
      "div",
      {
        key: i,
        style: {
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "var(--o-surface-2)",
          border: "1px solid var(--o-border)",
          borderRadius: "var(--o-r-sm)",
          padding: "5px 9px"
        }
      },
      h("span", { className: "o-glyph-sm", style: { fontSize: "14px", minWidth: "38px" } }, d.ganZhi),
      h(
        "span",
        { style: { fontSize: "10.5px", color: "var(--o-faint)", flex: "1 1 auto" } },
        d.startYear ? `${d.startYear}–${Number(d.startYear) + 9}` : d.startAge !== void 0 ? `${d.startAge}岁起` : ""
      ),
      d.shiShenGan ? h("span", { className: "o-note" }, d.shiShenGan) : null
    ))
  );
}

// src/client/views/almanac-view.js
function AlmanacView({ state }) {
  const a = state.almanac ?? {};
  const f = a.form ?? {};
  const calendar = f.calendar === "lunar" ? "lunar" : "solar";
  return h(
    "div",
    null,
    h(
      Card,
      { title: "查历", tone: "accent" },
      h(
        "div",
        { style: { display: "flex", gap: "7px", alignItems: "flex-end", flexWrap: "wrap" } },
        h(
          "div",
          { className: "o-field", style: { flex: "1 1 130px" } },
          h("span", { className: "o-label" }, `日期（${calendar === "lunar" ? "农历" : "公历"} · 留空=今天）`),
          Input({ tf: "date", placeholder: calendar === "lunar" ? "如 2026-07-07" : "YYYY-MM-DD", defaultValue: a.date ?? "" })
        ),
        CalendarField({ calendar, leap: f.isLeapMonth === "1" }),
        h("button", {
          "data-action": "almanac-submit",
          "data-xuanji-btn": "1",
          "data-variant": "primary",
          disabled: !!a.loading
        }, a.loading ? "查历中…" : "查黄历")
      ),
      h("div", { className: "o-note", style: { marginTop: "7px" } }, calendarHint(calendar))
    ),
    a.error ? ErrorBar({ children: a.error }) : null,
    a.loading ? Loading({ lines: 4, text: "本地推历中…" }) : null,
    !a.loading && !a.result && !a.error ? Empty({ glyph: "曆", title: "今天的黄历会自己跑出来", hint: "进入本页自动查今天；改日期可以查任意一天。" }) : null,
    a.result ? AlmanacResult({ result: a.result }) : null
  );
}
function AlmanacResult({ result }) {
  const pos = result.positions ?? {};
  const jq = result.jieQi ?? {};
  const gz = result.ganzhi ?? {};
  const directions = [["喜神", pos.xiShen], ["财神", pos.caiShen], ["福神", pos.fuShen], ["阳贵", pos.yangGui], ["阴贵", pos.yinGui]].filter(([, v]) => v);
  return h(
    "div",
    { className: "o-anim-rise" },
    // 日期头：公历 + 农历干支，这一页的「标题区」
    h(
      Card,
      { tone: "gold", title: result.meta?.isToday ? "今天" : "所查之日" },
      h(
        "div",
        { style: { display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" } },
        GlyphDate({ date: result.meta?.date }),
        h("span", { className: "o-note" }, result.lunarDate ?? "")
      ),
      h(
        "div",
        { style: { display: "flex", gap: "5px", flexWrap: "wrap", marginTop: "7px" } },
        gz.year ? h(Badge, { tone: "gold" }, `${gz.year}年`) : null,
        gz.month ? h(Badge, { tone: "gold" }, `${gz.month}月`) : null,
        gz.day ? h(Badge, { tone: "gold" }, `${gz.day}日`) : null,
        gz.shengXiao ? h(Badge, null, `属${gz.shengXiao}`) : null
      ),
      result.ganzhi ? h(
        "div",
        { className: "o-note", style: { marginTop: "7px" } },
        [result.zhiXing ? `值神 ${result.zhiXing}` : null, result.liuYao, result.yueXiang ? `月相 ${result.yueXiang}` : null].filter(Boolean).join(" · ")
      ) : null,
      result.xiu?.xiu ? h(
        "div",
        { className: "o-note" },
        `星宿 ${result.xiu.xiu}（${result.xiu.gong ?? ""}${result.xiu.animal ?? ""}）`
      ) : null,
      result.pengZu?.gan || result.pengZu?.zhi ? h("div", { className: "o-note" }, `彭祖百忌：${[result.pengZu.gan, result.pengZu.zhi].filter(Boolean).join("；")}`) : null
    ),
    // 宜 / 忌
    h(
      Card,
      { title: "宜忌" },
      h(
        "div",
        { style: { display: "flex", gap: "7px", flexWrap: "wrap" } },
        YiJiCard({ title: "宜", tone: "good", items: result.yi ?? [] }),
        YiJiCard({ title: "忌", tone: "bad", items: result.ji ?? [] })
      ),
      result.chong?.text ? h(
        "div",
        { className: "o-note", style: { marginTop: "8px" } },
        `冲煞：${result.chong.text}${result.chong.shengXiao ? `（冲${result.chong.shengXiao}）` : ""}${result.chong.sha ? result.chong.sha : ""}`
      ) : null
    ),
    // 方位
    directions.length > 0 ? h(
      Card,
      { title: "吉神方位" },
      h(StatGrid, { items: directions.map(([k, v]) => ({ k, v, note: "" })) })
    ) : null,
    // 节气 / 节日 / 神煞
    jq.next || jq.prev || jq.current ? h(
      Card,
      { title: "节气" },
      h(
        "div",
        { className: "o-note" },
        [
          jq.current ? `今日交 ${jq.current.name}` : null,
          jq.prev?.name ? `${jq.prev.name} 已过` : null,
          jq.next?.name ? `下一节气 ${jq.next.name}（${jq.next.date ?? ""}）` : null
        ].filter(Boolean).join(" · ")
      ),
      Array.isArray(result.festivals) && result.festivals.length > 0 ? h(
        "div",
        { style: { display: "flex", gap: "5px", flexWrap: "wrap", marginTop: "6px" } },
        result.festivals.map((f, i) => h(Badge, { key: i, tone: "warn" }, f))
      ) : null
    ) : null,
    (result.jiShen ?? []).length > 0 || (result.xiongSha ?? []).length > 0 ? h(
      Card,
      { title: "神煞" },
      (result.jiShen ?? []).length > 0 ? h(
        "div",
        null,
        h("div", { className: "o-label", style: { marginBottom: "3px" } }, "吉神宜趋"),
        h(
          "div",
          { style: { display: "flex", gap: "4px", flexWrap: "wrap" } },
          result.jiShen.map((x, i) => h(Badge, { key: i, tone: "good" }, x))
        )
      ) : null,
      (result.xiongSha ?? []).length > 0 ? h(
        "div",
        { style: { marginTop: "7px" } },
        h("div", { className: "o-label", style: { marginBottom: "3px" } }, "凶神宜忌"),
        h(
          "div",
          { style: { display: "flex", gap: "4px", flexWrap: "wrap" } },
          result.xiongSha.map((x, i) => h(Badge, { key: i }, x))
        )
      ) : null
    ) : null,
    result.dailyHexagram ? DailyHexCard({ hex: result.dailyHexagram }) : null,
    result.disclaimer ? FooterNote({ children: result.disclaimer }) : null
  );
}
function GlyphDate({ date }) {
  if (!date) return null;
  const [y, m, d] = String(date).split("-");
  return h(
    "div",
    { style: { display: "flex", alignItems: "baseline", gap: "5px" } },
    h("span", { style: { fontFamily: "var(--o-serif)", fontSize: "22px", letterSpacing: "1px" } }, `${m ?? ""}/${d ?? ""}`),
    h("span", { style: { fontSize: "10.5px", color: "var(--o-faint)" } }, y ?? "")
  );
}
function YiJiCard({ title, tone, items }) {
  return h(
    "div",
    {
      style: {
        flex: "1 1 120px",
        minWidth: 0,
        background: tone === "good" ? "color-mix(in srgb, var(--o-lucky) 7%, var(--o-surface-2))" : "color-mix(in srgb, var(--o-danger) 7%, var(--o-surface-2))",
        border: `1px solid ${tone === "good" ? "color-mix(in srgb, var(--o-lucky) 26%, transparent)" : "color-mix(in srgb, var(--o-danger) 26%, transparent)"}`,
        borderRadius: "var(--o-r-md)",
        padding: "8px 10px"
      }
    },
    h("div", { style: { marginBottom: "4px" } }, h(Badge, { tone }, title)),
    h(
      "div",
      { style: { fontSize: "11.5px", lineHeight: 1.7, color: "var(--o-muted)" } },
      items.length > 0 ? items.join("、") : "——"
    )
  );
}
function DailyHexCard({ hex }) {
  return h(
    Card,
    { title: "每日一卦", tone: "gold" },
    h(
      "div",
      { style: { display: "flex", alignItems: "center", gap: "11px" } },
      h("div", {
        style: {
          fontSize: "34px",
          lineHeight: 1,
          color: "var(--o-gold)",
          fontFamily: "var(--o-serif)",
          flex: "0 0 auto"
        }
      }, hex.symbol ?? "☯"),
      h(
        "div",
        { style: { minWidth: 0 } },
        h("div", { className: "o-glyph-sm" }, hex.name ?? ""),
        hex.upper && hex.lower ? h("div", { className: "o-note" }, `上${hex.upper}下${hex.lower}`) : null,
        hex.gist ? h("div", { style: { fontSize: "11.5px", lineHeight: 1.65, color: "var(--o-muted)", marginTop: "4px" } }, hex.gist) : null
      )
    )
  );
}

// src/client/views/quick-view.js
function QuickView({ state }) {
  const q = state.quick ?? {};
  const kind = q.kind ?? "xiaoliuren";
  const three = kind === "xiaoliuren";
  return h(
    "div",
    null,
    h(
      Card,
      { title: "起课", tone: "accent" },
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "8px" } },
        h(
          "div",
          { className: "o-field" },
          h("span", { className: "o-label" }, "占法"),
          h(Seg, {
            tf: "kind",
            defaultValue: kind,
            options: [["xiaoliuren", "小六壬（报三数）"], ["meihua", "梅花易数（报两数）"]]
          })
        ),
        h(
          "div",
          { className: "o-field" },
          h("span", { className: "o-label" }, "所问何事"),
          Input({ tf: "question", placeholder: "一句话，如：这周面谈顺利吗", defaultValue: q.question ?? "" })
        ),
        h(
          "div",
          { className: "o-field" },
          h("span", { className: "o-label" }, three ? "随口报三个数（各 1–99）" : "随口报两个数（前上卦、后下卦）"),
          h(
            "div",
            { style: { display: "flex", gap: "6px" } },
            h(Input, { tf: "num1", placeholder: three ? "数1" : "上卦数", inputMode: "numeric", defaultValue: q.num1 ?? "" }),
            h(Input, { tf: "num2", placeholder: three ? "数2" : "下卦数", inputMode: "numeric", defaultValue: q.num2 ?? "" }),
            three ? h(Input, { tf: "num3", placeholder: "数3", inputMode: "numeric", defaultValue: q.num3 ?? "" }) : null
          )
        ),
        h("button", {
          "data-action": "quick-cast",
          "data-xuanji-btn": "1",
          "data-variant": "primary",
          disabled: !!q.loading,
          style: { alignSelf: "flex-start" }
        }, q.loading ? "起课中…" : "起课")
      )
    ),
    q.error ? ErrorBar({ children: q.error }) : null,
    q.loading ? Loading({ lines: 2, text: "本地起课中…" }) : null,
    !q.loading && !q.result && !q.error ? Empty({ glyph: "卜", title: "掐指 / 卦象会落在这里", hint: "随口报数才有「卦气」，别替用户编——这是这一页唯一不能代填的输入。" }) : null,
    q.result ? kind === "meihua" ? MeihuaResult({ result: q.result }) : XiaoliurenResult({ result: q.result }) : null
  );
}
function XiaoliurenResult({ result }) {
  const steps = result.steps ?? [];
  const r = result.result ?? {};
  const lucky = r.luck === "吉";
  return h(
    "div",
    { className: "o-anim-rise" },
    result.meta?.question ? h("div", { className: "o-note", style: { marginBottom: "7px" } }, `所问：${result.meta.question}`) : null,
    result.meta?.originText ? h("div", { className: "o-note", style: { marginBottom: "8px" } }, result.meta.originText) : null,
    // 三步掐指链：月 → 日 → 时，用箭头串起来，比裸 chips 更像「过程」
    h(
      Card,
      { title: "掐指三步" },
      h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" } },
        steps.flatMap((palace, i) => [
          i > 0 ? h("span", { key: `a${i}`, style: { color: "var(--o-ghost)", fontSize: "11px" } }, "→") : null,
          h("span", {
            key: `p${i}`,
            style: {
              fontFamily: "var(--o-serif)",
              fontSize: "13px",
              padding: "3px 10px",
              borderRadius: "var(--o-r-sm)",
              border: "1px solid var(--o-border)",
              background: i === steps.length - 1 ? "var(--o-surface-3)" : "var(--o-surface-2)"
            }
          }, palace)
        ]).filter(Boolean)
      ),
      h(
        "div",
        { style: { display: "flex", gap: "6px", marginTop: "7px", fontSize: "9.5px", color: "var(--o-ghost)" } },
        ["月", "日", "时"].slice(0, steps.length).map((k) => h("span", { key: k }, k))
      )
    ),
    r.palace ? h(
      Card,
      { title: "落宫", tone: lucky ? "accent" : null },
      h(
        "div",
        { style: { display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "5px" } },
        h(Glyph, { tone: lucky ? "lucky" : "danger" }, r.palace),
        h(Badge, { tone: lucky ? "good" : "bad" }, r.luck ?? "")
      ),
      h("div", { style: { fontSize: "11.5px", lineHeight: 1.7, color: "var(--o-muted)" } }, r.text ?? "")
    ) : null,
    result.disclaimer ? FooterNote({ children: result.disclaimer }) : null
  );
}
function MeihuaResult({ result }) {
  const gua = result.gua ?? {};
  const ty = result.tiYong ?? {};
  const levelTone = ty.level === "大吉" || ty.level === "吉" ? "good" : ty.level === "凶" ? "bad" : "warn";
  return h(
    "div",
    { className: "o-anim-rise" },
    result.meta?.question ? h("div", { className: "o-note", style: { marginBottom: "7px" } }, `所问：${result.meta.question}`) : null,
    result.meta?.originText ? h("div", { className: "o-note", style: { marginBottom: "8px" } }, result.meta.originText) : null,
    h(
      Card,
      { title: "卦象" },
      h(
        "div",
        { style: { display: "flex", gap: "6px", alignItems: "stretch" } },
        GuaChip({ title: `本卦 · 动${gua.movingWen ?? ""}`, g: gua.ben, primary: true }),
        GuaChip({ title: "互卦", g: gua.hu }),
        GuaChip({ title: "变卦", g: gua.bian })
      )
    ),
    ty.ti || ty.yong ? h(
      Card,
      { title: "体用生克", tone: "gold" },
      h(StatGrid, { items: [
        { k: "体卦", v: ty.ti?.name ?? "—", note: ty.ti?.position ?? "" },
        { k: "用卦", v: ty.yong?.name ?? "—", note: ty.yong?.position ?? "" }
      ] }),
      ty.relation ? h(
        "div",
        { style: { display: "flex", alignItems: "center", gap: "7px", marginTop: "8px", flexWrap: "wrap" } },
        h(Badge, { tone: levelTone }, `${ty.relation}（${ty.level ?? ""}）`),
        ty.ti?.wuxing && ty.yong?.wuxing ? h(
          "span",
          { className: "o-note" },
          `${WUXING_COLOR[ty.ti.wuxing] ? "" : ""}体${ty.ti.wuxing} · 用${ty.yong.wuxing}`
        ) : null
      ) : null,
      ty.text ? h("div", { style: { fontSize: "11.5px", lineHeight: 1.7, color: "var(--o-muted)", marginTop: "6px" } }, ty.text) : null
    ) : null,
    result.disclaimer ? FooterNote({ children: result.disclaimer }) : null
  );
}
function GuaChip({ title, g, primary = false }) {
  if (!g) return null;
  return h(
    "div",
    {
      style: {
        flex: "1 1 0",
        minWidth: 0,
        textAlign: "center",
        background: primary ? "color-mix(in srgb, var(--o-gold) 8%, var(--o-surface-2))" : "var(--o-surface-2)",
        border: `1px solid ${primary ? "color-mix(in srgb, var(--o-gold) 30%, transparent)" : "var(--o-border)"}`,
        borderRadius: "var(--o-r-md)",
        padding: "8px 3px"
      }
    },
    h("div", { className: "o-label" }, title),
    h("div", { style: { fontSize: "24px", lineHeight: 1.25 } }, g.symbol ?? ""),
    h("div", { style: { fontSize: "11px", fontFamily: "var(--o-serif)" } }, g.name)
  );
}

// src/client/views/chenggu-view.js
var HOUR_ZHI2 = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
var HOUR_ZHI_TIP = { 子: "23–1", 丑: "1–3", 寅: "3–5", 卯: "5–7", 辰: "7–9", 巳: "9–11", 午: "11–13", 未: "13–15", 申: "15–17", 酉: "17–19", 戌: "19–21", 亥: "21–23" };
function ChengguView({ state }) {
  const c = state.chenggu ?? {};
  const f = c.form ?? {};
  const calendar = f.calendar === "lunar" ? "lunar" : "solar";
  return h(
    "div",
    null,
    h(
      Card,
      { title: "出生信息", tone: "accent" },
      h(
        "div",
        { className: "o-grid", style: { gridTemplateColumns: "repeat(auto-fit, minmax(64px, 1fr))" } },
        h(Field, { label: calendar === "lunar" ? "农历年" : "出生年" }, Input({ tf: "year", placeholder: "1990", inputMode: "numeric", defaultValue: f.year ?? "" })),
        h(Field, { label: "月" }, Input({ tf: "month", placeholder: "8", inputMode: "numeric", defaultValue: f.month ?? "" })),
        h(Field, { label: "日" }, Input({ tf: "day", placeholder: "16", inputMode: "numeric", defaultValue: f.day ?? "" }))
      ),
      h(
        "div",
        { style: { display: "flex", flexWrap: "wrap", gap: "9px", alignItems: "flex-end", marginTop: "9px" } },
        CalendarField({ calendar, leap: f.isLeapMonth === "1" }),
        h(
          "div",
          { className: "o-field", style: { flex: "1 1 130px" } },
          h("span", { className: "o-label" }, "时辰（必填）"),
          h(Select, {
            tf: "hourZhi",
            defaultValue: f.hourZhi ?? "",
            options: [["", "选择时辰…"], ...HOUR_ZHI2.map((z) => [z, `${z}时（${HOUR_ZHI_TIP[z]}）`])]
          })
        ),
        h("button", {
          "data-action": "chenggu-submit",
          "data-xuanji-btn": "1",
          "data-variant": "primary",
          disabled: !!c.loading
        }, c.loading ? "称量中…" : "称骨")
      ),
      h(
        "div",
        { className: "o-note", style: { marginTop: "7px" } },
        calendar === "lunar" ? "按农历填写（年份以正月初一为界）；称骨必填时辰——这是四柱骨重的最后一味。" : "按公历填写（自动换算农历）；称骨必填时辰——这是四柱骨重的最后一味。"
      ),
      calendar === "lunar" ? h("div", { className: "o-note", style: { marginTop: "3px" } }, calendarHint(calendar)) : null
    ),
    c.error ? ErrorBar({ children: c.error }) : null,
    c.loading ? Loading({ lines: 3, text: "本地称量中…" }) : null,
    !c.loading && !c.result && !c.error ? Empty({ glyph: "秤", title: "骨重与批语会出现在这里", hint: "袁天罡称骨按农历四柱查骨重表求和，时辰缺一不可。" }) : null,
    c.result ? ChengguResult({ result: c.result }) : null
  );
}
function ChengguResult({ result }) {
  const w = result.weights ?? {};
  const rows = [["年", w.year], ["月", w.month], ["日", w.day], ["时", w.hour]].filter(([, x]) => x);
  const maxQian = Math.max(1, ...rows.map(([, x]) => x.qian ?? 0));
  return h(
    "div",
    { className: "o-anim-rise" },
    // 总重盘：这一页的视觉主角，给足空间
    result.total ? h(
      Card,
      { tone: "gold", title: "总骨重" },
      h(
        "div",
        { style: { textAlign: "center", padding: "4px 0 2px" } },
        h(Glyph, { tone: "gold" }, result.total.label),
        h("div", { style: { fontSize: "10.5px", color: "var(--o-faint)", marginTop: "2px" } }, `${result.total.qian} 钱`),
        result.verdict?.band ? h("div", { style: { marginTop: "7px" } }, h(Badge, { tone: "gold" }, `${result.verdict.band}档`)) : null
      ),
      h("div", { style: { fontSize: "12px", lineHeight: 1.7, marginTop: "8px" } }, result.verdict?.text ?? ""),
      result.verdict?.source ? h("div", { className: "o-note", style: { marginTop: "6px" } }, `批语口径：${result.verdict.source}`) : null
    ) : null,
    h(
      Card,
      { title: "四柱明细" },
      h(Bars, {
        items: rows.map(([label, x]) => ({ label: `${label}柱`, value: x.qian ?? 0, max: maxQian, color: "var(--o-gold)" }))
      }),
      h(
        "div",
        { style: { display: "flex", flexDirection: "column", gap: "3px", marginTop: "8px" } },
        rows.map(([label, x]) => h(
          "div",
          {
            key: label,
            style: { display: "flex", gap: "8px", alignItems: "baseline", fontSize: "11px" }
          },
          h("span", { style: { color: "var(--o-faint)", minWidth: "24px" } }, `${label}柱`),
          h("span", { style: { color: "var(--o-muted)", flex: "1 1 auto" } }, x.label)
        ))
      ),
      result.meta ? h(
        "div",
        { className: "o-note", style: { marginTop: "8px" } },
        `${result.meta.solar ?? ""}（公历）｜农历 ${result.meta.lunar ?? ""}｜${result.meta.yearGanZhi ?? ""}年` + (result.meta.inputCalendar ? `｜按${result.meta.inputCalendar}输入` : "")
      ) : null,
      Notes({ items: result.meta?.notes })
    ),
    result.disclaimer ? FooterNote({ children: result.disclaimer }) : null
  );
}

// src/client/panel.js
var VIEWS = [
  ["trend", "K线", "線"],
  ["bazi", "八字", "柱"],
  ["almanac", "黄历", "曆"],
  ["quick", "快占", "卜"],
  ["chenggu", "称骨", "秤"],
  ["tarot", "塔罗", "牌"]
];
function initialState() {
  return {
    view: "trend",
    trend: { form: null, loading: false, error: null, result: null },
    tarot: { mode: "daily", question: "", loading: false, error: null, result: null, flipped: /* @__PURE__ */ new Set() },
    bazi: { form: null, loading: false, error: null, result: null },
    almanac: { form: null, date: "", loading: false, error: null, result: null },
    quick: { kind: "xiaoliuren", question: "", num1: "", num2: "", num3: "", loading: false, error: null, result: null },
    chenggu: { form: null, loading: false, error: null, result: null }
  };
}
function createXuanjiController({ onChange = () => {
} } = {}) {
  const state = initialState();
  const notify = () => {
    try {
      onChange();
    } catch (error) {
      console.error("[dsh-xuanji] 面板重渲染失败：", error);
    }
  };
  const failTo = (key, error) => {
    const msg = String(error?.message ?? error);
    if (state[key]) state[key] = { ...state[key], loading: false, error: msg };
    notify();
  };
  const readInputs = (node) => {
    const out = {};
    if (!node) return out;
    for (const el of node.querySelectorAll("[data-tf]")) {
      const isCheck = el.type === "checkbox" || el.getAttribute("type") === "checkbox";
      out[el.getAttribute("data-tf")] = isCheck ? el.checked ? "1" : "" : String(el.value ?? "").trim();
    }
    for (const seg of node.querySelectorAll(".o-seg[data-seg]")) {
      const key = seg.getAttribute("data-seg");
      const hidden = seg.querySelector("input[data-tf]");
      if (hidden) out[key] = seg.getAttribute("data-value") ?? hidden.value;
    }
    return out;
  };
  const syncSegs = (node) => {
    for (const seg of node.querySelectorAll(".o-seg[data-seg]")) {
      if (seg.getAttribute("data-disabled") === "1") continue;
      const current = seg.getAttribute("data-value");
      for (const btn of seg.querySelectorAll(".o-seg-item")) {
        btn.setAttribute("aria-pressed", btn.getAttribute("data-seg-value") === current ? "true" : "false");
      }
      const hidden = seg.querySelector("input[data-tf]");
      if (hidden) hidden.value = current ?? "";
    }
  };
  const buildTrendQuery = (f) => {
    const toInt = (s) => s === "" ? null : Number(s);
    const year = toInt(f.year);
    const month = toInt(f.month);
    const day = toInt(f.day);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
      throw new Error("请先填出生年月日（数字）——缺输入不猜，这是玄机阁的纪律。");
    }
    const gender = f.gender === "female" ? "female" : f.gender === "male" ? "male" : null;
    if (!gender) throw new Error("性别必须选 男 或 女（大运顺逆由性别决定）。");
    let hour = null;
    if ((f.hour ?? "") !== "") {
      hour = Number(f.hour);
      if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error("时辰请填 0–23 的整数；不知道时辰就留空（会按未知时辰排盘并如实标注）。");
    }
    let toAge = 100;
    if (f.toAge !== "") {
      toAge = Number(f.toAge);
      if (!Number.isInteger(toAge) || toAge < 10 || toAge > 100) throw new Error("「画到几岁」请填 10–100 的整数。");
    }
    const q = new URLSearchParams({ year: String(year), month: String(month), day: String(day), gender });
    if (hour !== null) q.set("hour", String(hour));
    q.set("toAge", String(toAge));
    return `/trend?${q.toString()}`;
  };
  const doTrend = async (node) => {
    const f = readInputs(node);
    state.trend = { ...state.trend, form: f, loading: true, error: null };
    notify();
    try {
      const result = await apiFetch(buildTrendQuery(f));
      state.trend = { ...state.trend, loading: false, result };
    } catch (error) {
      failTo("trend", error);
      return;
    }
    notify();
  };
  const doTarot = async (node) => {
    const f = readInputs(node);
    const mode = f.mode === "three" ? "three" : "daily";
    const question = f.question ?? "";
    if (mode === "three" && !question) {
      state.tarot = { ...state.tarot, mode, question, error: "三牌阵要先问清所问何事——在输入框写一句再抽。" };
      notify();
      return;
    }
    state.tarot = { ...state.tarot, mode, question, loading: true, error: null, flipped: /* @__PURE__ */ new Set(), result: null };
    notify();
    try {
      const q = new URLSearchParams({ mode });
      if (question) q.set("question", question);
      const result = await apiFetch(`/tarot?${q.toString()}`);
      state.tarot = { ...state.tarot, loading: false, result };
    } catch (error) {
      failTo("tarot", error);
      return;
    }
    notify();
  };
  const runView = async (node, key, buildQuery, before = null) => {
    state[key] = { ...state[key], loading: true, error: null };
    notify();
    try {
      if (before) before();
      const result = await apiFetch(buildQuery());
      state[key] = { ...state[key], loading: false, result };
    } catch (error) {
      failTo(key, error);
      return;
    }
    notify();
  };
  const birthTriple = (f) => {
    const toInt = (s) => s === "" ? null : Number(s);
    const year = toInt(f.year);
    const month = toInt(f.month);
    const day = toInt(f.day);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
      throw new Error("请先填出生年月日（数字）——缺输入不猜，这是玄机阁的纪律。");
    }
    const q = new URLSearchParams({ year: String(year), month: String(month), day: String(day) });
    if (f.calendar === "lunar") {
      q.set("calendar", "lunar");
      if (f.isLeapMonth === "1") q.set("isLeapMonth", "1");
    }
    return q;
  };
  const buildBaziQuery = (f) => {
    const q = birthTriple(f);
    const gender = f.gender === "female" ? "female" : f.gender === "male" ? "male" : null;
    if (!gender) throw new Error("性别必须选 男 或 女（十神与大运顺逆由性别/日主决定）。");
    q.set("gender", gender);
    if ((f.hour ?? "") !== "") {
      const hour = Number(f.hour);
      if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error("时辰请填 0–23 的整数；不知道时辰就留空（会按未知时辰排盘并如实标注）。");
      q.set("hour", String(hour));
    }
    if (f.city) q.set("city", f.city);
    return `/bazi?${q.toString()}`;
  };
  const buildAlmanacQuery = (f) => {
    const date = f.date ?? "";
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("日期格式请用 YYYY-MM-DD，例如 2026-10-22（农历同样按年-月-日填）。");
    const q = new URLSearchParams();
    if (date) q.set("date", date);
    if (f.calendar === "lunar") {
      q.set("calendar", "lunar");
      if (f.isLeapMonth === "1") q.set("isLeapMonth", "1");
    }
    const qs = q.toString();
    return `/almanac${qs ? `?${qs}` : ""}`;
  };
  const buildQuickQuery = (f) => {
    const kind = f.kind === "meihua" ? "meihua" : "xiaoliuren";
    const question = f.question ?? "";
    const need = kind === "xiaoliuren" ? 3 : 2;
    const nums = [f.num1 ?? "", f.num2 ?? "", f.num3 ?? ""].slice(0, need);
    if (nums.some((s) => s === "")) {
      throw new Error(kind === "xiaoliuren" ? "小六壬要随口报三个数（1–99）——报数是起课的一部分，别替用户编。" : "梅花报数要随口报两个正整数——前数上卦、后数下卦，别替用户编。");
    }
    const parsed = nums.map((s) => Number(s));
    if (parsed.some((n) => !Number.isInteger(n) || n < 1 || n > 99)) {
      throw new Error("报数请填 1–99 的正整数（随口报的数才有卦气，别填 0 或小数）。");
    }
    const q = new URLSearchParams({ num1: String(parsed[0]), num2: String(parsed[1]) });
    if (kind === "xiaoliuren") q.set("num3", String(parsed[2]));
    if (question) q.set("question", question);
    return `/${kind === "xiaoliuren" ? "xiaoliuren" : "meihua"}?${q.toString()}`;
  };
  const buildChengguQuery = (f) => {
    const q = birthTriple(f);
    if (!f.hourZhi) throw new Error("称骨必填时辰（十二时辰下拉选一个）——缺时辰四柱骨重不可算。");
    q.set("hourZhi", f.hourZhi);
    return `/chenggu?${q.toString()}`;
  };
  const doBazi = (node) => {
    const f = readInputs(node);
    state.bazi = { ...state.bazi, form: f };
    return runView(node, "bazi", () => buildBaziQuery(f));
  };
  const doAlmanac = (node) => {
    const f = readInputs(node);
    state.almanac = { ...state.almanac, form: f, date: f.date ?? "" };
    return runView(node, "almanac", () => buildAlmanacQuery(f));
  };
  const doQuick = (node) => {
    const f = readInputs(node);
    state.quick = { ...state.quick, kind: f.kind === "meihua" ? "meihua" : "xiaoliuren", question: f.question ?? "", num1: f.num1 ?? "", num2: f.num2 ?? "", num3: f.num3 ?? "" };
    return runView(node, "quick", () => buildQuickQuery(f));
  };
  const doChenggu = (node) => {
    const f = readInputs(node);
    state.chenggu = { ...state.chenggu, form: f };
    return runView(node, "chenggu", () => buildChengguQuery(f));
  };
  const attach = (node) => {
    const onClick = (event) => {
      const target = event.target?.closest?.("[data-action]");
      if (target && node.contains(target)) {
        const action = target.getAttribute("data-action");
        try {
          if (action === "switch-view") {
            const requested = target.getAttribute("data-view");
            const known = VIEWS.some(([id]) => id === requested);
            state.view = known ? requested : "trend";
            notify();
            if (state.view === "almanac" && !state.almanac.result && !state.almanac.loading) {
              void doAlmanac(node);
            }
            return;
          }
          if (action === "trend-submit") {
            void doTrend(node);
            return;
          }
          if (action === "bazi-submit") {
            void doBazi(node);
            return;
          }
          if (action === "almanac-submit") {
            void doAlmanac(node);
            return;
          }
          if (action === "quick-cast") {
            void doQuick(node);
            return;
          }
          if (action === "chenggu-submit") {
            void doChenggu(node);
            return;
          }
          if (action === "tarot-draw") {
            void doTarot(node);
            return;
          }
          if (action === "card-flip") {
            const ci = Number(target.getAttribute("data-ci"));
            const flipped = new Set(state.tarot.flipped);
            if (flipped.has(ci)) flipped.delete(ci);
            else flipped.add(ci);
            state.tarot = { ...state.tarot, flipped };
            notify();
            return;
          }
        } catch (error) {
          failTo(state.view, error);
          return;
        }
      }
      const segBtn = event.target?.closest?.(".o-seg-item");
      if (segBtn && node.contains(segBtn)) {
        const seg = segBtn.closest("[data-seg]");
        if (!seg || seg.getAttribute("data-disabled") === "1") return;
        const key = seg.getAttribute("data-seg");
        seg.setAttribute("data-value", segBtn.getAttribute("data-seg-value"));
        syncSegs(node);
        const cur = state[state.view];
        if (cur) cur.form = { ...cur.form ?? {}, [key]: seg.getAttribute("data-value") };
        notify();
      }
    };
    node.addEventListener("click", onClick);
    return () => node.removeEventListener("click", onClick);
  };
  return { state, notify, attach };
}
var SUBTITLES = {
  trend: "人生K线 · 大运流年确定性计分",
  bazi: "八字排盘 · 四柱神煞刑冲合会",
  almanac: "每日黄历 · 宜忌方位与每日一卦",
  quick: "快占 · 小六壬掐指 / 梅花报数",
  chenggu: "袁天罡称骨 · 骨重四柱与批语",
  tarot: "塔罗 · 每日一牌 / 三牌阵"
};
function panelSubtitle(view) {
  return SUBTITLES[view] ?? SUBTITLES.trend;
}
function XuanjiPanel() {
  const [, forceTick] = useState(0);
  const controllerRef = useRef(null);
  const nodeRef = useRef(null);
  if (controllerRef.current === null) {
    controllerRef.current = createXuanjiController({ onChange: () => forceTick((n) => n + 1) });
  }
  const controller = controllerRef.current;
  useEffect(() => {
    ensureStyles();
    const node = nodeRef.current;
    let dispose = null;
    if (node) dispose = controller.attach(node);
    return () => {
      if (dispose) dispose();
    };
  }, []);
  const s = controller.state;
  const header = h(
    "div",
    { className: "o-brand" },
    h("div", { className: "o-brand-mark" }, "☯"),
    h(
      "div",
      { className: "o-brand-text" },
      h(
        "div",
        { className: "o-brand-name" },
        h("span", null, "玄机阁"),
        h("span", { className: "o-chip" }, "v" + (typeof window !== "undefined" && window.__DSH_XUANJI_VERSION__ ? window.__DSH_XUANJI_VERSION__ : "?"))
      ),
      h("div", { className: "o-brand-sub" }, panelSubtitle(s.view))
    )
  );
  const nav = h(
    "div",
    { className: "o-nav", role: "tablist" },
    VIEWS.map(([id, label, glyph]) => h(
      "button",
      {
        key: id,
        className: "o-tab",
        role: "tab",
        "aria-selected": s.view === id ? "true" : "false",
        "data-action": "switch-view",
        "data-view": id,
        "data-xuanji-btn": "1"
      },
      h("span", { className: "o-tab-glyph" }, glyph),
      h("span", { className: "o-tab-label" }, label)
    ))
  );
  return h(
    "div",
    { [PANEL_ATTR]: "1", className: "o-root", ref: nodeRef },
    header,
    nav,
    h(
      "div",
      { style: { flex: "1 1 auto", minHeight: 0 } },
      s.view === "trend" ? h(TrendView, { state: s }) : null,
      s.view === "bazi" ? h(BaziView, { state: s }) : null,
      s.view === "almanac" ? h(AlmanacView, { state: s }) : null,
      s.view === "quick" ? h(QuickView, { state: s }) : null,
      s.view === "chenggu" ? h(ChengguView, { state: s }) : null,
      s.view === "tarot" ? h(TarotView, { state: s }) : null
    )
  );
}

// src/client/index.js
var PLUGIN_VERSION = "0.2.0";
window.__DSH_XUANJI_VERSION__ = PLUGIN_VERSION;
var inject = ["slots", "sidebarRightTabs", "sidebarRight"];
function apply(ctx) {
  console.info("[dsh-xuanji] client apply v" + PLUGIN_VERSION + " — 注册右侧栏 tab");
  try {
    registerXuanjiTab(ctx, (props) => XuanjiPanel(props));
  } catch (error) {
    console.error("[dsh-xuanji] 右侧栏 tab 注册失败（可从右侧栏 guide 页手动进入）", error);
  }
  try {
    const dispose = openXuanjiTab(ctx);
    if (typeof ctx.effect === "function") ctx.effect(() => dispose);
  } catch (error) {
    console.warn('[dsh-xuanji] 自动打开右侧栏 tab 失败，可从右侧栏 guide 页手动进入（"玄机阁"）', error);
  }
  if (typeof window !== "undefined") {
    window.__dshXuanji = {
      version: PLUGIN_VERSION,
      kind: TAB_KIND,
      open: () => openXuanjiTab(ctx, { maxTries: 1 })
    };
  }
}
var __internals = {
  TAB_ID,
  TAB_KIND,
  tabDefinition,
  registerXuanjiTab,
  openXuanjiTab,
  XuanjiPanel,
  createXuanjiController,
  initialState,
  VIEWS,
  apiFetch,
  API_BASE,
  FENCE,
  FETCH_TIMEOUT_MS,
  buildCss,
  ensureStyles,
  PANEL_ATTR,
  STYLE_ID,
  buildTrendSpec,
  renderTrendSvg,
  TarotCard,
  TarotView,
  BaziView,
  PillarCard,
  WuxingBars,
  RelationBadges,
  ShenShaChips,
  AlmanacView,
  QuickView,
  ChengguView,
  TrendView,
  HOUR_OPTIONS,
  hourToZhi
};

		return module.exports;
	}
});

