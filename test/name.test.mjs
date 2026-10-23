// test/name.test.mjs — 起名：评估（一期）+ 候选生成（二期）。
import test from 'node:test';
import assert from 'node:assert/strict';

import { assessName, generateNames, CHAR_WUXING, CANDIDATE_CHARS } from '../lib/engine/name.js';
import { GAN, GAN_WUXING, ZHI, ZHI_WUXING } from '../lib/engine/tables.js';

test('字库：约 240 字全有五行值，无占位垃圾键', () => {
    const entries = Object.entries(CHAR_WUXING);
    assert.ok(entries.length >= 220 && entries.length <= 260);
    for (const [ch, w] of entries) {
        assert.equal([...ch].length, 1, `字库键应为单字：${ch}`);
        assert.ok(['金', '木', '水', '火', '土'].includes(w), `非法五行：${ch}→${w}`);
    }
});

test('无生辰：只列各字五行，不评分', () => {
    const r = assessName({ surname: '李', givenName: '沐宸' });
    assert.equal(r.favor, null);
    assert.deepEqual(r.chars.map((c) => c.wuxing), ['水', '土']);
    assert.equal(r.verdict.verdict, '未评');
});

test('有生辰：喜用匹配评分（1990-08-16 未时男：日主癸水中和 → 喜用 null 不评分）', () => {
    const r = assessName({
        surname: '李', givenName: '沐宸',
        birth: { year: 1990, month: 8, day: 16, hour: 14, gender: 'male', calendar: 'solar' },
    });
    assert.ok(r.meta.bazi);
    assert.equal(r.meta.bazi.dayMaster.gan, '癸');
    // 该命例旺衰为中和 → favorable=null，逐字不打分
    assert.equal(r.favor.favorable, null);
    assert.equal(r.score, 0);
});

test('未收录字符如实标注（不臆断五行）', () => {
    const r = assessName({ surname: '王', givenName: '䶮' }); // 生僻字
    assert.equal(r.chars[0].status, '未收录');
    assert.equal(r.chars[0].wuxing, null);
});

test('缺名 fail-fast；名字超长 fail-fast；有生辰缺性别 fail-fast', () => {
    assert.throws(() => assessName({ surname: '李' }), /givenName/);
    assert.throws(() => assessName({ surname: '李', givenName: '欧阳娜娜子' }), /1–2/);
    assert.throws(() => assessName({ surname: '李', givenName: '沐宸', birth: { year: 1990, month: 8, day: 16 } }), /gender/);
});

test('确定性：同输入两次结果一致', () => {
    const input = { surname: '李', givenName: '沐宸', birth: { year: 1990, month: 8, day: 16, hour: 14, gender: 'male', calendar: 'solar' } };
    assert.deepEqual(assessName(input), assessName(input));
});

// ── 二期：候选生成 ──

test('候选字库：全部取自 CHAR_WUXING（五行查表不落空）、带字义与性别标注', () => {
    assert.ok(CANDIDATE_CHARS.length >= 120, `候选字库应 ≥120 字（当前 ${CANDIDATE_CHARS.length}）`);
    for (const x of CANDIDATE_CHARS) {
        assert.ok(CHAR_WUXING[x.c], `候选字 ${x.c} 必须在 CHAR_WUXING 中`);
        assert.ok(['金', '木', '水', '火', '土'].includes(CHAR_WUXING[x.c]));
        assert.equal(typeof x.meaning, 'string');
        assert.ok(x.meaning.length >= 2, `字义太短：${x.c}`);
        assert.ok(['m', 'f', 'n'].includes(x.g), `非法性别标注：${x.c}→${x.g}`);
    }
    // 无重复字
    assert.equal(new Set(CANDIDATE_CHARS.map((x) => x.c)).size, CANDIDATE_CHARS.length);
});

test('generate：确定性、top10、双字为主且首字不重复刷屏', () => {
    const input = { surname: '李', birth: { year: 2026, month: 6, day: 1, gender: 'female' } };
    const r1 = generateNames(input);
    const r2 = generateNames(input);
    assert.deepEqual(r1.candidates, r2.candidates);
    assert.equal(r1.candidates.length, 10);
    assert.ok(r1.candidates.every((c) => c.name.startsWith('李')));
    const doubleFirsts = r1.candidates.filter((c) => c.given.length === 2).map((c) => c.given[0]);
    assert.equal(new Set(doubleFirsts).size, doubleFirsts.length, `双字名首字应去重：${doubleFirsts.join(',')}`);
    // 至少含单字与双字两种形态
    assert.ok(r1.candidates.some((c) => c.given.length === 1));
    assert.ok(r1.candidates.some((c) => c.given.length === 2));
    // 每个候选带字义
    assert.ok(r1.candidates.every((c) => c.chars.every((x) => x.meaning)));
});

test('generate：喜用筛字——合喜用候选的每字五行都在喜用集合内', () => {
    const r = generateNames({ surname: '李', birth: { year: 2026, month: 6, day: 1, gender: 'female' } });
    assert.ok(r.favor.favorable, '该命例应有非空喜用');
    const fit = r.favor.favorable;
    // 双字候选分值=2 且逐字五行都在喜用里
    for (const c of r.candidates.filter((x) => x.chars.length === 2)) {
        assert.equal(c.score, 2);
        assert.ok(c.chars.every((x) => fit.includes(x.wuxing)), `${c.name} 应全合喜用`);
    }
    assert.ok(r.poolSize > 0 && r.poolSize < CANDIDATE_CHARS.length, '池应经过喜用筛选');
});

