// test/dst-cn.test.mjs — 中国夏令时（1986–1991）校正：区间边界 + 跨日进位。
import test from 'node:test';
import assert from 'node:assert/strict';

import { DST_SPANS, inDstSpan, applyDstCorrection } from '../lib/engine/dst-cn.js';

test('区间表：恰好六年，每年起止日期符合「4月中下旬起、9月中旬止」', () => {
    assert.deepEqual(Object.keys(DST_SPANS).sort(), ['1986', '1987', '1988', '1989', '1990', '1991']);
    for (const [year, [s, e]] of Object.entries(DST_SPANS)) {
        assert.ok(s.startsWith(year) && e.startsWith(year), `${year} 区间跨年`);
        assert.ok(e > s);
    }
});

test('边界判定：起始日 02:00 含、结束日 02:00 不含', () => {
    assert.equal(inDstSpan({ year: 1990, month: 4, day: 15, hour: 1, minute: 59 }), false);
    assert.equal(inDstSpan({ year: 1990, month: 4, day: 15, hour: 2, minute: 0 }), true);
    assert.equal(inDstSpan({ year: 1990, month: 9, day: 16, hour: 1, minute: 59 }), true);
    assert.equal(inDstSpan({ year: 1990, month: 9, day: 16, hour: 2, minute: 0 }), false);
    assert.equal(inDstSpan({ year: 1990, month: 7, day: 1, hour: 15, minute: 30 }), true);
    assert.equal(inDstSpan({ year: 1992, month: 7, day: 1, hour: 12 }), false);
    assert.equal(inDstSpan({ year: 1985, month: 7, day: 1, hour: 12 }), false);
});

test('校正：钟面减 1 小时', () => {
    const r = applyDstCorrection({ year: 1990, month: 7, day: 1, hour: 15, minute: 30 });
    assert.equal(r.applied, true);
    assert.equal(r.hour, 14);
    assert.equal(r.minute, 30);
    assert.ok(r.note.includes('1990'));
});

test('校正不改变区间外时刻', () => {
    const r = applyDstCorrection({ year: 1992, month: 7, day: 1, hour: 15, minute: 30 });
    assert.equal(r.applied, false);
    assert.equal(r.hour, 15);
    assert.equal(r.note, null);
});

test('跨日进位：结束日凌晨 00:30 校正后落到前一天 23:30', () => {
    const r = applyDstCorrection({ year: 1990, month: 9, day: 16, hour: 0, minute: 30 });
    assert.equal(r.applied, true);
    assert.equal(r.hour, 23);
    assert.equal(r.day, 15);
});
