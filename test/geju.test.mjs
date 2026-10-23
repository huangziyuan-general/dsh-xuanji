// test/geju.test.mjs — 八字格局判定（简化正格八格 + 建禄/阳刃俗格）。
import test from 'node:test';
import assert from 'node:assert/strict';

import lunarPkg from 'lunar-javascript';
import { determineGeju, MONTH_BEN_QI } from '../lib/engine/geju.js';
import { tenGod, GAN, GAN_YINYANG, GAN_LU, GAN_REN, CHANG_SHENG } from '../lib/engine/tables.js';
import { computeBazi } from '../lib/engine/bazi.js';

/** 用例前提自检用：某干对日主的十神。 */
const tenGodOf = (dayGan, g) => tenGod(dayGan, g);

test('MONTH_BEN_QI：十二支本气藏干齐全', () => {
    assert.equal(MONTH_BEN_QI.寅, '甲');
    assert.equal(MONTH_BEN_QI.申, '庚');
    assert.equal(Object.keys(MONTH_BEN_QI).length, 12);
});

test('七杀格透干成立：日主甲 + 月令申（庚本气克甲=七杀）+ 透庚 → 立七杀格', () => {
    const r = determineGeju({ dayMasterGan: '甲', monthZhi: '申', otherGans: ['庚', '甲', '庚'] });
    assert.equal(r.primaryGod, '七杀');
    assert.equal(r.geju, '七杀格（偏官格）');
    assert.equal(r.formed, true);
});

test('七杀格候选：月令申（庚）+ 日主甲 + 无透庚 → 格弱未成（候选）', () => {
    const r = determineGeju({ dayMasterGan: '甲', monthZhi: '申', otherGans: ['甲', '乙'] });
    assert.equal(r.primaryGod, '七杀'); // 申本气庚 克 甲（异性）= 七杀
    assert.equal(r.geju, '七杀格（偏官格）');
    assert.equal(r.formed, false);
    assert.match(r.note, /未透干/);
});

test('偏印格透干成立：日主丙 + 月令寅（甲本气生丙，同性=偏印/枭神）+ 透甲 → 立偏印格', () => {
    const r = determineGeju({ dayMasterGan: '丙', monthZhi: '寅', otherGans: ['甲', '丙', '甲'] });
    assert.equal(r.primaryGod, '偏印');
    assert.equal(r.geju, '偏印格（枭神格）');
    assert.equal(r.formed, true);
});

test('建禄格俗格：月令甲（比肩月令）→ 建禄格，非正格', () => {
    // 日主甲，月令本气须为甲 → 寅月（本气甲）。寅对甲 = 比肩。
    const r = determineGeju({ dayMasterGan: '甲', monthZhi: '寅', otherGans: ['甲', '甲'] });
    assert.equal(r.suGe, '建禄格（比肩月令，正格之外，身旺之征）');
    assert.equal(r.geju, null);
});

test('阳刃格俗格：月令午（丁）+ 日主丙（劫财月令）→ 阳刃格', () => {
    const r = determineGeju({ dayMasterGan: '丙', monthZhi: '午', otherGans: ['丙', '丁'] });
    assert.equal(r.suGe?.startsWith('阳刃格'), true);
});

// ── P2-1 / P2-2 回归 ────────────────────────────────────────────────────────
test('P2-1 比肩「透干」按柱位判，不按字符删：年干与日主同字时不得说「无比肩透干」', () => {
    // 实盘 1974-01-02 10时 = 癸丑 甲子 癸卯 丁巳：日主癸、月支子（本气癸=比肩）、年干也是癸。
    // 旧实现 allGans.filter(g => g !== dayMasterGan) 把**所有**癸都删了，
    // 于是当着用户的面输出「四柱天干无比肩」，而其四柱里明摆着有两个癸。
    const b = computeBazi({ year: 1974, month: 1, day: 2, hour: 10, gender: 'male' });
    assert.equal(b.geju.suGe?.startsWith('建禄格'), true, '癸日子月（比肩月令）应立建禄格');
    assert.equal(b.geju.formed, true, '年干癸即比肩透干，建禄本就月令即格');
    assert.ok(!/无癸|无比肩/.test(b.geju.note), `note 与盘面矛盾：${b.geju.note}`);
    assert.match(b.geju.note, /建禄/);
});

