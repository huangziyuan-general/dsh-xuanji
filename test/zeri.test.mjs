// test/zeri.test.mjs — 择日引擎：事项校验、评分口径、冲煞排除、确定性。
import test from 'node:test';
import assert from 'node:assert/strict';

import { computeZeri, TASKS } from '../lib/engine/zeri.js';

test('事项表：13 类事项各有宜词与建除大类', () => {
    assert.equal(Object.keys(TASKS).length, 13);
    for (const [k, v] of Object.entries(TASKS)) {
        assert.ok(v.yi.length > 0 && v.category, `${k} 配置不完整`);
    }
});

test('不支持事项 fail-fast，报可行动错误', () => {
    assert.throws(() => computeZeri({ task: '量子跃迁' }), /支持/);
});

test('择日 30 天：逐日有干支/宜忌/建除/评分，推荐日合理存在', () => {
    const z = computeZeri({ task: '开业', days: 30 });
    assert.equal(z.days.length, 30);
    for (const d of z.days) {
        assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(d.date));
        assert.match(d.dayGanZhi, /^[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]$/);
        assert.ok('建除满平定执破危成收开闭'.includes(d.zhiXing));
        assert.ok(['推荐', '可用', '平平', '回避'].includes(d.verdict));
    }
    assert.ok(z.days.some((d) => d.verdict === '推荐'), '30 天内应有推荐日');
    assert.ok(z.best.length > 0 && z.best.length <= 5);
    // best 按分排序
    const byScore = z.days.filter((d) => d.verdict === '推荐').map((d) => d.score);
    assert.ok(Math.min(...byScore) >= 3);
});

test('冲煞排除：属相当事人当天命中冲煞要扣分且理由可见', () => {
    // 找一个确定冲某属相的日子验证（2026-10-22 冲猪）
    const zWith = computeZeri({ task: '出行', startDate: '2026-10-22', days: 1, shengXiao: '猪' });
    const d = zWith.days[0];
    assert.equal(d.chong, '猪');
    assert.ok(d.reasons.some((r) => r.includes('冲猪')), '冲煞理由应可见');
    const zNo = computeZeri({ task: '出行', startDate: '2026-10-22', days: 1 });
    assert.equal(zNo.days[0].score, d.score + 2, '无属相时不应扣冲煞分');
});

test('非法属相 fail-fast', () => {
    assert.throws(() => computeZeri({ task: '开业', shengXiao: '麒麟' }), /生肖/);
});

test('确定性：同输入两次结果一致', () => {
    assert.deepEqual(computeZeri({ task: '嫁娶', startDate: '2026-11-01', days: 10 }), computeZeri({ task: '嫁娶', startDate: '2026-11-01', days: 10 }));
});
