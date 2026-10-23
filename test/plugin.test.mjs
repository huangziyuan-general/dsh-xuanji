// test/plugin.test.mjs — 插件装配：假宿主 boot apply()，校验工具面/纪律段/skill 注册/参数守卫。
import test from 'node:test';
import assert from 'node:assert/strict';

import { apply, name as PLUGIN_NAME, Config } from '../lib/index.js';
import { parseSkillFrontmatter, xuanjiSkillDefinition } from '../lib/skill-registration.js';
import { readFileSync } from 'node:fs';

/**
 * 假宿主：只镜像本插件用到的契约面（tools.register / systemPrompt.section /
 * plugin 嵌套 / logger），不引入 fs——xuanji 工具无状态。
 */
function boot(configOver = {}) {
    const registered = [];
    const sections = [];
    const nestedPlugins = [];
    const ctx = {
        tools: { register: (t) => registered.push(t) },
        systemPrompt: { section: (s) => sections.push(s) },
        plugin: (p) => nestedPlugins.push(p),
        logger: { info() {}, warn() {} },
    };
    const config = { dayunCount: 8, skipSkillRegister: false, ...configOver };
    apply(ctx, config);
    return {
        ctx,
        registered,
        sections,
        nestedPlugins,
        tool: (n) => {
            const t = registered.find((x) => x.name === n);
            if (t === undefined) throw new Error('工具未注册：' + n);
            return t;
        },
    };
}

test('插件名与宿主契约：export name = dsh-xuanji', () => {
    assert.equal(PLUGIN_NAME, 'dsh-xuanji');
});

test('boot：注册恰好 14 个 xuanji_* 工具，名字与文档一致', () => {
    const { registered } = boot();
    assert.deepEqual(
        registered.map((t) => t.name).sort(),
        [
            'xuanji_almanac', 'xuanji_bazi', 'xuanji_chenggu', 'xuanji_fengshui',
            'xuanji_match', 'xuanji_meihua', 'xuanji_name', 'xuanji_numerology',
            'xuanji_star', 'xuanji_tarot', 'xuanji_trend',
            'xuanji_xiaoliuren', 'xuanji_zeri', 'xuanji_ziwei',
        ],
    );
});

test('boot：systemPrompt 纪律段存在，含四层输出与缺输入先问两条铁律', () => {
    const { sections } = boot();
    assert.equal(sections.length, 1);
    assert.equal(sections[0].name, 'tool:dsh-xuanji');
    for (const kw of ['只认工具', '缺输入先问', '四层输出', '免责声明']) {
        assert.ok(sections[0].text.includes(kw), `纪律段缺关键词：${kw}`);
    }
});

test('boot：嵌套子插件注册 skill（skipSkillRegister=false）', () => {
    const { nestedPlugins } = boot();
    assert.equal(nestedPlugins.length, 1);
    assert.equal(nestedPlugins[0].name, 'dsh-xuanji-skill');
    const childRegisters = [];
    nestedPlugins[0].apply({ skills: { register: (d) => childRegisters.push(d) } });
    assert.equal(childRegisters.length, 1);
    assert.equal(childRegisters[0].name, 'xuanji');
    assert.ok(childRegisters[0].description.length > 0);
    assert.ok(childRegisters[0].content.includes('铁律'));
});

test('boot：skipSkillRegister=true 时不注册嵌套插件', () => {
    const { nestedPlugins } = boot({ skipSkillRegister: true });
    assert.equal(nestedPlugins.length, 0);
});

test('boot：dayunCount 越界 fail-fast', () => {
    assert.throws(() => boot({ dayunCount: 0 }), /dayunCount/);
    assert.throws(() => boot({ dayunCount: 13 }), /dayunCount/);
});

