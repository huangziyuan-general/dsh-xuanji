// test/client.test.mjs — 面板 bundle 的 headless 端到端：装载、注册契约、控制器行为、
// K线 spec、翻牌动画数据、构建产物守卫。全部真跑 lib/client.js，不做字符串幻觉断言。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createDom, loadClient, makeCtx, El } from './helpers/client-dom.mjs';

const BUNDLE = new URL('../lib/client.js', import.meta.url);

/** 装载 bundle（fetch 替身可注入）。 */
function boot(fetchStub) {
    const dom = createDom();
    const loaded = loadClient(dom, BUNDLE, fetchStub);
    return { dom, loaded };
}

/** 假 trend 响应（形状对齐 lib/engine/trend.js 的返回）。 */
const TREND_VALUE = {
    meta: { birth: '2026-06-01', gender: '男', dayMaster: '丙（阳火）', strength: { state: '中和', note: '测试注' }, toAge: 100, calendar: 'solar' },
    segments: [{ ganZhi: '甲午', startAge: 6, endAge: 15 }],
    points: Array.from({ length: 12 }, (_, i) => ({
        age: i + 1, year: 2026 + i, ganZhi: '丙午', score: 50 + i,
        kline: { open: 50 + i - 1, close: 50 + i, high: 54 + i, low: 46 + i },
    })),
    highlights: { best: ['12岁'], worst: ['1岁'] },
    sparkline: ['x'],
    sources: [], disclaimer: '测试免责',
};

/** 假 tarot 响应（形状对齐 lib/engine/tarot.js：三牌阵）。 */
const TAROT_VALUE = {
    meta: { mode: 'three', date: '2026-10-22', question: '测试所问' },
    cards: [
        { position: '过去', name: '愚人', orientation: '正位', keyword: '开始', text: '牌意A' },
        { position: '现在', name: '女皇', orientation: '逆位', keyword: '滞涩', text: '牌意B' },
        { position: '未来', name: '太阳', orientation: '正位', keyword: '光明', text: '牌意C' },
    ],
    sources: [], disclaimer: '测试免责',
};

test('装载契约：__ModuleLoader.load 注册 id=dsh-xuanji；react 走宿主模块表；无 ESM 语法残留', () => {
    const { loaded } = boot();
    assert.equal(loaded.id, 'dsh-xuanji');
    assert.deepEqual([...loaded.required].sort(), ['react']);
    const code = fs.readFileSync(BUNDLE, 'utf8');
    assert.ok(!/^\s*(import|export)\s/m.test(code), 'bundle 不能含 ESM 语法——dsh 按经典脚本执行');
});

test('apply：tab 类型 + 内容 seat + openTab 三步契约全部落地；effect 清理可执行', async () => {
    const { loaded } = boot();
    const { ctx, registered, opened, dispose } = makeCtx();
    loaded.exports.apply(ctx);
    assert.equal(registered.tabs.length, 1);
    assert.equal(registered.tabs[0].id, 'dsh-xuanji');
    assert.equal(registered.tabs[0].kind, 'xuanji');
    assert.equal(registered.slots.length, 1);
    assert.equal(registered.slots[0].spec.key, 'dsh-xuanji');
    assert.equal(registered.slots[0].spec.name, 'sidebar.right.pane.tab');
    assert.equal(typeof registered.slots[0].component, 'function');
    await loaded.timers.flush();
    assert.deepEqual(opened, ['xuanji'], 'openTab 有 400ms 延迟重试，flush 假定时器后应已打开');
    dispose(); // 不应抛错
});

test('openTab 抛错（seat 未挂载）时重试链可清理，apply 不炸', () => {
    const { loaded } = boot();
    const { ctx, opened } = makeCtx({ openTabThrows: true });
    assert.doesNotThrow(() => loaded.exports.apply(ctx));
    assert.equal(opened.length, 0);
});

