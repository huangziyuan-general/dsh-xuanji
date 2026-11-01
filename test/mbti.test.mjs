// test/mbti.test.mjs — MBTI 引擎：结构 + 确定性 + 独立重算交叉验证（防「测试抄实现」）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMbti, mbtiQuestions, QUESTIONS, DIMENSIONS, PROFILES } from '../lib/engine/mbti.js';

/** 独立重算器：不 import computeMbti 的计分路径，按 QUESTIONS 数据自己推一遍类型。 */
function independentType(answers) {
    const tally = { EI: { E: 0, I: 0 }, SN: { S: 0, N: 0 }, TF: { T: 0, F: 0 }, JP: { J: 0, P: 0 } };
    QUESTIONS.forEach((q, i) => {
        const ans = answers[i];
        if (ans !== 0 && ans !== 1) return;
        const poles = DIMENSIONS[q.dim].poles;
        const pole = ans === 0 ? q.pole : poles.find((p) => p !== q.pole);
        tally[q.dim][pole] += 1;
    });
    let type = '';
    for (const dim of ['EI', 'SN', 'TF', 'JP']) {
        const [p0, p1] = DIMENSIONS[dim].poles;
        type += tally[dim][p1] > tally[dim][p0] ? p1 : p0; // 平票取 p0（首极）
    }
    return { type, tally };
}

// 语义锚点：Q1 的 A 选项（外向）必须计入 E，B 计入 I
test('mbti: Q1 选项语义锚点正确（A=外向=E，B=内向=I）', () => {
    assert.equal(QUESTIONS[0].pole, 'E');
    assert.equal(QUESTIONS[0].a.includes('充了电'), true);
    const r0 = computeMbti({ answers: Array(24).fill(0) });
    const r1 = computeMbti({ answers: Array(24).fill(1) });
    assert.equal(r0.dimensions.EI.pole, 'E');
    assert.equal(r1.dimensions.EI.pole, 'I');
});

test('mbti: 问卷模式返回 24 题', () => {
    const q = mbtiQuestions();
    assert.equal(q.length, 24);
    assert.equal(q[0].options.length, 2);
});

test('mbti: 完整 24 题返回类型 + 档案', () => {
    const r = computeMbti({ answers: Array(24).fill(0) });
    assert.equal(r.meta.complete, true);
    assert.equal(r.type.length, 4);
    assert.ok(PROFILES[r.type]);
    assert.equal(r.profile, PROFILES[r.type]);
});

test('mbti: 独立重算器与引擎计分一致（多组输入）', () => {
    const samples = [
        Array(24).fill(0),
        Array(24).fill(1),
        [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
        [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0],
        // 伪随机但确定
        ...Array.from({ length: 20 }, (_, k) => Array.from({ length: 24 }, (_, i) => (i * 7 + k * 3) % 2)),
    ];
    for (const ans of samples) {
        const engine = computeMbti({ answers: ans });
        const ref = independentType(ans);
        assert.equal(engine.type, ref.type, `答案组 ${ans.join('')} 类型应与独立重算一致`);
    }
});

test('mbti: 确定性（同输入同结果）', () => {
    const ans = [0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0];
    assert.equal(computeMbti({ answers: ans }).type, computeMbti({ answers: ans }).type);
});

test('mbti: 不足 24 题 → 标记不完整、不给类型', () => {
    const r = computeMbti({ answers: [0, 1, 0] });
    assert.equal(r.meta.complete, false);
    assert.equal(r.type, null);
    assert.equal(r.profile, null);
});

test('mbti: 平票维度取首极并标注 ties', () => {
    // EI 各 3 票（用 Q1,2,4=0(E) + Q3,5=0(I) 之外再调一票制造平票很麻烦，直接构造：让 EI 12:12 不可能（6题）
    // 改成制造 SN 平票：SN 6 题，3 个 A(=S 方向见 q.pole) + 3 个 B。Q7,9,11 的 pole=S；Q8,10,12 的 pole=N。
    // 选 Q7,9,11=1(B→N) 且 Q8,10,12=0(A→N) → N 得 6，S 得 0，不平。改用混合：
    const ans = Array(24).fill(0);
    // 让 SN 平票：3 题给 S，3 题给 N
    ans[6] = 0; // Q7 pole S → S
    ans[7] = 0; // Q8 pole N → N
    ans[8] = 0; // Q9 pole S → S
    ans[9] = 0; // Q10 pole N → N
    ans[10] = 0; // Q11 pole S → S
    ans[11] = 0; // Q12 pole N → N
    // 上面全 0 时 Q7(S),Q9(S),Q11(S) 给 S；Q8(N),Q10(N),Q12(N) 给 N → 3:3 平票
    const r = computeMbti({ answers: ans });
    assert.equal(r.meta.ties && r.meta.ties.SN, true);
    assert.equal(r.dimensions.SN.pole, 'S'); // 首极
});
