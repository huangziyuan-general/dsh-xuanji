// src/client/index.js — 浏览器半（client bundle）入口。
//
// ⚠️ 本文件不直接发布：`npm run build` 会把它与全部依赖打包成
//   lib/client.js（经典脚本 + __ModuleLoader__ factory）
// dsh 只加载 package.json 的 exports["./client"]，也就是那个**构建产物**；
// 源码本身是 ESM。所以改完源码必须跑 build，再重启 dsh。
//
// 契约（与 dsh-novel-forge 同款）：
//   exports.inject  cordis 服务注入声明
//   exports.apply   插件装配函数，dsh 在物化后调用一次
import { registerXuanjiTab, openXuanjiTab, tabDefinition, TAB_ID, TAB_KIND } from './forge-tab.js';
import { XuanjiPanel, createXuanjiController, initialState, VIEWS } from './panel.js';
import { apiFetch, API_BASE, FENCE, FETCH_TIMEOUT_MS } from './api.js';
import { buildCss, ensureStyles, PANEL_ATTR, STYLE_ID } from './css.js';
import { buildTrendSpec, renderTrendSvg } from './views/trend-chart.js';
import { TarotCard, TarotView } from './views/tarot-view.js';
import { BaziView, PillarCard, WuxingBars, RelationBadges, ShenShaChips } from './views/bazi-view.js';
import { AlmanacView } from './views/almanac-view.js';
import { QuickView } from './views/quick-view.js';
import { ChengguView } from './views/chenggu-view.js';
import { QimenView } from './views/qimen-view.js';
import { FengshuiView } from './views/fengshui-view.js';
import { MatchView } from './views/match-view.js';
import { TrendView } from './views/trend-view.js';
import { LiuyaoView, LiuyaoResult } from './views/liuyao-view.js';
import { HOUR_OPTIONS, hourToZhi } from './views/ui.js';

// 版本号：必须与 package.json 的 version 一致。
// build-client.mjs 会把它与 package.json 对账，不一致直接构建失败（防发行漂移）。
const PLUGIN_VERSION = '0.3.1';

// 供面板头部徽标读取 —— 让视图层不必反向 import 入口（避免循环依赖）。
window.__DSH_XUANJI_VERSION__ = PLUGIN_VERSION;

/**
 * cordis 服务注入（浏览器侧）：
 *   slots            内容 seat（右栏 pane.tab）
 *   sidebarRightTabs tab 类型注册表（三步契约的第一步）
 *   sidebarRight     导航面（三步契约的第三步 openTab）
 */
const inject = ['slots', 'sidebarRightTabs', 'sidebarRight'];

/**
 * 插件装配。
 * @param {object} ctx cordis 上下文
 */
function apply(ctx) {
	console.info('[dsh-xuanji] client apply v' + PLUGIN_VERSION + ' — 注册右侧栏 tab');
	try {
		registerXuanjiTab(ctx, (props) => XuanjiPanel(props));
	} catch (error) {
		console.error('[dsh-xuanji] 右侧栏 tab 注册失败（可从右侧栏 guide 页手动进入）', error);
	}
	// ③ 打开：延迟 + 重试由 openXuanjiTab 自己兜；disposer 登记到 ctx.effect（卸载时清理）。
	try {
		const dispose = openXuanjiTab(ctx);
		if (typeof ctx.effect === 'function') ctx.effect(() => dispose);
	} catch (error) {
		console.warn('[dsh-xuanji] 自动打开右侧栏 tab 失败，可从右侧栏 guide 页手动进入（"玄机阁"）', error);
	}
	// 保底开关：自动打开失败时，控制台敲一行即可打开。
	if (typeof window !== 'undefined') {
		window.__dshXuanji = {
			version: PLUGIN_VERSION,
			kind: TAB_KIND,
			open: () => openXuanjiTab(ctx, { maxTries: 1 }),
		};
	}
}

export { inject, apply, PLUGIN_VERSION };

/**
 * headless 门禁的抓手：把纯逻辑暴露给 test/client.test.mjs。
 * spec 渲染、翻牌数据、CSS 规则、REST 契约这些都是纯函数——不渲染 React 也能直测。
 */
export const __internals = {
	TAB_ID, TAB_KIND, tabDefinition, registerXuanjiTab, openXuanjiTab,
	XuanjiPanel, createXuanjiController, initialState, VIEWS,
	apiFetch, API_BASE, FENCE, FETCH_TIMEOUT_MS,
	buildCss, ensureStyles, PANEL_ATTR, STYLE_ID,
	buildTrendSpec, renderTrendSvg, TarotCard, TarotView,
	BaziView, PillarCard, WuxingBars, RelationBadges, ShenShaChips,
	AlmanacView, QuickView, ChengguView, TrendView,
	QimenView, FengshuiView, MatchView,
	LiuyaoView, LiuyaoResult,
	HOUR_OPTIONS, hourToZhi,
};
