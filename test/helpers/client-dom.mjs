// test/helpers/client-dom.mjs — headless 装载体：在 node 里真跑 lib/client.js 的 apply()。
//
// 教训（novel-forge 同款）：client 测试不能写成 `assert.ok(code.includes(...))` 字符串
// 断言——那测的是幻觉。这里给可执行替身：真跑 apply()，断言实际注册了什么、实际打了
// 哪些请求、控制器状态真的变了没有。
//
// ★ 替身必须镜像**宿主真机**：react 有 hooks 但没有 createRoot；
//   ctx.slots.inject(name, cb) 是官方写法；ctx.effect(fn) 立刻执行 fn、返回值登记清理。
import fs from 'node:fs';
import vm from 'node:vm';

// ── 极简 DOM（panel.js 的 attach() 要往容器上挂事件代理）──

function matchSimple(el, sel) {
    const m = sel.match(/^([a-zA-Z0-9]*)\[([a-zA-Z0-9-]+)([*^$]?)="([^"]*)"\]$/);
    if (m) {
        const [, tag, attr, op, val] = m;
        if (tag && el.tagName.toLowerCase() !== tag.toLowerCase()) return false;
        const actual = el.attrs[attr];
        if (actual === undefined) return false;
        if (op === '*') return String(actual).includes(val);
        if (op === '^') return String(actual).startsWith(val);
        return String(actual) === val;
    }
    const m2 = sel.match(/^([a-zA-Z0-9]*)\[([a-zA-Z0-9-]+)\]$/);
    if (m2) {
        const [, tag, attr] = m2;
        if (tag && el.tagName.toLowerCase() !== tag.toLowerCase()) return false;
        return el.attrs[attr] !== undefined;
    }
    if (sel.startsWith('.')) return (el.attrs.class || '').split(/\s+/).includes(sel.slice(1));
    if (sel.startsWith('#')) return el.id === sel.slice(1);
    return el.tagName.toLowerCase() === sel.toLowerCase();
}
function matchesSelector(el, selector) {
    return selector.split(',').map((s) => s.trim()).some((s) => matchSimple(el, s));
}
function walk(el, out = []) {
    for (const c of el.children) { out.push(c); walk(c, out); }
    return out;
}

export class El {
    constructor(tag) {
        this.tagName = tag.toUpperCase();
        this.nodeType = 1;
        this.attrs = {};
        this.children = [];
        this.parentElement = null;
        this.value = '';
        this._listeners = {};
    }
    setAttribute(k, v) { this.attrs[k] = String(v); }
    getAttribute(k) { return this.attrs[k] ?? null; }
    get className() { return this.attrs.class; } set className(v) { this.attrs.class = v; }
    appendChild(n) { n.parentElement = this; this.children.push(n); return n; }
    addEventListener(t, fn) { (this._listeners[t] ||= []).push(fn); }
    removeEventListener(t, fn) {
        const list = this._listeners[t];
        if (!list) return;
        const i = list.indexOf(fn);
        if (i >= 0) list.splice(i, 1);
    }
    /** 沿 parentElement 链冒泡派发（容器级代理靠它命中）。 */
    dispatch(type, event = {}) {
        let node = this;
        while (node) {
            for (const fn of [...(node._listeners[type] ?? [])]) {
                fn({ preventDefault() {}, stopPropagation() {}, target: this, ...event });
            }
            node = node.parentElement;
        }
    }
    click() { this.dispatch('click'); }
    querySelector(sel) { return walk(this).find((e) => matchesSelector(e, sel)) ?? null; }
    querySelectorAll(sel) { return walk(this).filter((e) => matchesSelector(e, sel)); }
    closest(sel) { let n = this; while (n) { if (matchesSelector(n, sel)) return n; n = n.parentElement; } return null; }
    contains(n) { return n === this || walk(this).includes(n); }
}

/** 最小 document（有 head——样式表注入要它）。 */
export function createDom() {
    const head = new El('head');
    const body = new El('body');
    const allNodes = () => [head, ...walk(head), body, ...walk(body)];
    const document = {
        head, body,
        createElement: (t) => new El(t),
        getElementById: (id) => allNodes().find((e) => e.id === id) ?? null,
        querySelectorAll: (sel) => allNodes().filter((e) => matchesSelector(e, sel)),
    };
    return { document, head, body };
}