test('K线 spec：蜡烛几何确定、阴阳配色锚定、分段线与年龄刻度齐全', () => {
    const { loaded } = boot();
    const { buildTrendSpec } = loaded.exports.__internals;
    const spec = buildTrendSpec(TREND_VALUE.points, TREND_VALUE.segments);
    assert.ok(spec);
    assert.equal(spec.candles.length, 12);
    // 收阳（close>open）→ up=true
    assert.ok(spec.candles[5].up);
    // 影线包住实体
    for (const c of spec.candles) {
        assert.ok(c.wick.y1 <= c.body.y, `high 线应高于实体顶：${JSON.stringify(c)}`);
        assert.ok(c.wick.y2 >= c.body.y + c.body.h, `low 线应低于实体底`);
        assert.ok(c.body.h >= 1, '实体高度至少 1px（dojen 不可消失）');
    }
    // 分段线：次段起点（甲午从 6 岁起）→ 在第 5/6 支蜡烛之间
    assert.equal(spec.segs.length, 1);
    assert.equal(spec.segs[0].label, '甲午');
    assert.ok(spec.xLabels.length >= 2);
    // 空数据 → null（面板不画空图）
    assert.equal(buildTrendSpec([], []), null);
});

test('renderTrendSvg：产出 svg vnode，蜡烛带 title 悬停提示', () => {
    const { loaded } = boot();
    const { buildTrendSpec, renderTrendSvg } = loaded.exports.__internals;
    const spec = buildTrendSpec(TREND_VALUE.points, TREND_VALUE.segments);
    const vnode = renderTrendSvg(spec, (type, config, ...kids) => ({ type, props: { ...config, children: kids } }));
    assert.equal(vnode.type, 'svg');
    // 断言格式而不是具体像素：画布尺寸是产品决策，会随视觉迭代调整，锁死数值没有意义
    assert.match(vnode.props.viewBox, /^0 0 \d+ \d+$/);
    const flat = JSON.stringify(vnode);
    assert.ok(flat.includes('title'), '每支蜡烛应有 <title> 悬停提示');
    assert.ok(flat.includes('rect'), '应有实体 rect');
});

test('翻牌动画数据：TarotCard 三牌渲染 flipped 类切换、牌背/牌面结构齐全', () => {
    const { loaded } = boot();
    const { TarotCard } = loaded.exports.__internals;
    const card = TAROT_VALUE.cards[1];
    const back = TarotCard({ card, index: 0, flipped: false, showPosition: true });
    assert.equal(back.props.className, 'xuanji-tcard');
    assert.equal(back.props['data-action'], 'card-flip');
    assert.equal(back.props['data-ci'], '0');
    assert.equal(back.props.children.props.className, 'xuanji-tcard-inner');
    const front = TarotCard({ card, index: 1, flipped: true, showPosition: true });
    assert.equal(front.props.className, 'xuanji-tcard flipped');
    const flat = JSON.stringify(front);
    for (const s of ['女皇', '逆位', '滞涩', 'xuanji-tface xuanji-tback', 'xuanji-tface xuanji-tfront']) {
        assert.ok(flat.includes(s), `牌面应含 ${s}`);
    }
});

test('CSS：翻牌关键帧与按钮 hover 规则进样式表；ensureStyles 幂等（单例）', () => {
    const { dom, loaded } = boot();
    const css = loaded.exports.__internals.buildCss();
    for (const s of ['xuanji-tcard-inner', 'preserve-3d', 'rotateY(180deg)', 'backface-visibility', ':hover', "flipped"]) {
        assert.ok(css.includes(s), `样式表应含 ${s}`);
    }
    const first = loaded.exports.__internals.ensureStyles(dom.document);
    assert.ok(first);
    const second = loaded.exports.__internals.ensureStyles(dom.document);
    assert.equal(first, second, 'ensureStyles 必须收养已有样式表（单例）');
    assert.equal(dom.document.querySelectorAll('style').length, 1);
});