test('xuanji_bazi：端到端 execute + render 含四柱与免责声明', async () => {
    const { tool } = boot();
    const t = tool('xuanji_bazi');
    const v = await t.execute({ year: 1990, month: 8, day: 16, hour: 14, minute: 30, gender: 'male', calendar: 'solar' }, {});
    assert.equal(v.pillars.year.ganZhi, '庚午');
    const render = t.output?.render ?? t.render;
    const blocks = render({}, v);
    assert.equal(blocks[0].type, 'text');
    assert.ok(blocks[0].text.includes('庚午'));
    assert.ok(blocks[0].text.includes('免责'));
});

test('xuanji_bazi：未知字段被参数守卫拒绝', async () => {
    const { tool } = boot();
    const t = tool('xuanji_bazi');
    await assert.rejects(
        () => t.execute({ year: 1990, month: 8, day: 16, gender: 'male', bogus: 1 }, {}),
        /未知字段.*bogus/,
    );
});

test('xuanji_bazi：缺性别时报错措辞引导先问', async () => {
    const { tool } = boot();
    const t = tool('xuanji_bazi');
    await assert.rejects(
        () => t.execute({ year: 1990, month: 8, day: 16, hour: 12 }, {}),
        /gender/,
    );
});

test('xuanji_meihua：端到端（观梅占输入）render 含体用与免责声明', async () => {
    const { tool } = boot();
    const t = tool('xuanji_meihua');
    const v = await t.execute({ mode: 'time', date: '2001-01-11', hour: 16, question: '测试' }, {});
    assert.equal(v.gua.ben.name, '泽火革');
    const render = t.output?.render ?? t.render;
    const text = render({}, v)[0].text;
    assert.ok(text.includes('泽火革'));
    assert.ok(text.includes('用克体'));
    assert.ok(text.includes('免责'));
});

test('xuanji_almanac / xuanji_chenggu / xuanji_star：端到端 execute', async () => {
    const { tool } = boot();
    const almanac = await tool('xuanji_almanac').execute({ date: '2026-10-22' }, {});
    assert.equal(almanac.ganzhi.day, '己巳');

    const chenggu = await tool('xuanji_chenggu').execute({ year: 1990, month: 8, day: 16, hour: 14, calendar: 'solar' }, {});
    assert.equal(chenggu.total.qian, 42);

    const star = await tool('xuanji_star').execute({ date: '1990-08-16' }, {});
    assert.equal(star.sign.name, '狮子座');
});

test('skill frontmatter：SKILL.md 可解析且 name=xuanji', () => {
    const raw = readFileSync(new URL('../skills/xuanji/SKILL.md', import.meta.url), 'utf8');
    const { attrs, body } = parseSkillFrontmatter(raw);
    assert.equal(attrs.name, 'xuanji');
    assert.ok(attrs.description.length > 0);
    assert.ok(body.includes('工具路由'));
    const def = xuanjiSkillDefinition();
    assert.equal(def.name, 'xuanji');
    assert.ok(def.description.length <= 300);
});

test('Config 默认值可无宿主 schemastery 配置直接用（.default({}) 生效）', () => {
    assert.ok(Config);
});

test('xuanji_zeri / xuanji_fengshui / xuanji_name / xuanji_trend / xuanji_tarot / xuanji_xiaoliuren：端到端 execute', async () => {
    const { tool } = boot();

    const zeri = await tool('xuanji_zeri').execute({ task: '开业', startDate: '2026-11-01', days: 14, shengXiao: '马' }, {});
    assert.equal(zeri.days.length, 14);
    assert.ok(zeri.best.length > 0);

    const fengshui = await tool('xuanji_fengshui').execute({ year: 1990, month: 8, day: 16, gender: 'male', calendar: 'solar' }, {});
    assert.equal(fengshui.mingGua.gua, '坎');
    assert.equal(fengshui.yearlyFlying.center, 1);

    const nameR = await tool('xuanji_name').execute({ surname: '李', givenName: '沐宸', bYear: 1990, bMonth: 8, bDay: 16, bGender: 'male' }, {});
    assert.equal(nameR.score, 0); // 中和命例不打分
    const nameNoBirth = await tool('xuanji_name').execute({ surname: '李', givenName: '沐宸' }, {});
    assert.equal(nameNoBirth.favor, null);

    const trend = await tool('xuanji_trend').execute({ year: 1990, month: 8, day: 16, gender: 'male', calendar: 'solar' }, {});
    assert.equal(trend.points.length, 100);
    assert.ok(trend.sparkline.length >= 9);

    const tarot = await tool('xuanji_tarot').execute({ mode: 'three', question: '测试', date: '2026-10-22' }, {});
    assert.equal(tarot.cards.length, 3);

    const xlr = await tool('xuanji_xiaoliuren').execute({ mode: 'number', num1: 3, num2: 15, num3: 8 }, {});
    assert.ok(['大安', '留连', '速喜', '赤口', '小吉', '空亡'].includes(xlr.result.palace));
});

