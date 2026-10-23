// lib/engine/numerology.js — 生命数字确定性引擎（西方数字学通行口径，纯本地）。
// 只用出生日期：生命路径数（Life Path）/ 生日数 / 态度数，11/22/33 为主数（通行保留规则）。
// 数义为白话自撰（西方数字学通行框架），不含任何命定断言。

const MASTER = new Set([11, 22, 33]);

/** 反复逐位求和，最终保留主数 11/22/33（通行规则）。 */
export function reduceNumber(n) {
    while (n > 9 && !MASTER.has(n)) {
        n = String(n).split('').reduce((s, d) => s + Number(d), 0);
    }
    return n;
}

/** 数义白话表（自撰，西方数字学通行框架）。 */
export const NUMBER_MEANING = {
    1: '独立开创：起头快、主见强，课题是「不服管」与孤军作战。',
    2: '协和共感：擅长搭桥与陪伴，课题是过度迁就、怕冲突。',
    3: '表达创造：会说话、有灵感，课题是三分钟热度与情绪化。',
    4: '稳健筑基：可靠、讲秩序，课题是固执与不敢冒险。',
    5: '自由探索：适应力强、爱新鲜，课题是散漫与不肯承诺。',
    6: '承担照料：顾家、有责任感，课题是管得太宽、牺牲感。',
    7: '深究内省：爱琢磨底层逻辑，课题是疏离与想太多。',
    8: '掌局务实：能把事做大做实，课题是把一切换成算账。',
    9: '包容利他：格局大、有同理心，课题是边界感与放下过去。',
    11: '灵性直觉（主数）：高敏感的天线人，课题是情绪过载与自我怀疑。',
    22: '实干家（主数）：能把大蓝图落成实物，课题是压力过大与自我苛求。',
    33: '大爱照料者（主数）：利他的天花板，课题是替所有人活、忘了自己。',
};

/**
 * 生命数字主函数。
 * @param {{ year:number, month:number, day:number }} input
 */
export function computeNumerology(input) {
    const { year, month, day } = input ?? {};
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)
        || month < 1 || month > 12 || day < 1 || day > 31
        || year < 1 || year > 9999) {
        throw new Error('缺少必要输入：year/month/day（出生年月日，公历）——按插件纪律应向用户询问，不要代填。');
    }
    // 日期真实性校验（大小月/闰年），不给 2 月 30 日这类日期出数。
    const MDAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    if (day > MDAYS[month - 1] + (month === 2 && leap ? 1 : 0)) {
        throw new Error(`非法日期：${year}-${month}-${day} 不是真实存在的公历日期——请核对后重试`);
    }
    const digits = String(year) + String(month).padStart(2, '0') + String(day).padStart(2, '0');
    const digitSum = digits.split('').reduce((s, d) => s + Number(d), 0);

    const lifePath = reduceNumber(digitSum);
    const birthday = reduceNumber(day);
    const attitude = reduceNumber(month + day);

    const pack = (name, n, formula) => ({
        name, number: n, master: MASTER.has(n),
        meaning: NUMBER_MEANING[n] ?? `数字 ${n}（通行表外）`,
        formula,
    });

    return {
        meta: { birth: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` },
        numbers: [
            pack('生命路径数', lifePath, `全生日位数字之和（${digitSum}）归约`),
            pack('生日数', birthday, `出生日 ${day} 归约`),
            pack('态度数', attitude, `月 ${month} + 日 ${day} 归约`),
        ],
        notes: [
            '生命数字是西方数字学（Numerology）体系，与八字/紫微完全不同口径，两套结论不可互相印证。',
            '数字义为白话自撰（通行框架），描述的是倾向与课题，不是命运判决。',
        ],
        sources: [
            '数与归约规则：西方数字学通行口径（11/22/33 主数保留）',
            '数义文本：白话自撰',
        ],
        disclaimer: '生命数字属娱乐向的西方民俗体系，不构成性格测评或决策依据，仅供娱乐。',
    };
}