test('控制器：switch-view / card-flip 事件代理改状态', () => {
    const { loaded } = boot();
    const { createXuanjiController, initialState } = loaded.exports.__internals;
    let renders = 0;
    const controller = createXuanjiController({ onChange: () => { renders += 1; } });
    assert.deepEqual(Object.keys(controller.state), ['view', 'trend', 'tarot', 'bazi', 'almanac', 'quick', 'chenggu']);
    const node = new El('div');
    node.setAttribute('data-xuanji-panel', '1');
    const dispose = controller.attach(node);

    const tabBtn = new El('button');
    tabBtn.setAttribute('data-action', 'switch-view');
    tabBtn.setAttribute('data-view', 'tarot');
    node.appendChild(tabBtn);
    tabBtn.click();
    assert.equal(controller.state.view, 'tarot');

    controller.state.tarot = { ...initialState().tarot, result: TAROT_VALUE, flipped: new Set() };
    const cardBtn = new El('div');
    cardBtn.setAttribute('data-action', 'card-flip');
    cardBtn.setAttribute('data-ci', '1');
    node.appendChild(cardBtn);
    cardBtn.click();
    assert.ok(controller.state.tarot.flipped.has(1));
    cardBtn.click();
    assert.ok(!controller.state.tarot.flipped.has(1));
    assert.ok(renders >= 3);
    dispose();
    // 卸载后点击不再改状态
    const before = controller.state.view;
    tabBtn.setAttribute('data-view', 'trend');
    tabBtn.click();
    assert.equal(controller.state.view, before);
});

test('控制器：trend 提交——读表单、打 /api/xuanji/trend、结果落地；缺输入 fail-fast 可见', async () => {
    const requests = [];
    const { loaded } = boot((url) => {
        requests.push(String(url));
        return Promise.resolve({ json: () => Promise.resolve({ ok: true, value: TREND_VALUE }) });
    });
    const { createXuanjiController, PANEL_ATTR } = loaded.exports.__internals;
    const controller = createXuanjiController({ onChange: () => {} });
    const node = new El('div');
    node.setAttribute(PANEL_ATTR, '1');
    controller.attach(node);
    for (const [tf, value] of [['year', '2026'], ['month', '6'], ['day', '1'], ['hour', ''], ['gender', 'female'], ['toAge', '100']]) {
        const input = new El('input');
        input.setAttribute('data-tf', tf);
        input.value = value;
        node.appendChild(input);
    }
    const submit = new El('button');
    submit.setAttribute('data-action', 'trend-submit');
    node.appendChild(submit);

    submit.click();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    assert.equal(requests.length, 1);
    assert.match(requests[0], /\/api\/xuanji\/trend\?year=2026&month=6&day=1&gender=female&toAge=100/);
    assert.ok(!controller.state.trend.error);
    assert.equal(controller.state.trend.result.meta.birth, '2026-06-01');
    assert.equal(controller.state.trend.loading, false);

    // 缺年 fail-fast：错误写进 state（面板可见），不丢在控制台
    controller.state.trend.form = null;
    const inputYear = node.querySelectorAll('[data-tf="year"]')[0];
    inputYear.value = '';
    submit.click();
    await new Promise((r) => setImmediate(r));
    assert.match(controller.state.trend.error ?? '', /年月日/);
});

test('控制器：tarot 三牌阵缺所问 fail-fast；daily 放行无 question', async () => {
    const requests = [];
    const { loaded } = boot((url) => {
        requests.push(String(url));
        return Promise.resolve({ json: () => Promise.resolve({ ok: true, value: TAROT_VALUE }) });
    });
    const { createXuanjiController, PANEL_ATTR } = loaded.exports.__internals;
    const controller = createXuanjiController({ onChange: () => {} });
    const node = new El('div');
    node.setAttribute(PANEL_ATTR, '1');
    controller.attach(node);
    const mode = new El('select');
    mode.setAttribute('data-tf', 'mode');
    node.appendChild(mode);
    const question = new El('input');
    question.setAttribute('data-tf', 'question');
    node.appendChild(question);
    const draw = new El('button');
    draw.setAttribute('data-action', 'tarot-draw');
    node.appendChild(draw);

    mode.value = 'three';
    question.value = '';
    draw.click();
    await new Promise((r) => setImmediate(r));
    assert.match(controller.state.tarot.error ?? '', /所问何事/);
    assert.equal(requests.length, 0, '三牌阵缺问题不应发请求');

    mode.value = 'daily';
    draw.click();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    assert.equal(requests.length, 1);
    assert.match(requests[0], /\/api\/xuanji\/tarot\?mode=daily/);
    assert.equal(controller.state.tarot.result.cards.length, 3);
});

