// lib/engine/zeri.js — 择日确定性引擎：事项适配黄历宜忌 + 建除十二神 + 冲煞排除。
// 口径：黄历宜忌（传统口径）+ 建除十二神（通行简化口径）；打分是排序引导，不是吉凶断语。

import lunarPkg from 'lunar-javascript';
import { SHENGXIAO } from './tables.js';

const { Solar } = lunarPkg;

/** 支持的事项清单：每类含直接宜词与关联宜词（黄历措辞）。 */
export const TASKS = {
    嫁娶: { yi: ['嫁娶', '纳采', '订盟'], related: ['会亲友', '裁衣'], category: 'marriage' },
    订婚: { yi: ['纳采', '订盟'], related: ['嫁娶', '会亲友'], category: 'marriage' },
    开业: { yi: ['开市', '立券', '交易'], related: ['纳财', '挂匾'], category: 'business' },
    入宅: { yi: ['入宅', '移徙'], related: ['安床', '修造', '扫舍'], category: 'move' },
    搬家: { yi: ['移徙', '入宅'], related: ['安床', '修造'], category: 'move' },
    动土: { yi: ['动土', '修造'], related: ['竖柱', '上梁', '盖屋'], category: 'construction' },
    装修: { yi: ['修造', '修饰垣墙'], related: ['动土', '盖屋'], category: 'construction' },
    安葬: { yi: ['安葬', '破土', '启攒'], related: ['立碑'], category: 'burial' },
    出行: { yi: ['出行'], related: ['远回', '出行'], category: 'travel' },
    祭祀: { yi: ['祭祀'], related: ['祈福', '求嗣'], category: 'worship' },
    签约: { yi: ['立券', '交易'], related: ['纳财', '开市'], category: 'contract' },
    求医: { yi: ['求医', '治病'], related: ['针灸'], category: 'medical' },
    纳财: { yi: ['纳财'], related: ['开市', '立券', '交易'], category: 'contract' },
};

/** 建除十二神（建除满平定执破危成收开闭）按事项大类的通行适配（简化口径）。 */
const ZHIXING_FAVOR = {
    marriage: ['满', '定', '成', '开'],
    business: ['开', '成', '满', '收'],
    move: ['定', '成', '开', '除'],
    construction: ['建', '除', '成', '开'],
    burial: ['除', '定', '闭', '破'],
    travel: ['建', '成', '开', '除'],
    worship: ['除', '满', '平', '定', '执', '成', '开'],
    contract: ['定', '成', '收', '开'],
    medical: ['除', '开'],
};

/**
 * 当日结论。措辞必须与**实际命中的理由**一致——旧版只要分数够就写「无明显冲克」，
 * 于是「冲当事人属相」的日子也能顶着这句话进可用名单（AUDIT P2-5）。
 * @param {number} score
 * @param {{chongSelf:string|null, jiHit:string[], task:string}} ctx
 */
const VERDICT = (score, ctx) => {
    if (ctx.chongSelf) {
        return {
            verdict: '回避',
            text: `当日冲${ctx.chongSelf}，正是当事人的属相：传统择日据此径直排除，不进推荐与可用名单。`,
            excluded: true,
        };
    }
    if (score >= 3) return { verdict: '推荐', text: '宜忌相合、建除相配，此日对所问事项顺遂。', excluded: false };
    if (score >= 1) {
        const text = ctx.jiHit.length > 0
            ? `可考虑，但当日黄历忌${ctx.jiHit.join('、')}：加分来自宜项与建除，减分来自忌项，未抵消干净。`
            : '未见冲克，可用；如有更好的日子，优先取排序靠前的推荐日。';
        return { verdict: '可用', text, excluded: false };
    }
    if (score >= 0) {
        return { verdict: '平平', text: ctx.jiHit.length > 0 ? `当日忌${ctx.jiHit.join('、')}，宜项也不相干，不作首选。` : '宜忌不相干，无助力也无冲克。', excluded: false };
    }
    return { verdict: '回避', text: ctx.jiHit.length > 0 ? `当日忌${ctx.jiHit.join('、')}，对所问事项不宜。` : '减分项多于加分项，此日不宜。', excluded: false };
};

/**
 * 择日计算。
 * @param {{ task:string, startDate?:string, days?:number, shengXiao?:string }} input
 *  shengXiao：当事人属相（子鼠丑牛…亥猪的生肖名，如「马」），用于排除冲煞日；可省略。
 */