test('generate：中和命不按五行强筛（favorable=null），notes 提醒音韵谐音不在口径内', () => {
    const r = generateNames({ surname: '李', birth: { year: 1990, month: 8, day: 16, hour: 14, gender: 'male' } });
    assert.equal(r.favor.favorable, null);
    assert.equal(r.meta.zhonghe, true);
    assert.ok(r.candidates.length > 0);
    assert.ok(r.notes.some((n) => /音韵/.test(n)));
    assert.ok(r.notes.some((n) => /字库/.test(n)));
});

test('generate：性别筛选——女宝不出 m 字打头的双字名池可生成，男宝同理', () => {
    const girl = generateNames({ surname: '李', birth: { year: 2026, month: 6, day: 1, gender: 'female' } });
    const boy = generateNames({ surname: '李', birth: { year: 2026, month: 6, day: 1, gender: 'male' } });
    assert.equal(girl.meta.gender, '女');
    assert.equal(boy.meta.gender, '男');
    // 女宝池只含 f/n 性别标注的字
    const girlPool = new Set(girl.candidates.flatMap((c) => c.chars.map((x) => x.char)));
    for (const ch of girlPool) {
        const entry = CANDIDATE_CHARS.find((x) => x.c === ch);
        assert.ok(entry && ['f', 'n'].includes(entry.g), `女宝候选 ${ch} 性别标注应为 f/n`);
    }
});

test('generate：limit 边界与 fail-fast（缺生辰 / 缺性别 / 缺姓氏）', () => {
    assert.equal(generateNames({ surname: '李', birth: { year: 2026, month: 6, day: 1, gender: 'female' }, limit: 3 }).candidates.length, 3);
    assert.equal(generateNames({ surname: '李', birth: { year: 2026, month: 6, day: 1, gender: 'female' }, limit: 20 }).candidates.length, 20);
    assert.equal(generateNames({ surname: '李', birth: { year: 2026, month: 6, day: 1, gender: 'female' }, limit: 999 }).candidates.length, 20);
    assert.throws(() => generateNames({ surname: '李', birth: { year: 2026, month: 6, day: 1 } }), /gender/);
    assert.throws(() => generateNames({ surname: '李', birth: {} }), /birth/);
    assert.throws(() => generateNames({ surname: '李' }), /birth/);
    assert.throws(() => generateNames({ surname: '', birth: { year: 2026, month: 6, day: 1, gender: 'female' } }), /surname/);
});

test('工具面回归：parameters 必须声明 action（参数白名单严格校验曾漏掉它）', async () => {
    const { defineNameTool } = await import('../lib/tools/name-tool.js');
    const tool = defineNameTool();
    const g = await tool.execute({ action: 'generate', surname: '李', bYear: 2026, bMonth: 6, bDay: 1, bGender: 'male' });
    assert.equal(g.candidates.length, 10);
    const a = await tool.execute({ surname: '李', givenName: '沐宸' });
    assert.equal(a.meta.givenName, '沐宸');
});

// ── P2-6 回归：字库与自家 tables.js 不得互相打脸 ────────────────────────────
// 天干/地支字的五行是**可机械判定**的事实（甲必属木），而旧字库把「甲」按田字格象形记作土，
// 于是同一插件里 xuanji_bazi 说甲=木、xuanji_name 说甲=土。
// 笔数量理类（昌/宁/富/宏）各字典本就不一，不在本用例约束范围内，见 name.js 表头说明。
test('字库五行与 tables.js 对天干/地支字零冲突（单一真相守卫）', () => {
    const conflicts = [];
    for (const g of GAN) {
        const expect = GAN_WUXING[GAN.indexOf(g)];
        if (CHAR_WUXING[g] && CHAR_WUXING[g] !== expect) conflicts.push(`天干「${g}」字库=${CHAR_WUXING[g]} 应为${expect}`);
    }
    for (const z of ZHI) {
        const expect = ZHI_WUXING[ZHI.indexOf(z)];
        if (CHAR_WUXING[z] && CHAR_WUXING[z] !== expect) conflicts.push(`地支「${z}」字库=${CHAR_WUXING[z]} 应为${expect}`);
    }
    assert.deepEqual(conflicts, [], conflicts.join('；'));
    assert.equal(CHAR_WUXING['甲'], '木');
});

test('字库未收录的字如实标注，不静默按 0 分算成「平和」（汇总断语也要一致）', () => {
    const r = assessName({ surname: '鑫', givenName: '龘䶮', birth: { year: 1990, month: 8, day: 16, hour: 14, gender: 'male' } });
    const unknown = r.chars.filter((c) => c.status === '未收录');
    assert.ok(unknown.length >= 2, `应全部标未收录，实际 ${JSON.stringify(r.chars.map((c) => c.status))}`);
    // 断言实质而不是关键词：全未收录 = 「评不了」，绝不能被报成「评过且中和」
    assert.equal(r.verdict.verdict, '未评', `全部字未收录却被判成「${r.verdict.verdict}」：${r.verdict.text}`);
    assert.ok(!/平和|不补不冲/.test(r.verdict.text), `断语仍自称平和：${r.verdict.text}`);
    assert.match(r.verdict.text, /无法判断|未采集到数据/);
});

test('部分未收录：计分只算已收录字，且断语要点明哪些字没参与', () => {
    const r = assessName({ surname: '李', givenName: '沐龘', birth: { year: 1990, month: 8, day: 16, hour: 14, gender: 'male' } });
    const known = r.chars.filter((c) => c.status === '已收录').length;
    const unknown = r.chars.filter((c) => c.status === '未收录').map((c) => c.char);
    assert.ok(known >= 1 && unknown.length >= 1, '用例前提：一字收录一字未收录');
    if (r.verdict.verdict === '平') {
        assert.match(r.verdict.text, /未参与计分/, `「平」档必须点明有字未参与计分：${r.verdict.text}`);
    }
});