test('控制器：八字提交打 /bazi、城市透传；缺年月日 fail-fast 不发请求', async () => {
    const requests = [];
    const { loaded } = boot((url) => {
        requests.push(String(url));
        return Promise.resolve({ json: () => Promise.resolve({ ok: true, value: { pillars: { year: { ganZhi: '庚午' } } } }) });
    });
    const { createXuanjiController, PANEL_ATTR } = loaded.exports.__internals;
    const controller = createXuanjiController({ onChange: () => {} });
    const node = new El('div');
    node.setAttribute(PANEL_ATTR, '1');
    controller.attach(node);
    for (const [tf, value] of [['year', '1998'], ['month', '7'], ['day', '31'], ['hour', '14'], ['gender', 'male'], ['city', '成都']]) {
        const input = new El('input');
        input.setAttribute('data-tf', tf);
        input.value = value;
        node.appendChild(input);
    }
    const submit = new El('button');
    submit.setAttribute('data-action', 'bazi-submit');
    node.appendChild(submit);
    // 先测缺输入：清空年 → fail-fast 可见、零请求
    node.querySelectorAll('[data-tf="year"]')[0].value = '';
    submit.click();
    await new Promise((r) => setImmediate(r));
    assert.match(controller.state.bazi.error ?? '', /出生年月日/);
    assert.equal(requests.length, 0);
    // 再补上 → 请求发出且参数齐
    node.querySelectorAll('[data-tf="year"]')[0].value = '1998';
    submit.click();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    assert.equal(requests.length, 1);
    assert.match(requests[0], /\/api\/xuanji\/bazi\?year=1998&month=7&day=31&gender=male&hour=14&city=/);
    assert.ok(controller.state.bazi.result);
});

test('控制器：黄历页首次进入自动查今天；坏日期 fail-fast 不发请求', async () => {
    const requests = [];
    const { loaded } = boot((url) => {
        requests.push(String(url));
        return Promise.resolve({ json: () => Promise.resolve({ ok: true, value: { meta: { date: '2026-10-22', isToday: true } } }) });
    });
    const { createXuanjiController, PANEL_ATTR } = loaded.exports.__internals;
    const controller = createXuanjiController({ onChange: () => {} });
    const node = new El('div');
    node.setAttribute(PANEL_ATTR, '1');
    controller.attach(node);
    const tab = new El('button');
    tab.setAttribute('data-action', 'switch-view');
    tab.setAttribute('data-view', 'almanac');
    node.appendChild(tab);
    tab.click();
    assert.equal(controller.state.view, 'almanac');
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    assert.equal(requests.length, 1, '首次进黄历页应自动查一次（缺省=今天）');
    assert.match(requests[0], /\/api\/xuanji\/almanac$/);
    assert.ok(controller.state.almanac.result);
    // 已有结果再切走切回，不重复请求
    const back = new El('button');
    back.setAttribute('data-action', 'switch-view');
    back.setAttribute('data-view', 'trend');
    node.appendChild(back);
    back.click();
    tab.click();
    await new Promise((r) => setImmediate(r));
    assert.equal(requests.length, 1, '已有结果不应重复自动查询');
    // 坏日期：手动提交要报错且不发请求
    const date = new El('input');
    date.setAttribute('data-tf', 'date');
    date.value = '2026/10/22';
    node.appendChild(date);
    const submit = new El('button');
    submit.setAttribute('data-action', 'almanac-submit');
    node.appendChild(submit);
    submit.click();
    await new Promise((r) => setImmediate(r));
    assert.match(controller.state.almanac.error ?? '', /YYYY-MM-DD/);
    assert.equal(requests.length, 1);
});