/** 宿主模块表替身（官方 CHUNK_EXTERNALS）。react 提供 hooks，故意不提供 createRoot。 */
function hostModuleTable() {
    const createElement = (type, config, ...kids) => {
        if (type === undefined || type === null) return null;
        const { key = null, ref = null, ...props } = config ?? {};
        if (kids.length > 0) props.children = kids.length === 1 ? kids[0] : kids;
        return { $$typeof: Symbol.for('react.element'), type, key, ref, props, _owner: null };
    };
    return {
        'react': {
            createElement,
            Fragment: Symbol('Fragment'),
            Component: class { constructor(p) { this.props = p; } },
            useState: (init) => [typeof init === 'function' ? init() : init, () => {}],
            useRef: (init) => ({ current: init }),
            useEffect: () => {},
        },
        'react/jsx-runtime': { jsx: createElement, jsxs: createElement },
        'react-dom': {},
        'react-dom/client': {},
        'cordis': {},
    };
}

/** 记账式假定时器：只入队不真跑，测试手动 flush。 */
function makeTimers() {
    let seq = 0;
    const queue = [];
    const cancelled = new Set();
    const setTimer = (fn, ms) => { const id = ++seq; queue.push({ id, fn, ms }); return id; };
    const clearTimer = (id) => { cancelled.add(id); };
    const flush = async (rounds = 20) => {
        for (let i = 0; i < rounds; i++) {
            const batch = queue.splice(0, queue.length).filter((t) => !cancelled.has(t.id));
            if (batch.length === 0) return;
            for (const t of batch) { try { t.fn(); } catch { /* 被测代码自己兜 */ } }
            await new Promise((resolve) => setImmediate(resolve));
        }
    };
    return { setTimer, clearTimer, flush, pending: () => queue.filter((t) => !cancelled.has(t.id)).length };
}

/**
 * 以 __ModuleLoader__ 语义加载 lib/client.js 并物化 exports。
 * @param {object} fetchStub 替换 fetch（记账式，返回固定 payload）
 */
export function loadClient(dom, bundlePath, fetchStub) {
    const code = fs.readFileSync(bundlePath, 'utf8');
    const timers = makeTimers();
    const requests = [];
    let registration;
    const sandbox = {
        window: { __ModuleLoader__: { load: (r) => { registration = r; } } },
        document: dom.document,
        setTimeout: timers.setTimer,
        clearTimeout: timers.clearTimer,
        // vm 上下文没有 node 全局：URL/URLSearchParams 等宿主 API 要显式播种
        URL,
        URLSearchParams,
        AbortController,
        fetch: fetchStub ?? ((url) => {
            requests.push({ url });
            return Promise.resolve({ json: () => Promise.resolve({ ok: true, value: {} }) });
        }),
        console: { info: () => {}, warn: () => {}, error: () => {}, log: () => {} },
    };
    sandbox.globalThis = sandbox;
    vm.runInContext(code, vm.createContext(sandbox));
    if (!registration) throw new Error('client.js 没有调用 __ModuleLoader__.load');
    const table = hostModuleTable();
    const required = [];
    const require = (spec) => {
        required.push(spec);
        if (!(spec in table)) throw new Error('宿主未播种模块 "' + spec + '"');
        return table[spec];
    };
    return { id: registration.id, exports: registration.factory(require), required, sandbox, timers, requests };
}

/** 真实语义的 cordis ctx 替身：effect 立刻执行、返回值登记清理。 */
export function makeCtx(opts = {}) {
    const cleanups = [];
    const registered = { tabs: [], slots: [] };
    const opened = [];
    let openTabThrows = opts.openTabThrows === true;
    const ctx = {
        effect: (fn) => {
            const cleanup = fn();
            if (typeof cleanup !== 'function') return () => {};
            cleanups.push(cleanup);
            return () => cleanup();
        },
        slots: {
            register: (spec, component) => { registered.slots.push({ spec, component }); return () => {}; },
            inject: (_name, cb) => cb(),
        },
        sidebarRightTabs: {
            register: (definition) => { registered.tabs.push(definition); return () => {}; },
        },
        sidebarRight: {
            openTab: (kind) => {
                if (openTabThrows) throw new Error('seat not mounted');
                opened.push(kind);
            },
        },
        _registered: registered,
        _opened: opened,
        _setOpenTabThrows: (v) => { openTabThrows = v; },
    };
    return { ctx, registered, opened, cleanups, dispose: () => { for (const fn of cleanups.splice(0)) fn(); } };
}
