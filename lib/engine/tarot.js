// lib/engine/tarot.js — 塔罗确定性引擎：每日一牌 + 1/3/5 牌阵。
// 抽牌为日期/问题哈希确定性映射（同输入同牌同正逆位，可复现）；解读语料为通行 RWS 释义（白话提炼）。
//
// v0.4.0 起从「仅 22 大阿卡纳」补全为「78 全牌」：新增 56 小阿卡纳（权杖/圣杯/宝剑/星币 × 14），
// 并支持 1/3/5 牌阵（原仅 daily/three）。牌阵为确定性抽牌，非随机、非模型编。

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

/**
 * 56 小阿卡纳：四花色 × 14（Ace–10 + 侍从/骑士/王后/国王）。
 * 花色：权杖(火·行动) / 圣杯(水·情感) / 宝剑(风·思维) / 星币(土·实务)。
 * 每张：名、正位关键词、逆位关键词、一句白话。
 */
export const MINOR_ARCANA = [
    // ── 权杖 Wands（火）──
    { num: 'W1', suit: '权杖', rank: 'Ace', name: '权杖Ace', up: '新契机、行动热情', down: '热情空转、半途而废', text: '一团火被点燃，先动起来比想清更重要。' },
    { num: 'W2', suit: '权杖', rank: '2', name: '权杖2', up: '规划、权衡、两手准备', down: '犹豫、分心', text: '多个选项在手上，先把主次排好。' },
    { num: 'W3', suit: '权杖', rank: '3', name: '权杖3', up: '起步、远见、扩张', down: '进度卡顿、原地踏步', text: '蓝图刚铺开，适合向外探路。' },
    { num: 'W4', suit: '权杖', rank: '4', name: '权杖4', up: '稳固、庆祝、小成', down: '守成、怕变', text: '有了据点，别急着冲下一个。' },
    { num: 'W5', suit: '权杖', rank: '5', name: '权杖5', up: '竞争、摩擦、对手', down: '内耗、两败', text: '有对手在逼你变强，看清是谁。' },
    { num: 'W6', suit: '权杖', rank: '6', name: '权杖6', up: '胜利、被看见、领先', down: '昙花一现、盛名之累', text: '阶段性的赢，记得稳住别飘。' },
    { num: 'W7', suit: '权杖', rank: '7', name: '权杖7', up: '防守、坚持立场', down: '寡不敌众、疲于应对', text: '守得住就守，守不住就换赛道。' },
    { num: 'W8', suit: '权杖', rank: '8', name: '权杖8', up: '加速、多线并进', down: '忙乱、失控', text: '事情一下涌来，先抓最急的。' },
    { num: 'W9', suit: '权杖', rank: '9', name: '权杖9', up: '戒备、经验、守住', down: '过度防御、紧绷', text: '打过仗的人最谨慎，但也别吓自己。' },
    { num: 'W10', suit: '权杖', rank: '10', name: '权杖10', up: '重担、责任压身', down: '不堪重负、该卸', text: '扛太多了，分一些出去不是认输。' },
    { num: 'WP', suit: '权杖', rank: '侍从', name: '权杖侍从', up: '火花、初学、跃跃欲试', down: '三分钟热度', text: '一个主意刚冒头，适合去试水。' },
    { num: 'WK', suit: '权杖', rank: '骑士', name: '权杖骑士', up: '冲劲、行动派、外向', down: '鲁莽、虎头蛇尾', text: '说干就干的那类人， momentum 就是优势。' },
    { num: 'WQ', suit: '权杖', rank: '王后', name: '权杖王后', up: '热情、自信、感染人', down: '情绪化、控制欲', text: '由内而外的笃定，能点燃周围。' },
    { num: 'WKg', suit: '权杖', rank: '国王', name: '权杖国王', up: '领导力、敢闯、定调', down: '独断、好大喜功', text: '天然的主人姿态，适合牵头。' },
    // ── 圣杯 Cups（水）──
    { num: 'C1', suit: '圣杯', rank: 'Ace', name: '圣杯Ace', up: '爱的开端、情感涌动', down: '情感封闭、错失', text: '一颗心刚打开，先感受别急着定义。' },
    { num: 'C2', suit: '圣杯', rank: '2', name: '圣杯2', up: '配对、平等关系', down: '失衡、貌合神离', text: '两个人的事，势均力敌才长久。' },
    { num: 'C3', suit: '圣杯', rank: '3', name: '圣杯3', up: '欢聚、庆祝、友谊', down: '浮泛社交、虚热闹', text: '值得小聚一下，但别只看表面热闹。' },
    { num: 'C4', suit: '圣杯', rank: '4', name: '圣杯4', up: '疏离、不满足、观望', down: '错失机会、闷', text: '有点腻了眼下，但新东西在敲门。' },
    { num: 'C5', suit: '圣杯', rank: '5', name: '圣杯5', up: '失落、遗憾、空杯', down: '沉溺悲伤、转不过弯', text: '盯着眼前的空，别忘身后还有满的。' },
    { num: 'C6', suit: '圣杯', rank: '6', name: '圣杯6', up: '怀旧、安全感、旧识', down: '恋旧、走不出来', text: '熟悉的人事让你安心，但别困住。' },
    { num: 'C7', suit: '圣杯', rank: '7', name: '圣杯7', up: '幻想、选择过多', down: '空想、不落地', text: '脑内戏很多，挑一个真的去试。' },
    { num: 'C8', suit: '圣杯', rank: '8', name: '圣杯8', up: '出走、不满足现状', down: '逃避、半途弃', text: '现有的不够了，离开是为找更对的。' },
    { num: 'C9', suit: '圣杯', rank: '9', name: '圣杯9', up: '满足、如愿、独享', down: '自满、孤立', text: '小确幸到手，知足就好。' },
    { num: 'C10', suit: '圣杯', rank: '10', name: '圣杯10', up: '圆满、归属、家庭暖', down: '表面和睦、疏离', text: '关系里的安稳感，是最贵的资产。' },
    { num: 'CP', suit: '圣杯', rank: '侍从', name: '圣杯侍从', up: '温柔、好奇、共情', down: '情绪化、敏感过度', text: '带着心去探索，感受力是天赋。' },
    { num: 'CK', suit: '圣杯', rank: '骑士', name: '圣杯骑士', up: '浪漫、理想化、深情', down: '不切实际、飘', text: '把感情活成诗篇，但要落地。' },
    { num: 'CQ', suit: '圣杯', rank: '王后', name: '圣杯王后', up: '包容、直觉、疗愈', down: '情绪淹没、过度付出', text: '能接住别人的情绪，也别忘了自己。' },
    { num: 'CKg', suit: '圣杯', rank: '国王', name: '圣杯国王', up: '情绪稳定、共情力、支持者', down: '情感操控、压抑', text: '温柔而有边界，是关系里的定海神针。' },
    // ── 宝剑 Swords（风）──
    { num: 'S1', suit: '宝剑', rank: 'Ace', name: '宝剑Ace', up: '清明、洞察、破题', down: '锋利伤己、钻牛角尖', text: '一念通透，先想明白再出手。' },
    { num: 'S2', suit: '宝剑', rank: '2', name: '宝剑2', up: '两难、权衡、暂缓', down: '逃避决定、内耗', text: '两边都放不下，先别逼自己立刻选。' },
    { num: 'S3', suit: '宝剑', rank: '3', name: '宝剑3', up: '心痛、割裂、清醒', down: '沉溺痛苦、反复撕', text: '痛是提醒你哪里错了，别反复撕伤口。' },
    { num: 'S4', suit: '宝剑', rank: '4', name: '宝剑4', up: '休整、喘息、蓄力', down: '停滞、回避', text: '累了就停，休整不是认输。' },
    { num: 'S5', suit: '宝剑', rank: '5', name: '宝剑5', up: '争执、小胜、代价', down: '赢了道理输了关系', text: '争赢了但伤了人，值不值要想清。' },
    { num: 'S6', suit: '宝剑', rank: '6', name: '宝剑6', up: '过渡、离开乱象', down: '勉强前行、放不下', text: '带着伤也要往前，水面会平静。' },
    { num: 'S7', suit: '宝剑', rank: '7', name: '宝剑7', up: '谋略、暗中准备', down: '取巧、不诚实', text: '有点小算盘，但别骗人骗己。' },
    { num: 'S8', suit: '宝剑', rank: '8', name: '宝剑8', up: '自我设限、被困', down: '其实能挣脱', text: '很多束缚是自己绑的，看清就能解。' },
    { num: 'S9', suit: '宝剑', rank: '9', name: '宝剑9', up: '焦虑、夜不能寐', down: '灾难化想象', text: '想最坏的事多半不会发生，先睡一觉。' },
    { num: 'S10', suit: '宝剑', rank: '10', name: '宝剑10', up: '谷底、终结、解脱前夜', down: '长期痛苦、难翻篇', text: '最难的已经过去，天快亮了。' },
    { num: 'SP', suit: '宝剑', rank: '侍从', name: '宝剑侍从', up: '机敏、求知、警觉', down: '多疑、信息焦虑', text: '脑子活、爱打听，适合做研究。' },
    { num: 'SK', suit: '宝剑', rank: '骑士', name: '宝剑骑士', up: '敏锐、直率、行动快', down: '急躁、言语伤人', text: '想到就冲，但嘴上留点分寸。' },
    { num: 'SQ', suit: '宝剑', rank: '王后', name: '宝剑王后', up: '理性、犀利、独立', down: '冷峻、挑剔', text: '头脑清醒的那位，看问题一针见血。' },
    { num: 'SKg', suit: '宝剑', rank: '国王', name: '宝剑国王', up: '公正、思辨、决断', down: '冷酷、好辩', text: '以理服人的裁判者，逻辑即权威。' },
    // ── 星币 Pentacles（土）──
    { num: 'P1', suit: '星币', rank: 'Ace', name: '星币Ace', up: '新机会、务实开端', down: '错失、空想不落地', text: '一个实在的苗头，值得投入。' },
    { num: 'P2', suit: '星币', rank: '2', name: '星币2', up: ' juggling、平衡收支', down: '顾此失彼、不稳', text: '多线运转，重点是别掉球。' },
    { num: 'P3', suit: '星币', rank: '3', name: '星币3', up: '协作、匠艺、打底', down: '配合差、粗制', text: '三两人把事做扎实，基础最重要。' },
    { num: 'P4', suit: '星币', rank: '4', name: '星币4', up: '守住、节俭、稳健', down: '吝啬、不敢投入', text: '握得紧是安全，但也别错失机会。' },
    { num: 'P5', suit: '星币', rank: '5', name: '星币5', up: '匮乏、难关、求助', down: '孤立无援、硬扛', text: '难是暂时的，开口求助不丢人。' },
    { num: 'P6', suit: '星币', rank: '6', name: '星币6', up: '给予、互助、流动', down: '施舍姿态、不对等', text: '有余力帮人，关系就转起来了。' },
    { num: 'P7', suit: '星币', rank: '7', name: '星币7', up: '等待、耕耘、复盘', down: '焦虑回报、急功', text: '种下去了，给点时间长。' },
    { num: 'P8', suit: '星币', rank: '8', name: '星币8', up: '精进、打磨、熟练', down: '重复枯燥、钻钱眼', text: '把一件事做到精，价值自然来。' },
    { num: 'P9', suit: '星币', rank: '9', name: '星币9', up: '丰足、自足、成果', down: '孤独富足、守财', text: '自己撑起了一片天，享受它。' },
    { num: 'P10', suit: '星币', rank: '10', name: '星币10', up: '积累、传承、安稳', down: '为钱所累、空心', text: '把家底与关系都攒住了，是厚福。' },
    { num: 'PP', suit: '星币', rank: '侍从', name: '星币侍从', up: '踏实、好学、萌芽', down: '笨拙、慢热', text: '从最基础的做起，稳扎稳打。' },
    { num: 'PK', suit: '星币', rank: '骑士', name: '星币骑士', up: '可靠、务实、推进', down: '迟钝、固执', text: '一步一个脚印，把事落到实处。' },
    { num: 'PQ', suit: '星币', rank: '王后', name: '星币王后', up: '丰盛、持家、滋养', down: '物欲、控制', text: '把日子过成安稳的丰盛，是种能力。' },
    { num: 'PKg', suit: '星币', rank: '国王', name: '星币国王', up: '稳健、富足、掌管', down: '守财奴、抠门', text: '实在的掌控者，资源在他手里会生利息。' },
];

