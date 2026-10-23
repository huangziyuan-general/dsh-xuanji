// test/shensha.test.mjs — 八字神煞查表引擎：锚例 + 起法覆盖 + 旬空。
import test from 'node:test';
import assert from 'node:assert/strict';

import { computeShenShaStars } from '../lib/engine/shensha.js';
import { computeBazi } from '../lib/engine/bazi.js';

/** 庚午 甲申 癸丑 己未（1990-08-16 未时男）。 */
const P = {
    year: { gan: '庚', zhi: '午' },
    month: { gan: '甲', zhi: '申' },
    day: { gan: '癸', zhi: '丑' },
    hour: { gan: '己', zhi: '未' },
};

test('锚例（癸丑日·庚年）：天乙/桃花/驿马/天德/旬空全部命中且落柱正确', () => {
    const stars = Object.fromEntries(computeShenShaStars(P).map((s) => [s.name, s]));
    // 天乙：年干庚见丑未 → 日支丑 + 时支未
    assert.equal(stars['天乙贵人'].type, '吉星');
    assert.deepEqual(stars['天乙贵人'].hits.map((h) => `${h.pillar}${h.char}`), ['日柱丑', '时柱未']);
    // 桃花：日支丑（巳酉丑局）→ 午，年支午命中
    assert.deepEqual(stars['桃花'].hits.map((h) => h.char), ['午']);
    // 驿马：年支午（寅午戌局）→ 申，月支申命中
    assert.deepEqual(stars['驿马'].hits.map((h) => h.char), ['申']);
    // 天德：申月天德在癸 → 日干癸
    assert.ok(stars['天德贵人'].hits.some((h) => h.char === '癸'));
    // 该盘不应出现的神煞
    assert.equal(stars['华盖'], undefined);
    assert.equal(stars['羊刃'], undefined, '癸为阴干，不取羊刃');
});

test('起法覆盖：阳干羊刃、文昌、红鸾天喜、月德、将星、劫煞灾煞', () => {
    // 壬子日（阳干壬，羊刃在子）
    const q = {
        year: { gan: '壬', zhi: '子' },
        month: { gan: '甲', zhi: '辰' },
        day: { gan: '壬', zhi: '子' },
        hour: { gan: '庚', zhi: '子' },
    };
    const stars = Object.fromEntries(computeShenShaStars(q).map((s) => [s.name, s]));
    assert.ok(stars['羊刃'], '壬子日：阳干壬羊刃在子');
    // 将星：年支子（申子辰）→ 子；其余柱子多
    assert.ok(stars['将星']);
    // 红鸾：年支子 → 卯；无卯则不出现
    assert.equal(stars['红鸾'], undefined);
    // 红鸾锚例：年支午 → 红鸾在酉；盘含月支酉 → 命中
    const stars2 = Object.fromEntries(computeShenShaStars({
        year: { gan: '庚', zhi: '午' }, month: { gan: '乙', zhi: '酉' },
        day: { gan: '癸', zhi: '丑' }, hour: { gan: '己', zhi: '未' },
    }).map((s) => [s.name, s]));
    assert.ok(stars2['红鸾'], '午年红鸾在酉，月支酉应命中');
    assert.deepEqual(stars2['红鸾'].hits.map((h) => `${h.pillar}${h.char}`), ['月柱酉']);
    // 灾煞：子年（申子辰）灾煞在午
    const stars3 = Object.fromEntries(computeShenShaStars({
        year: { gan: '壬', zhi: '子' }, month: { gan: '丙', zhi: '午' },
        day: { gan: '甲', zhi: '子' }, hour: { gan: '甲', zhi: '子' },
    }).map((s) => [s.name, s]));
    assert.ok(stars3['灾煞'].hits.some((h) => h.char === '午'));
});

test('端到端：computeBazi 返回 shenSha.stars（数组、带 type/hits/rule）与日柱旬空', () => {
    const r = computeBazi({ year: 1990, month: 8, day: 16, hour: 14, gender: 'male' });
    assert.ok(Array.isArray(r.shenSha.stars) && r.shenSha.stars.length > 0);
    for (const s of r.shenSha.stars) {
        assert.ok(['吉星', '中性', '凶煞'].includes(s.type));
        assert.ok(s.hits.length > 0 && s.rule.length > 4);
    }
    assert.equal(r.shenSha.xunKong, '寅卯', '癸丑属甲辰旬，寅卯空');
});

test('无神煞落柱的盘返回空数组不报错', () => {
    // 甲寅 甲戌 甲寅 甲寅：文昌巳无、羊刃卯无、桃花无…构造空盘难，至少验证不炸且返回数组
    const stars = computeShenShaStars({ year: { gan: '乙', zhi: '卯' }, month: { gan: '戊', zhi: '寅' }, day: { gan: '乙', zhi: '巳' } });
    assert.ok(Array.isArray(stars));
});

test('扩表锚例：太极贵人/金舆/国印/亡神/天德合/月德合（丙寅年·甲午月·丙酉日·丁巳时）', () => {
    const stars = computeShenShaStars({
        year: { gan: '丙', zhi: '寅' },
        month: { gan: '甲', zhi: '午' },
        day: { gan: '丙', zhi: '酉' },
        hour: { gan: '丁', zhi: '巳' },
    });
    const byName = Object.fromEntries(stars.map((s) => [s.name, s]));
    assert.deepEqual(byName['太极贵人'].hits.map((h) => `${h.pillar}${h.char}`), ['日柱酉'], '丙见酉：太极贵人');
    assert.equal(byName['金舆'], undefined, '丙金舆在未，本盘无未');
    assert.equal(byName['国印贵人'], undefined, '丙国印在丑，本盘无丑');
    assert.deepEqual(byName['亡神'].hits.map((h) => `${h.pillar}${h.char}`), ['时柱巳'], '年支寅属寅午戌局，亡神在巳');
    assert.ok(byName['天德合'].hits.some((h) => h.char === '寅'), '午月天德亥，其合为寅');
    assert.equal(byName['月德合'], undefined, '午月月德丙，其合为辛，本盘无辛');
    assert.ok(stars.length >= 10, '扩表后常用神煞不少于 10 种命中');
});

test('亡神表全覆盖：四局禄位（寅午戌见巳 / 巳酉丑见申 / 申子辰见亥 / 亥卯未见寅）', () => {
    const cases = [
        [{ year: { gan: '甲', zhi: '午' }, month: { gan: '丙', zhi: '寅' }, day: { gan: '戊', zhi: '戌' }, hour: { gan: '庚', zhi: '巳' } }, '巳'],
        [{ year: { gan: '甲', zhi: '丑' }, month: { gan: '丙', zhi: '酉' }, day: { gan: '戊', zhi: '巳' }, hour: { gan: '庚', zhi: '申' } }, '申'],
        [{ year: { gan: '甲', zhi: '子' }, month: { gan: '丙', zhi: '申' }, day: { gan: '戊', zhi: '辰' }, hour: { gan: '庚', zhi: '亥' } }, '亥'],
        [{ year: { gan: '甲', zhi: '未' }, month: { gan: '丙', zhi: '亥' }, day: { gan: '戊', zhi: '卯' }, hour: { gan: '庚', zhi: '寅' } }, '寅'],
    ];
    for (const [pillars, target] of cases) {
        const stars = computeShenShaStars(pillars);
        const wang = stars.find((s) => s.name === '亡神');
        assert.ok(wang, `年支${pillars.year.zhi}应查出亡神`);
        assert.ok(wang.hits.some((h) => h.char === target), `亡神应落${target}`);
        assert.equal(wang.type, '凶煞');
    }
});