test('控制器：快占小六壬三数/梅花两数分别打对端点；缺数 fail-fast', async () => {
    const requests = [];
    const { loaded } = boot((url) => {
        requests.push(String(url));
        return Promise.resolve({ json: () => Promise.resolve({ ok: true, value: { result: { palace: '大安' } } }) });
    });
    const { createXuanjiController, PANEL_ATTR } = loaded.exports.__internals;
    const controller = createXuanjiController({ onChange: () => {} });
    const node = new El('div');
    node.setAttribute(PANEL_ATTR, '1');
    controller.attach(node);
    const mk = (tag) => { const e = new El(tag); node.appendChild(e); return e; };
    const kind = mk('select'); kind.setAttribute('data-tf', 'kind'); kind.value = 'xiaoliuren';
    const question = mk('input'); question.setAttribute('data-tf', 'question'); question.value = '测试所问';
    const n1 = mk('input'); n1.setAttribute('data-tf', 'num1'); n1.value = '3';
    const n2 = mk('input'); n2.setAttribute('data-tf', 'num2'); n2.value = '17';
    const n3 = mk('input'); n3.setAttribute('data-tf', 'num3'); n3.value = '8';
    const cast = mk('button'); cast.setAttribute('data-action', 'quick-cast');
    // 小六壬：三数齐 → /xiaoliuren
    cast.click();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    assert.equal(requests.length, 1);
    assert.match(requests[0], /\/api\/xuanji\/xiaoliuren\?num1=3&num2=17&num3=8&question=/);
    assert.ok(controller.state.quick.result);
    // 切梅花：只两数（num3 被忽略）→ /meihua
    kind.value = 'meihua';
    cast.click();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    assert.equal(requests.length, 2);
    assert.match(requests[1], /\/api\/xuanji\/meihua\?num1=3&num2=17&question=/);
    // 缺数 fail-fast
    n1.value = '';
    cast.click();
    await new Promise((r) => setImmediate(r));
    assert.match(controller.state.quick.error ?? '', /报数/);
    assert.equal(requests.length, 2);
});

test('控制器：称骨缺时辰 fail-fast（纪律在面板同样生效）', async () => {
    const requests = [];
    const { loaded } = boot((url) => {
        requests.push(String(url));
        return Promise.resolve({ json: () => Promise.resolve({ ok: true, value: { total: { qian: 39, label: '三两九钱' } } }) });
    });
    const { createXuanjiController, PANEL_ATTR } = loaded.exports.__internals;
    const controller = createXuanjiController({ onChange: () => {} });
    const node = new El('div');
    node.setAttribute(PANEL_ATTR, '1');
    controller.attach(node);
    for (const [tf, value] of [['year', '1984'], ['month', '2'], ['day', '2'], ['hourZhi', '']]) {
        const input = new El('input');
        input.setAttribute('data-tf', tf);
        input.value = value;
        node.appendChild(input);
    }
    const submit = new El('button');
    submit.setAttribute('data-action', 'chenggu-submit');
    node.appendChild(submit);
    submit.click();
    await new Promise((r) => setImmediate(r));
    assert.match(controller.state.chenggu.error ?? '', /时辰/);
    assert.equal(requests.length, 0);
    node.querySelectorAll('[data-tf="hourZhi"]')[0].value = '子';
    submit.click();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    assert.equal(requests.length, 1);
    assert.match(requests[0], /\/api\/xuanji\/chenggu\?year=1984&month=2&day=2&hourZhi=/);
    assert.ok(controller.state.chenggu.result);
});

test('渲染：八字四柱卡/五行条/神煞 chips 与黄历宜忌卡的纯渲染输出', () => {
    const { loaded } = boot();
    const { PillarCard, WuxingBars, RelationBadges, ShenShaChips } = loaded.exports.__internals;
    const pillar = PillarCard({ label: '日柱', p: { ganZhi: '己卯', shiShenGan: '日主', yinYang: '阴', wuxing: { gan: '土', zhi: '木' }, naYin: '城头土', xingYun: '病', xunKong: '申酉', cangGan: [{ gan: '乙', shiShen: '七杀' }] }, dayGan: '己' });
    const pflat = JSON.stringify(pillar);
    for (const t of ['己卯', '日柱', '城头土', '病', '申酉', '乙(七杀)']) assert.ok(pflat.includes(t), `四柱卡应含 ${t}`);
    const bars = JSON.stringify(WuxingBars({ counts: { 金: 1, 木: 2, 水: 0, 火: 0, 土: 5 }, summary: '金1 木2 水0 火0 土5' }));
    assert.ok(bars.includes('金1 木2 水0 火0 土5'));
    assert.ok(bars.includes('width'), '五行条应有归一宽度');
    const badges = JSON.stringify(RelationBadges({ relations: [{ text: '日支丑与时支未六冲（凶）', tone: '凶' }] }));
    assert.ok(badges.includes('六冲'));
    const chips = JSON.stringify(ShenShaChips({ stars: [{ name: '天乙贵人', type: '吉星', hits: [{ pillar: '日柱', char: '卯' }], rule: '甲戊庚牛羊' }] }));
    assert.ok(chips.includes('天乙贵人'));
});

