// test/ziwei.test.mjs — 紫微引擎：结构完整性、晚子时翻日、DST/真太阳时口径、确定性。
import test from 'node:test';
import assert from 'node:assert/strict';

import { computeZiwei } from '../lib/engine/ziwei.js';
import { resolveBirthTime } from '../lib/engine/birth-time.js';

const CASE = { year: 1990, month: 8, day: 16, hour: 14, gender: 'male', calendar: 'solar' };

test('结构：12 宫齐全、命宫在列、命主/身主/五行局为非空字符串', () => {
    const z = computeZiwei(CASE);
    assert.equal(z.palaces.length, 12);
    const names = z.palaces.map((p) => p.palace);
    for (const must of ['命宫', '夫妻', '财帛', '官禄', '迁移', '福德']) {
        assert.ok(names.includes(must), `缺宫：${must}`);
    }
    assert.equal(typeof z.soul, 'string' && z.soul.length > 0 ? 'string' : typeof z.soul, 'string');
    assert.ok(z.soul.length > 0);
    assert.ok(z.body.length > 0);
    assert.ok(z.fiveElementsClass.includes('局'));
    const ming = z.palaces.find((p) => p.palace === '命宫');
    assert.match(ming.stemBranch, /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/);
    assert.ok(Number.isInteger(ming.decadal.start) && Number.isInteger(ming.decadal.end));
});

test('星曜结构：主星含亮度，四化只出现 禄/权/科/忌', () => {
    const z = computeZiwei(CASE);
    const all = z.palaces.flatMap((p) => p.majorStars);
    assert.ok(all.length >= 8 && all.length <= 14); // 十四主星（空宫可少）
    for (const s of all) {
        if (s.brightness) assert.ok('庙旺得利平不陷'.includes(s.brightness), `异常亮度：${s.brightness}`);
        if (s.mutagen) assert.ok(['禄', '权', '科', '忌'].includes(s.mutagen), `异常四化：${s.mutagen}`);
    }
    // 生年四化恰好四个（庚年：太阳化禄、武曲化权、太阴化科、天同化忌）
    const muts = all.filter((s) => s.mutagen).map((s) => `${s.name}化${s.mutagen}`).sort();
    assert.deepEqual(muts, ['天同化忌', '太阳化禄', '太阴化科', '武曲化权'].sort());
});

test('时间口径：DST 年份自动减 1 小时并留 notes（探针实证：钟面 14:00 → 真太阳时口径由城市决定）', () => {
    const z = computeZiwei({ ...CASE, city: '成都' });
    assert.ok(z.meta.notes.some((n) => n.includes('夏令时')));
    assert.ok(z.meta.notes.some((n) => n.includes('真太阳时')));
    // 14:00 → 13:00(DST) → 真太阳时 11:52（成都 104.07°E 偏西：4×(104.07-120)=-63.7 + EoT(8/16)≈-3.9 → -68min）→ 午时（11–13 点）
    assert.equal(z.meta.hourZhi, '午');
});

test('晚子时翻日：非夏令时年份 23:00 → 次日排盘并留 notes', () => {
    const z = computeZiwei({ year: 1995, month: 8, day: 16, hour: 23, gender: 'male', calendar: 'solar' });
    assert.equal(z.meta.solar, '1995-08-17');
    assert.equal(z.meta.hourZhi, '子');
    assert.ok(z.meta.notes.some((n) => n.includes('晚子时')));
    // 对照：同一时刻 22:00 不翻日
    const z2 = computeZiwei({ year: 1995, month: 8, day: 16, hour: 22, gender: 'male', calendar: 'solar' });
    assert.equal(z2.meta.solar, '1995-08-16');
});

test('农历输入：农历生日与公历同盘', () => {
    const z1 = computeZiwei(CASE);
    const z2 = computeZiwei({ year: 1990, month: 6, day: 26, hour: 14, gender: 'male', calendar: 'lunar' });
    assert.deepEqual(z1.palaces, z2.palaces);
});

test('fail-fast：缺时辰 / 缺性别', () => {
    assert.throws(() => computeZiwei({ year: 1990, month: 8, day: 16, gender: 'male' }), /hour/);
    assert.throws(() => computeZiwei({ ...CASE, gender: undefined }), /gender/);
});

test('确定性：同输入两次结果完全一致', () => {
    assert.deepEqual(computeZiwei(CASE), computeZiwei(CASE));
});

test('运限层（action=fortune）：大限/流年/小限三环 + 四化 + 大限年龄区间', () => {
    const z = computeZiwei({ ...CASE, action: 'fortune', fortuneDate: '2026-10-22' });
    assert.equal(z.meta.action, 'fortune');
    assert.equal(z.palaces, undefined); // fortune 模式不带本命十二宫全量
    const { decadal, yearly, xiaoXian } = z.fortune;
    // 2026 丙午年：流年干支 丙午、流年四化 天同禄/天机权/文昌科/廉贞忌
    assert.equal(yearly.stemBranch, '丙午');
    assert.deepEqual(yearly.mutagen, { lu: '天同', quan: '天机', ke: '文昌', ji: '廉贞' });
    assert.equal(yearly.year, 2026);
    // 大限年龄区间应覆盖 37 虚岁
    assert.ok(decadal.ageRange[0] <= 37 && 37 <= decadal.ageRange[1], `大限区间 ${decadal.ageRange} 未覆盖 37`);
    assert.equal(xiaoXian.nominalAge, 37);
    for (const ring of [decadal, yearly, xiaoXian]) {
        assert.equal(ring.palaceNames[ring.index], '命宫');
        assert.ok(ring.mingPalace.length > 0);
    }
    assert.ok(Array.isArray(z.natalPalaces) && z.natalPalaces.length === 12);
});

test('resolveBirthTime：时辰未知（requireHour=false）返回 hour=null 且不做时间管线', () => {
    const rt = resolveBirthTime({ year: 1990, month: 8, day: 16, city: '成都' });
    assert.equal(rt.hour, null);
    assert.equal(rt.timeKnown, false);
    assert.deepEqual(rt.notes, []);
    assert.deepEqual(rt.solar, { year: 1990, month: 8, day: 16 });
});