test('P2-1 note 与格局名不再互相打脸（geju=null 时不得输出「不立正格」还配俗格名）', () => {
    // bazi-tool.js:102 渲染成 `格局：${geju ?? suGe}（${note}）`，两者并排给用户看。
    const cases = [
        { dayMasterGan: '甲', monthZhi: '寅', otherGans: ['甲', '甲', '甲'] },
        { dayMasterGan: '丙', monthZhi: '午', otherGans: ['丙', '丙', '丙'] },
        { dayMasterGan: '乙', monthZhi: '寅', otherGans: ['甲', '甲', '甲'] },
    ];
    for (const c of cases) {
        const r = determineGeju(c);
        const name = r.geju ?? r.suGe;
        assert.ok(name, `${c.dayMasterGan}日${c.monthZhi}月应给出格局或俗格`);
        assert.ok(!/不立正格/.test(r.note) || !r.suGe,
            `note 说「不立正格」却又带俗格名「${r.suGe}」：${r.note}`);
    }
});

test('P2-2 阳刃只论阳干：阴干劫财月令不得标「阳刃格」（与 shensha.js 同口径）', () => {
    // shensha.js 明写「羊刃（阳干帝旺位；阴干不取，免门户之争）」，
    // 而旧 geju.js 把一切「劫财月令」都标阳刃格 —— 同一份返回里格局说有刃、神煞说没刃。
    // 阴干 + 月令本气为其劫财的五个组合（每个都先断言前提，避免用例自己静默失效）。
    const yinJieCai = [['乙', '寅'], ['丁', '巳'], ['辛', '申'], ['癸', '亥'], ['己', '辰']];
    for (const [gan, zhi] of yinJieCai) {
        assert.equal(tenGodOf(gan, MONTH_BEN_QI[zhi]), '劫财', `用例前提不成立：${gan}日${zhi}月本气并非劫财`);
        const r = determineGeju({ dayMasterGan: gan, monthZhi: zhi, otherGans: ['壬', '壬', '壬'] });
        assert.ok(!/阳刃/.test(r.suGe ?? ''), `${gan}日${zhi}月（阴干劫财月令）不该立刃格：${r.suGe}`);
        assert.ok(!/阳刃/.test(r.note), `note 里也不得出现阳刃：${r.note}`);
    }
    // 阳干刃位侧必须仍然是阳刃格，别把对的也一起改掉。
    for (const [gan, zhi] of [['甲', '卯'], ['丙', '午'], ['戊', '午'], ['庚', '酉'], ['壬', '子']]) {
        const r = determineGeju({ dayMasterGan: gan, monthZhi: zhi, otherGans: ['甲', '甲', '甲'] });
        assert.ok(r.suGe?.startsWith('阳刃格'), `${gan}日${zhi}月（阳干刃位）应立阳刃格，实际 ${r.suGe}`);
    }
});

// ── 新发现（原审查报告未列出，由下面的跨模块一致性用例抓出）────────────────
// 「月令本气为劫财」与「月支是日主刃位（帝旺）」对戊/己两干并不等价：
// 戊与丙同宫（火旺土旺），戊 禄在巳、帝旺在午，而巳本气是丙、午本气是丁。
// 于是按本气判同时错两处：戊日午月被判成「正印格」（应为阳刃），
// 戊日未月被判成「阳刃格」（未非帝旺，只该算月令劫财、不立刃）。
// 禄与刃一律改由 tables.js 的 GAN_LU / GAN_REN（十二长生的临官 / 帝旺）判，全插件一份。
test('戊己两干的禄刃不能只看月令本气（午为戊刃、未不是；巳为戊禄、午为己禄）', () => {
    const wuWu = determineGeju({ dayMasterGan: '戊', monthZhi: '午', otherGans: ['甲', '甲', '甲'] });
    assert.ok(wuWu.suGe?.startsWith('阳刃格'), `戊日午月（帝旺位）应为阳刃格，实际 geju=${wuWu.geju} suGe=${wuWu.suGe}`);
    const wuWei = determineGeju({ dayMasterGan: '戊', monthZhi: '未', otherGans: ['甲', '甲', '甲'] });
    assert.ok(!/阳刃/.test(wuWei.suGe ?? ''), `戊日未月不是帝旺位，不该立阳刃格：${wuWei.suGe}`);
    const wuSi = determineGeju({ dayMasterGan: '戊', monthZhi: '巳', otherGans: ['甲', '甲', '甲'] });
    assert.ok(wuSi.suGe?.startsWith('建禄格'), `戊日巳月（禄位）应立建禄格，实际 ${wuSi.suGe}`);
    const jiWu = determineGeju({ dayMasterGan: '己', monthZhi: '午', otherGans: ['甲', '甲', '甲'] });
    assert.ok(jiWu.suGe?.startsWith('建禄格'), `己日午月（己禄在午）应立建禄格，实际 ${jiWu.suGe}`);
});