test('控制器：历法切换——选农历后请求带 calendar=lunar，勾闰月再带 isLeapMonth=1', async () => {
    const requests = [];
    const { loaded } = boot((url) => {
        requests.push(String(url));
        return Promise.resolve({ json: () => Promise.resolve({ ok: true, value: { pillars: {} } }) });
    });
    const { createXuanjiController, PANEL_ATTR } = loaded.exports.__internals;
    const controller = createXuanjiController({ onChange: () => {} });
    const node = new El('div');
    node.setAttribute(PANEL_ATTR, '1');
    controller.attach(node);
    for (const [tf, value] of [['year', '1990'], ['month', '8'], ['day', '16'], ['gender', 'male']]) {
        const input = new El('input');
        input.setAttribute('data-tf', tf);
        input.value = value;
        node.appendChild(input);
    }
    // 历法分段控件（公历/农历）+ 闰月复选，镜像 ui.js 的 CalendarField 结构
    const seg = new El('div');
    seg.className = 'o-seg';
    seg.setAttribute('data-seg', 'calendar');
    seg.setAttribute('data-value', 'lunar');
    const hidden = new El('input');
    hidden.setAttribute('data-tf', 'calendar');
    hidden.value = 'lunar';
    seg.appendChild(hidden);
    node.appendChild(seg);
    const leap = new El('input');
    leap.setAttribute('type', 'checkbox');
    leap.setAttribute('data-tf', 'isLeapMonth');
    leap.checked = true;
    node.appendChild(leap);

    const submit = new El('button');
    submit.setAttribute('data-action', 'bazi-submit');
    node.appendChild(submit);
    submit.click();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    assert.equal(requests.length, 1);
    assert.match(requests[0], /calendar=lunar/, '农历必须进请求串，否则服务端一律按公历排盘');
    assert.match(requests[0], /isLeapMonth=1/, '勾了闰月就必须带上，闰月和平月四柱不同');

    // 切回公历：闰月参数必须消失（公历下勾闰月没有意义，留着会让服务端误判）
    seg.setAttribute('data-value', 'solar');
    hidden.value = 'solar';
    requests.length = 0;
    submit.click();
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    assert.doesNotMatch(requests[0], /calendar=/);
    assert.doesNotMatch(requests[0], /isLeapMonth/);
});

test('控制器：点选历法分段控件会把选择回写进当前页表单（农历才长得出闰月勾）', () => {
    const { loaded } = boot();
    const { createXuanjiController, PANEL_ATTR } = loaded.exports.__internals;
    const controller = createXuanjiController({ onChange: () => {} });
    const node = new El('div');
    node.setAttribute(PANEL_ATTR, '1');
    controller.attach(node);
    controller.state.view = 'bazi';
    const seg = new El('div');
    seg.className = 'o-seg';
    seg.setAttribute('data-seg', 'calendar');
    seg.setAttribute('data-value', 'solar');
    const item = new El('button');
    item.className = 'o-seg-item';
    item.setAttribute('data-seg-value', 'lunar');
    seg.appendChild(item);
    node.appendChild(seg);
    item.click();
    // 视图是纯渲染，读不到 DOM 里的当前选择——只能靠这份快照长出闰月勾选框
    assert.equal(controller.state.bazi.form?.calendar, 'lunar');
    assert.equal(seg.getAttribute('data-value'), 'lunar');
});

