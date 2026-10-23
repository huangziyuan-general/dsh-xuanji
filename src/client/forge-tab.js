// src/client/forge-tab.js — 右侧栏 tab 的「三步契约」。
//
// 官方契约（见 @deepseek-ai/dsh-client-ui-sidebar-right 的 lib/types/client/）：
//   ① `ctx.sidebarRightTabs.register(definition)` —— **声明**有这么一种 tab；
//   ② `ctx.slots.register({ name: 'sidebar.right.pane.tab', key: <definition.id> }, Panel)`
//      —— 给这种 tab 提供内容（key 用 definition 的 `id`，不是 `kind`）；
//   ③ `ctx.sidebarRight.openTab(<definition.kind>)` —— **真正把它放上屏幕**。
// 只做①②、没人调③时一格都不会多也不报错——这是「tab 死活不出现」的第一大误判来源。
// ③要「延迟 + 重试」：openTab 在 seat 挂载前调用会直接抛错（右栏折叠时 seat 迟迟不挂载）。
/** 本实现在 tab 系统里的身份：`definition.id`，也是内容 seat 的 key。 */
export const TAB_ID = 'dsh-xuanji';

/** tab 类型判别符：`openTab` 用它点名（语义与 id 不同，别混）。 */
export const TAB_KIND = 'xuanji';

/**
 * ① 类型定义（纯静态）。不给 `patterns` ⇒ **page type**：由 kind 打开，不认领地址。
 */
export function tabDefinition() {
	return {
		id: TAB_ID,
		kind: TAB_KIND,
		priority: 'extension',
		title: () => '🔮 玄机阁',
		guide: [{
			order: 91,
			title: () => '玄机阁',
			description: () => '人生K线图与每日塔罗（本地确定性排盘）',
		}],
	};
}

/**
 * 注册①②步。返回 disposer（交给 ctx.effect 的返回值语义）。
 * @param {object} ctx cordis 客户端上下文
 * @param {Function} Panel tab 内容组件
 */
export function registerXuanjiTab(ctx, Panel) {
	ctx.effect(() => ctx.sidebarRightTabs.register(tabDefinition()),
		'dsh-xuanji: 右侧栏 tab 类型');
	ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
		name: 'sidebar.right.pane.tab',
		key: TAB_ID,
	}, Panel)), 'dsh-xuanji: 右侧栏 tab 内容');
}

/**
 * ③ 打开 tab —— 必须延迟 + 重试，见文件头。
 * @returns {Function} disposer
 */
export function openXuanjiTab(ctx, opts = {}) {
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
			log.info('[dsh-xuanji] 已打开右侧栏 tab（玄机阁）');
			return true;
		} catch (error) {
			tries += 1;
			if (tries < maxTries) {
				timer(attempt, 250);
			} else {
				log.warn('[dsh-xuanji] 自动打开右侧栏 tab 失败，可从右侧栏 guide 页手动进入', error);
			}
			return false;
		}
	};

	timer(attempt, 400);
	return () => { disposed = true; };
}
