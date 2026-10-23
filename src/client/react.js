// src/client/react.js — 从宿主模块表取 React 的**唯一出口**。
//
// 宿主播种的模块表（官方 CHUNK_EXTERNALS / PLATFORM_MODULES）只有：
//   react · react/jsx-runtime · react-dom · react-dom/client · cordis
//   · @deepseek-ai/dsh-client-ui-slots · @deepseek-ai/dsh-client-ui-primitives
// —— 别 import 表外的东西，构建时会被打进包里、运行时拿不到真正的宿主实例。
// 凡是要 React 的东西，一律走本模块。
import * as reactNamespace from 'react';

/** 从命名空间取函数：兼容 CJS 直出与 ESM 命名空间包装两种形态。 */
function pickFunction(namespace, name) {
	if (!namespace) return undefined;
	if (typeof namespace[name] === 'function') return namespace[name];
	const wrapped = namespace.default;
	if (wrapped && typeof wrapped[name] === 'function') return wrapped[name];
	return undefined;
}

/** 从命名空间取值（非函数）。 */
function pickValue(namespace, name) {
	if (!namespace) return undefined;
	if (namespace[name] !== undefined) return namespace[name];
	const wrapped = namespace.default;
	return wrapped ? wrapped[name] : undefined;
}

/** React.createElement —— 全插件统一的 h()。 */
export const createElement = pickFunction(reactNamespace, 'createElement');
/** 同 h（别名，读起来顺一点）。 */
export const h = createElement;
export const Fragment = pickValue(reactNamespace, 'Fragment');
export const Component = pickValue(reactNamespace, 'Component');

// hooks：面板是 slot 组件，靠这几个驱动重渲染。
export const useState = pickFunction(reactNamespace, 'useState');
export const useRef = pickFunction(reactNamespace, 'useRef');
export const useEffect = pickFunction(reactNamespace, 'useEffect');