test('渲染：农历模式下出生信息区出现「闰月」勾选，公历模式不出现', () => {
    const { loaded } = boot();
    const { BaziView } = loaded.exports.__internals;
    const lunar = JSON.stringify(BaziView({ state: { bazi: { form: { calendar: 'lunar' } } } }));
    assert.ok(lunar.includes('闰月'), '农历模式必须有闰月勾选（闰月不是每年都有，勾错等于换了一个月）');
    assert.ok(lunar.includes('农历'), '应当提示当前按农历填写');
    const solar = JSON.stringify(BaziView({ state: { bazi: { form: { calendar: 'solar' } } } }));
    assert.ok(!solar.includes('闰月'), '公历模式不该出现闰月勾选');
});

test('渲染：塔罗「所问何事」输入框两种模式都常驻——不能等抽牌报错才现身', () => {
    const { loaded } = boot();
    const { TarotView } = loaded.exports.__internals;
    for (const mode of ['daily', 'three']) {
        const html = JSON.stringify(TarotView({ state: { tarot: { mode, question: '', result: null } } }));
        assert.ok(html.includes('data-tf":"question"') || html.includes('data-tf\\\\":\\\\\\"question'),
            `${mode} 模式必须有常驻的问题输入框`);
        assert.ok(html.includes(mode === 'three' ? '三牌阵必填' : '可留空'), `${mode} 模式标签口径不对`);
    }
});

test('渲染：时辰一律下拉选择（手输 0–23 会错时柱），且小时→时辰映射正确', () => {
    const { loaded } = boot();
    const { BaziView, TrendView, HOUR_OPTIONS, hourToZhi } = loaded.exports.__internals;

    // 映射：子时跨 23–01，最容易写错的是 0 点落子和 23 点落亥
    assert.equal(hourToZhi(0), '子', '0 点属子时（23–01），不是亥');
    assert.equal(hourToZhi(23), '子', '23 点属子时');
    assert.equal(hourToZhi(1), '丑');
    assert.equal(hourToZhi(13), '未');
    assert.equal(hourToZhi(14), '未');
    assert.equal(HOUR_OPTIONS.length, 25, '24 个小时 + 一个「不知道时辰」空选项');

    for (const [name, View, key] of [['八字', BaziView, 'bazi'], ['人生K线', TrendView, 'trend']]) {
        const html = JSON.stringify(View({ state: { [key]: { form: { calendar: 'solar', hour: '14' } } } }));
        assert.ok(html.includes('data-tf":"hour"'), `${name} 页必须有 hour 字段`);
        assert.ok(html.includes('"type":"select"'), `${name} 页的时辰必须是下拉 <select>，不能手输`);
        assert.ok(html.includes('不知道时辰（留空）'), `${name} 页必须提供「时辰未知」选项`);
        assert.ok(html.includes('14 时 · 未时'), `${name} 页小时标签要标出所属时辰`);
    }
});

test('构建产物守卫：PLUGIN_VERSION 与 package.json 一致；fence/PREFIX 与服务端一致', () => {
    const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    const src = fs.readFileSync(new URL('../src/client/index.js', import.meta.url), 'utf8');
    const v = src.match(/PLUGIN_VERSION\s*=\s*['"]([^'"]+)['"]/)?.[1];
    assert.equal(v, pkg.version, 'src/client 版本漂移：两处必须同步');
    const api = fs.readFileSync(new URL('../src/client/api.js', import.meta.url), 'utf8');
    const http = fs.readFileSync(new URL('../lib/server-http.js', import.meta.url), 'utf8');
    const clientBase = api.match(/API_BASE = '([^']+)'/)?.[1];
    const clientFence = api.match(/FENCE = '([^']+)'/)?.[1];
    const serverPrefix = http.match(/PREFIX = '([^']+)'/)?.[1];
    const serverFence = http.match(/FENCE_HEADER = '([^']+)'/)?.[1];
    assert.equal(clientBase, serverPrefix, 'client 与 server 的挂载点必须一致');
    assert.equal(clientFence, serverFence, 'client 与 server 的 fence 头必须一致');
});