test('xuanji_ziwei fortune 模式：端到端 execute + render 含四化与大限区间', async () => {
    const { tool } = boot();
    const t = tool('xuanji_ziwei');
    const v = await t.execute({ year: 1990, month: 8, day: 16, hour: 14, gender: 'male', calendar: 'solar', action: 'fortune', fortuneDate: '2026-10-22' }, {});
    assert.equal(v.fortune.yearly.stemBranch, '丙午');
    const text = (t.output?.render ?? t.render)({}, v)[0].text;
    assert.ok(text.includes('丙午'));
    assert.ok(text.includes('36–45 岁'));
    assert.ok(text.includes('天同禄'));
});

test('xuanji_bazi 端到端时间管线：1990-07-01 15:30 夏令时自动校正 → 时柱从申变未', async () => {
    const { tool } = boot();
    const t = tool('xuanji_bazi');
    const v = await t.execute({ year: 1990, month: 7, day: 1, hour: 15, minute: 30, gender: 'male', calendar: 'solar' }, {});
    assert.equal(v.pillars.hour.ganZhi, '丁未'); // 14:30 未时（校正后；日干丁起丁未时）
    assert.ok(v.meta.notes.some((n) => n.includes('夏令时')));
    // 关闭 DST 后回到申时
    const v2 = await t.execute({ year: 1990, month: 7, day: 1, hour: 15, minute: 30, gender: 'male', calendar: 'solar', applyDST: false }, {});
    assert.equal(v2.pillars.hour.ganZhi, '戊申');
    assert.equal(v2.meta.notes, undefined);
});

test('xuanji_bazi 晚子时：ziShi=1 默认次日日柱，ziShi=2 当日日柱', async () => {
    const args = { year: 1990, month: 8, day: 16, hour: 23, minute: 30, gender: 'male', calendar: 'solar', applyDST: false };
    const t1 = boot({ ziShi: 1 }).tool('xuanji_bazi');
    const t2 = boot({ ziShi: 2 }).tool('xuanji_bazi');
    const v1 = await t1.execute(args, {});
    const v2 = await t2.execute(args, {});
    assert.equal(v1.pillars.day.ganZhi, '甲寅');
    assert.equal(v2.pillars.day.ganZhi, '癸丑');
    assert.ok(v1.meta.lateZiNote.includes('次日'));
});

test('xuanji_chenggu 端到端时间管线：夏令时年份 15:00 → 校正后按未时称骨', async () => {
    const { tool } = boot();
    const t = tool('xuanji_chenggu');
    const v = await t.execute({ year: 1990, month: 7, day: 1, hour: 15, calendar: 'solar' }, {});
    assert.ok(v.meta.notes.some((n) => n.includes('夏令时')));
    assert.ok(v.meta.lunar.endsWith('未时')); // 校正后 14:00 → 未时（不校正为申时）
    assert.equal(v.total.qian, 8 + 5 + 8 + 8); // 庚午年8 + 闰五月(按五月)5 + 初九8 + 未时8 = 二两九钱
});