test('GAN_LU / GAN_REN 与十二长生的临官 / 帝旺位互校（单一真相自检）', () => {
    for (const gan of GAN) {
        assert.ok(GAN_LU[gan], `${gan} 缺禄位`);
        if (GAN_YINYANG[GAN.indexOf(gan)] === '阳') {
            assert.equal(CHANG_SHENG[gan][GAN_REN[gan]], '帝旺', `${gan} 的刃位 ${GAN_REN[gan]} 不是帝旺位`);
            assert.equal(CHANG_SHENG[gan][GAN_LU[gan]], '临官', `${gan} 的禄位 ${GAN_LU[gan]} 不是临官位`);
        }
    }
    // 逐字锚：通行干禄 / 羊刃表
    assert.deepEqual(['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'].map((g) => GAN_LU[g]),
        ['寅', '卯', '巳', '午', '巳', '午', '申', '酉', '亥', '子'], '干禄表与通行口径不符');
    assert.equal(GAN_REN.甲, '卯');
    assert.equal(GAN_REN.丙, '午');
    assert.equal(GAN_REN.戊, '午');
    assert.equal(GAN_REN.庚, '酉');
    assert.equal(GAN_REN.壬, '子');
});

test('P2-2 跨模块一致性：格局立阳刃格的盘，神煞必见羊刃（单向谓词，反向本就可能不同）', () => {
    // 注意方向：神煞羊刃是「日干查四支有无帝旺位」，格局阳刃是「月令本气为劫财」。
    // 阳干的帝旺位本气恰为其劫财，故 格局立刃 ⟹ 月支即帝旺 ⟹ 神煞必见刃；
    // 反向不成立（年支见帝旺也会带羊刃，但月令未必是刃），故只锁这一个方向。
    const { Solar } = lunarPkg;
    const bad = [];
    let renGejuCount = 0;
    for (let i = 0; i < 1200; i++) {
        const s = Solar.fromYmd(1960, 1, 1).nextDay(i * 13);
        const b = computeBazi({ year: s.getYear(), month: s.getMonth(), day: s.getDay(), hour: 10, gender: 'male' });
        const gejuSaysRen = /阳刃/.test(b.geju.suGe ?? '') || /阳刃/.test(b.geju.note ?? '');
        const shenshaHasRen = b.shenSha.stars.some((x) => x.name === '羊刃');
        if (gejuSaysRen) renGejuCount++;
        if (gejuSaysRen && !shenshaHasRen) {
            bad.push(`${b.meta.solar} ${Object.values(b.pillars).map((p) => p.ganZhi).join(' ')} 日主${b.dayMaster.gan}${b.dayMaster.yinYang} 格局=${b.geju.suGe} 神煞无羊刃`);
        }
        // 硬约束：阴干永不立阳刃
        if (gejuSaysRen && b.dayMaster.yinYang === '阴') {
            bad.push(`${b.meta.solar} 阴干${b.dayMaster.gan}被立了阳刃：${b.geju.suGe}`);
        }
    }
    assert.ok(renGejuCount > 0, '扫描样本里一个阳刃格都没有，用例失去意义（该修数据而不是断言）');
    assert.deepEqual(bad, [], `两模块对「阳刃」判定矛盾 ${bad.length} 盘：\n${bad.slice(0, 5).join('\n')}`);
});

test('P2-3 月令比劫时按传统另取透干之格（甲日寅月而丙透 → 食神格，不再只挂建禄）', () => {
    // 《子平真诠》建禄章：月令比劫不可为格，别取透干。
    // 寅藏甲丙戊：甲=比肩（建禄背景），丙=食神。丙透于他柱 → 立食神格并注明建禄。
    const r = determineGeju({ dayMasterGan: '甲', monthZhi: '寅', otherGans: ['甲', '甲', '丙'] });
    assert.equal(r.geju, '食神格');
    assert.equal(r.formed, true);
    assert.equal(r.primaryGod, '食神');
    assert.match(r.note, /中气|余气/, `note 应说明取的是月令哪一层藏干：${r.note}`);
    assert.match(r.note, /建禄/, '建禄作为背景保留在 note 里');
    // 不透干时退回建禄，不硬立格
    const back = determineGeju({ dayMasterGan: '甲', monthZhi: '寅', otherGans: ['甲', '甲', '甲'] });
    assert.equal(back.geju, null);
    assert.ok(back.suGe.startsWith('建禄格'));
});

test('computeBazi 输出含 geju 字段（正格或俗格之一）', () => {
    const b = computeBazi({ year: 1990, month: 8, day: 16, hour: 14, minute: 30, gender: 'male' });
    assert.ok(b.geju.geju || b.geju.suGe, '应给出 geju 或 suGe');
    assert.equal(typeof b.geju.formed, 'boolean');
});

test('未知月支 fail-fast', () => {
    assert.throws(() => determineGeju({ dayMasterGan: '甲', monthZhi: 'X', otherGans: [] }), /未知月支/);
});