/** 全牌（78）：用于 deck='full'。 */
export const FULL_DECK = [...MAJOR_ARCANA, ...MINOR_ARCANA];

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

function pickCard(seedStr, salt, deck) {
    const card = deck[hash(seedStr, salt) % deck.length];
    const reversed = hash(seedStr, `${salt}:rev`) % 2 === 1;
    return {
        num: card.num,
        name: card.name,
        suit: card.suit ?? null,
        rank: card.rank ?? null,
        orientation: reversed ? '逆位' : '正位',
        keyword: reversed ? card.down : card.up,
        text: card.text,
    };
}

/**
 * 塔罗主函数。
 * @param {{ mode?:'daily'|'three'|'five', spread?:1|3|5, question?:string, date?:string, deck?:'major'|'full' }} input
 *  · deck='major'（默认，兼容旧行为）：仅 22 大阿卡纳；'full'：78 全牌。
 *  · spread=1：每日一牌；spread=3：三牌阵（过去/现在/未来）；spread=5：五牌阵（过去/现在/未来/建议/结果）。
 *    未给 spread 时由 mode 推断：daily→1，three→3。
 */
export function computeTarot(input) {
    const deck = input?.deck === 'full' ? FULL_DECK : MAJOR_ARCANA;
    let spread = input?.spread === 1 || input?.spread === 3 || input?.spread === 5
        ? input.spread
        : (input?.mode === 'three' || input?.mode === 'five' ? (input.mode === 'five' ? 5 : 3) : 1);
    const date = typeof input?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.date.trim()) ? input.date.trim() : todayYmd();
    const question = typeof input?.question === 'string' && input.question.trim() !== '' ? input.question.trim() : null;
    const seed = `${date}|${question ?? ''}|${deck.length}`;

    // 每日一牌
    if (spread === 1) {
        const card = pickCard(seed, 'daily', deck);
        return {
            meta: { mode: 'daily', deck: input?.deck === 'full' ? 'full' : 'major', date, question, spread: 1 },
            card,
            sources: [deck === FULL_DECK ? '78 全牌：RWS 通行释义（白话提炼）' : '22 大阿卡纳：塔罗通行释义（白话提炼）', '抽牌：日期哈希确定性映射（同日同结果）'],
            disclaimer: '塔罗为娱乐向引导工具，牌面不预示命运；重大决策请以现实依据为准。',
        };
    }

    // 三/五牌阵需要问题
    if (!question) {
        throw new Error('三牌阵/五牌阵需要 question（所问何事）——请先向用户问清问题，不要代填。');
    }
    const positions = spread === 5
        ? ['过去', '现在', '未来', '建议', '结果']
        : ['过去', '现在', '未来'];
    const cards = positions.map((pos, i) => ({ position: pos, ...pickCard(seed, `spread:${spread}:${i}`, deck) }));

    // 去重：哈希撞车时整卡顺延（确定性），牌名/关键词/释义同步换，避免「女祭司配愚者关键词」式矛盾。
    const used = new Set();
    for (const c of cards) {
        let ref = deck.find((d) => d.name === c.name);
        let idx = deck.indexOf(ref);
        while (used.has(ref.name)) {
            idx = (idx + 1) % deck.length;
            ref = deck[idx];
        }
        c.num = ref.num; c.name = ref.name; c.suit = ref.suit ?? null; c.rank = ref.rank ?? null;
        c.keyword = c.orientation === '逆位' ? ref.down : ref.up;
        c.text = ref.text;
        used.add(c.name);
    }

    return {
        meta: { mode: spread === 5 ? 'five' : 'three', deck: input?.deck === 'full' ? 'full' : 'major', date, question, spread },
        cards,
        sources: [deck === FULL_DECK ? '78 全牌：RWS 通行释义（白话提炼）' : '22 大阿卡纳：塔罗通行释义（白话提炼）', '抽牌：问题+日期哈希确定性映射（同日同问题同结果）'],
        disclaimer: '塔罗为娱乐向引导工具，牌面不预示命运；重大决策请以现实依据为准。',
    };
}
