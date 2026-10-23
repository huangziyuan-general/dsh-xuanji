// lib/engine/tarot.js — 塔罗确定性引擎：每日一牌 + 三牌阵（过去/现在/未来）。
// 抽牌为日期/问题哈希确定性映射（同日同牌同正逆位，可复现）；解读语料为大阿卡纳通行关键词。

/** 22 大阿卡纳：编号、名、正位关键词、逆位关键词、一句白话。 */
export const MAJOR_ARCANA = [
    { num: 0, name: '愚者', up: '新开始、纯真、冒险', down: '鲁莽、缺乏计划', text: '一张白纸般的起点，关键在敢不敢迈出第一步。' },
    { num: 1, name: '魔术师', up: '行动力、资源到位', down: '空有想法、心口不一', text: '工具都在手上，成事在专注与执行。' },
    { num: 2, name: '女祭司', up: '直觉、内在智慧', down: '忽视直觉、秘密缠身', text: '答案在你没说出口的地方，先听自己。' },
    { num: 3, name: '女皇', up: '丰饶、滋养、感官', down: '过度溺爱、停滞', text: '照顾好自己与身边人，果实自然会熟。' },
    { num: 4, name: '皇帝', up: '秩序、掌控、边界', down: '僵化、独断', text: '把规则立清楚，局面就稳一半。' },
    { num: 5, name: '教皇', up: '传统、指引、学习', down: '教条、被规则绑住', text: '找对老师或范式，少走弯路。' },
    { num: 6, name: '恋人', up: '契合、选择、价值观', down: '失衡、犹豫不决', text: '面临选择时，跟着价值观走而非冲动。' },
    { num: 7, name: '战车', up: '意志、推进、胜利', down: '失控、硬碰硬', text: '方向锁定后就全速前进，别恋战细节。' },
    { num: 8, name: '力量', up: '温柔的坚持、耐心', down: '自我怀疑、内耗', text: '以柔克刚，稳住情绪就赢了一半。' },
    { num: 9, name: '隐士', up: '内省、独处求索', down: '孤立、逃避', text: '退一步想清楚，比急着表态更有用。' },
    { num: 10, name: '命运之轮', up: '转机、周期、顺势', down: '逆势硬扛、时运不济', text: '风口在变，识别周期比努力更值钱。' },
    { num: 11, name: '正义', up: '权衡、因果、公平', down: '偏袒、逃避责任', text: '账要算平，责任要认领。' },
    { num: 12, name: '倒吊人', up: '换视角、暂缓、沉淀', down: '无谓牺牲、僵住', text: '停下来换个角度看，卡点往往自己松开。' },
    { num: 13, name: '死神', up: '结束与重生、断舍离', down: '拖住旧账、抗拒改变', text: '该收尾的收尾，腾出位置给新阶段。' },
    { num: 14, name: '节制', up: '调和、适度、细水长流', down: '失衡、极端', text: '把两样东西调出配比，比全押一边聪明。' },
    { num: 15, name: '恶魔', up: '欲望、诱惑、绑定', down: '松绑、挣脱', text: '看清是什么在拴着你，断开就是自由。' },
    { num: 16, name: '高塔', up: '突变、旧结构崩塌', down: '惊魂未定、拖延崩塌', text: '塌下来的往往是本该拆的，趁机重建。' },
    { num: 17, name: '星星', up: '希望、疗愈、远景', down: '信心低落、雾里看花', text: '灯还亮着，走慢点没关系。' },
    { num: 18, name: '月亮', up: '潜意识、不安、迷雾', down: '迷雾散去、真相浮现', text: '看不清的事先别下结论，等雾散。' },
    { num: 19, name: '太阳', up: '明朗、成功、活力', down: '过度乐观、黯淡', text: '坦荡行事，眼前就是好时候。' },
    { num: 20, name: '审判', up: '复盘、觉醒、召唤', down: '自责、拒绝复盘', text: '把过去结清账，才能响应新召唤。' },
    { num: 21, name: '世界', up: '完成、圆满、里程碑', down: '差临门一脚、烂尾', text: '收尾的仪式感要有，做完再开新局。' },
];

/** 日期/问题 → 确定性哈希。 */
function hash(str, salt) {
    let x = 2166136261;
    const s = `${str}#${salt}`;
    for (let i = 0; i < s.length; i++) {
        x ^= s.charCodeAt(i);
        x = Math.imul(x, 16777619);
    }
    return (x ^ (x >>> 15)) >>> 0;
}

function todayYmd() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function pickCard(seedStr, salt) {
    const card = MAJOR_ARCANA[hash(seedStr, salt) % MAJOR_ARCANA.length];
    const reversed = hash(seedStr, `${salt}:rev`) % 2 === 1;
    return {
        num: card.num,
        name: card.name,
        orientation: reversed ? '逆位' : '正位',
        keyword: reversed ? card.down : card.up,
        text: card.text,
    };
}

/**
 * 塔罗主函数。
 * @param {{ mode:'daily'|'three', question?:string, date?:string }} input
 *  · daily：每日一牌（缺省今天，同日同牌同正逆位）；
 *  · three：三牌阵（过去/现在/未来），question 参与 seed（同一问题同一天结果可复现，不同天重抽）。
 */
export function computeTarot(input) {
    const mode = input.mode === 'three' ? 'three' : 'daily';
    const date = typeof input.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.date.trim()) ? input.date.trim() : todayYmd();
    const question = typeof input.question === 'string' && input.question.trim() !== '' ? input.question.trim() : null;
    const seed = `${date}|${question ?? ''}`;

    if (mode === 'daily') {
        const card = pickCard(seed, 'daily');
        return {
            meta: { mode, date, question },
            card,
            sources: ['阿卡纳关键词：塔罗通行释义口径（白话提炼）', '抽牌：日期哈希确定性映射（同日同结果）'],
            disclaimer: '塔罗为娱乐向引导工具，牌面不预示命运；重大决策请以现实依据为准。',
        };
    }

    if (!question) {
        throw new Error('三牌阵需要 question（所问何事）——请先向用户问清问题，不要代填。');
    }
    const positions = ['过去', '现在', '未来'];
    const cards = positions.map((pos, i) => ({ position: pos, ...pickCard(seed, `three:${i}`) }));
    // 三牌不重复：哈希撞车时整卡顺延（确定性处理）——牌名、关键词、释义必须同步换成新牌的，
    // 否则会出现「女祭司配愚者关键词」这类自相矛盾。
    const used = new Set();
    for (const c of cards) {
        while (used.has(c.name)) {
            const next = MAJOR_ARCANA[(c.num + used.size) % MAJOR_ARCANA.length];
            c.num = next.num;
            c.name = next.name;
            c.keyword = c.orientation === '逆位' ? next.down : next.up;
            c.text = next.text;
        }
        used.add(c.name);
    }
    return {
        meta: { mode, date, question },
        cards,
        sources: ['阿卡纳关键词：塔罗通行释义口径（白话提炼）', '抽牌：问题+日期哈希确定性映射（同日同问题同结果）'],
        disclaimer: '塔罗为娱乐向引导工具，牌面不预示命运；重大决策请以现实依据为准。',
    };
}