export function computeZeri(input) {
    const task = input.task;
    if (!TASKS[task]) {
        throw new Error(`不支持的事项「${task}」。支持：${Object.keys(TASKS).join('、')}`);
    }
    const days = Math.max(1, Math.min(60, Number.isInteger(input.days) ? input.days : 30));
    const shengXiao = typeof input.shengXiao === 'string' && input.shengXiao.trim() !== '' ? input.shengXiao.trim() : null;
    if (shengXiao && !SHENGXIAO.includes(shengXiao)) {
        throw new Error(`shengXiao 须为生肖名：${SHENGXIAO.join('、')}`);
    }

    const start = typeof input.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.startDate.trim())
        ? input.startDate.trim()
        : (() => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; })();

    const spec = TASKS[task];
    const zhixingSet = ZHIXING_FAVOR[spec.category];
    const dayList = [];
    for (let i = 0; i < days; i++) {
        const [sy, sm, sd] = start.split('-').map(Number);
        const d = new Date(Date.UTC(sy, sm - 1, sd + i, 12)); // 月份 0-indexed；正午取样避免夏令时类边界
        const solar = Solar.fromYmd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
        const lunar = solar.getLunar();

        const yi = lunar.getDayYi();
        const ji = lunar.getDayJi();
        const chongShengXiao = lunar.getChongShengXiao();
        const zhiXing = lunar.getZhiXing();

        let score = 0;
        const reasons = [];
        if (spec.yi.some((w) => yi.includes(w))) { score += 2; reasons.push(`黄历宜${spec.yi.filter((w) => yi.includes(w)).join('、')}（+2）`); }
        const relHit = spec.related.filter((w) => yi.includes(w));
        if (relHit.length > 0) { score += 1; reasons.push(`关联宜项${relHit.join('、')}（+1）`); }
        const jiHit = [...spec.yi, ...spec.related].filter((w) => ji.includes(w));
        if (jiHit.length > 0) { score -= 3; reasons.push(`忌${jiHit.join('、')}（-3）`); }
        // 冲当事人属相：README 与工具说明承诺的是「冲煞**排除**」，旧实现只 −2 分，
        // 分数够高照样进可用名单。这里改成硬排除并单独标出来，盘面数据仍然保留可查。
        const chongSelf = shengXiao && chongShengXiao === shengXiao ? shengXiao : null;
        if (chongSelf) { score -= 2; reasons.push(`冲${shengXiao}（当事人属相，径直排除，-2）`); }
        if (zhixingSet.includes(zhiXing)) { score += 1; reasons.push(`建除${zhiXing}神利${task}（+1）`); }
        if (zhiXing === '破' && spec.category !== 'burial') { score -= 1; reasons.push('破日（-1）'); }
        if (zhiXing === '危' && spec.category !== 'travel' && spec.category !== 'worship') { score -= 1; reasons.push('危日（-1）'); }

        const { verdict, text, excluded } = VERDICT(score, { chongSelf, jiHit, task });
        dayList.push({
            date: solar.toYmd(),
            lunar: lunar.toString(),
            dayGanZhi: lunar.getDayInGanZhi(),
            yi: yi.slice(0, 8),
            ji: ji.slice(0, 8),
            chong: chongShengXiao,
            zhiXing,
            score,
            reasons,
            verdict,
            verdictText: text,
            ...(excluded ? { excluded: true } : {}),
        });
    }

    const ranked = [...dayList].sort((a, b) => b.score - a.score || (a.date < b.date ? -1 : 1));
    return {
        meta: {
            task,
            startDate: start,
            days,
            shengXiao,
            ruleNote: shengXiao
                ? `宜忌与建除为传统通行口径（简化）；已给了当事人属相（${shengXiao}），凡当日冲该属相一律径直排除，不进推荐与可用名单。评分仅用于排序引导，不构成吉凶断语。`
                : '宜忌与建除为传统通行口径（简化）；未给当事人属相，故未做冲属相排除。评分仅用于排序引导，不构成吉凶断语。',
        },
        best: ranked.filter((d) => d.verdict === '推荐' && !d.excluded).slice(0, 5).map((d) => d.date),
        usable: ranked.filter((d) => d.verdict === '可用' && !d.excluded).slice(0, 5).map((d) => d.date),
        // 回避名单要列出**全部**理由：旧版只留「忌/冲」开头的项，纯破日·危日就渲染成空括号。
        avoid: dayList.filter((d) => d.verdict === '回避')
            .map((d) => `${d.date}（${d.reasons.join('；') || '综合减分'}）`),
        days: dayList,
        excludedCount: dayList.filter((d) => d.excluded).length,
        disclaimer: '择日为传统黄历口径的本地确定性计算，属民俗参考，仅供娱乐。',
    };
}
