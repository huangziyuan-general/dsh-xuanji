// lib/engine/mbti.js — MBTI 十六型人格（本地确定性问卷引擎，零外部依赖）。
//
// 设计：
//   · 24 题（每维度 6 题，EI/SN/TF/JP 各 6），每题二选一（0=A 选项，1=B 选项）；
//   · 每个选项归到某一维度的某一极；累计后每维度取多数极，平票默认取首极（E/S/T/J）并标注；
//   · 结果确定性：同一份 answers 永远得到同一类型——不是随机、不是模型编的。
//
// 这是竞品有、本插件原本缺的「十六型人格」速查体系。仅作性格倾向参考，不构成任何诊断。

/** 维度定义与中文名。 */
export const DIMENSIONS = {
    EI: { poles: ['E', 'I'], names: ['外向', '内向'], label: '能量指向' },
    SN: { poles: ['S', 'N'], names: ['实感', '直觉'], label: '信息接收' },
    TF: { poles: ['T', 'F'], names: ['思考', '情感'], label: '决策方式' },
    JP: { poles: ['J', 'P'], names: ['判断', '知觉'], label: '生活节奏' },
};

/**
 * 24 题问卷。每组 { dim, pole } 表示「选该选项（0=A/1=B）计入 pole 极」。
 * A 选项总是维度首极、B 选项总是次极（与 DIMENSIONS.poles 顺序一致）。
 */
export const QUESTIONS = [
    // EI ×6
    { id: 1, dim: 'EI', pole: 'E', text: '聚会散场后，你通常觉得：', a: '充了电、更精神', b: '有点累、想独处静静' },
    { id: 2, dim: 'EI', pole: 'E', text: '遇到新鲜事，你更倾向于先：', a: '说出来、找人聊', b: '在心里琢磨' },
    { id: 3, dim: 'EI', pole: 'I', text: '周末理想状态是：', a: '约朋友出去玩', b: '自己待着做喜欢的事' },
    { id: 4, dim: 'EI', pole: 'E', text: '思考问题时你更习惯：', a: '边说边理清', b: '先想清楚再开口' },
    { id: 5, dim: 'EI', pole: 'I', text: '在人群里待久了你会：', a: '如鱼得水', b: '想找角落透口气' },
    { id: 6, dim: 'EI', pole: 'E', text: '认识新人，你一般：', a: '主动搭话不怯场', b: '等别人先开口' },
    // SN ×6
    { id: 7, dim: 'SN', pole: 'S', text: '接收信息时你更信任：', a: '眼前事实与细节', b: '背后的含义与关联' },
    { id: 8, dim: 'SN', pole: 'N', text: '读一段说明，你更在意：', a: '步骤对不对、能不能照做', b: '它想解决什么根本问题' },
    { id: 9, dim: 'SN', pole: 'S', text: '你更喜欢的表达是：', a: '就事论事、给具体例子', b: '打比方、讲大方向' },
    { id: 10, dim: 'SN', pole: 'N', text: '展望未来你更容易：', a: '落到可执行的计划', b: '先构想各种可能性' },
    { id: 11, dim: 'SN', pole: 'S', text: '你更看重：', a: '经验和可靠的做法', b: '新点子和灵感' },
    { id: 12, dim: 'SN', pole: 'N', text: '听人讲话，你常先抓：', a: '字面意思', b: '弦外之音' },
    // TF ×6
    { id: 13, dim: 'TF', pole: 'T', text: '做决定时你更看重：', a: '逻辑与对错', b: '人情与和谐' },
    { id: 14, dim: 'TF', pole: 'F', text: '朋友向你倒苦水，你先：', a: '帮ta分析怎么解决', b: '先共情、陪着ta' },
    { id: 15, dim: 'TF', pole: 'T', text: '被批评时你第一反应是：', a: '他说得有没有道理', b: '他是不是针对我' },
    { id: 16, dim: 'TF', pole: 'F', text: '你更受不了：', a: '不讲逻辑的人', b: '冷冰冰伤人的人' },
    { id: 17, dim: 'TF', pole: 'T', text: '写评价你偏好：', a: '直说优缺点', b: '先肯定再委婉提' },
    { id: 18, dim: 'TF', pole: 'F', text: '团队里你更像：', a: '把事做对的把关者', b: '照顾气氛的粘合剂' },
    // JP ×6
    { id: 19, dim: 'JP', pole: 'J', text: '出门旅行你更爱：', a: '提前定好行程', b: '到了再说、随机应变' },
    { id: 20, dim: 'JP', pole: 'P', text: '面对 deadline 你通常：', a: '早早做完才安心', b: '最后冲刺也出得来' },
    { id: 21, dim: 'JP', pole: 'J', text: '你的书桌/桌面：', a: '分类收纳有秩序', b: '乱但有我的逻辑' },
    { id: 22, dim: 'JP', pole: 'P', text: '新计划你更想：', a: '先定目标再排期', b: '先开干再调整' },
    { id: 23, dim: 'JP', pole: 'J', text: '你更喜欢的生活是：', a: '有安排、可控', b: '留白、有弹性' },
    { id: 24, dim: 'JP', pole: 'P', text: '收到任务你先：', a: '拆步骤列清单', b: '先摸着石头过河' },
];

/** 16 型简要档案（通行描述口径，白话提炼，仅供参考）。 */
export const PROFILES = {
    INTJ: '战略型架构者：爱想底层逻辑与长远图景，独立、高标准，认准了就自己把路蹚出来。',
    INTP: '逻辑拆解者：对原理有近乎执着的好奇，喜欢在脑内推演各种可能性，讨厌被流程束缚。',
    ENTJ: '天生的组织者：目标感强、敢拍板，擅长把人和资源排成一条能打的线。',
    ENTP: '点子发动机：反应快、爱辩论、擅长从新角度破局，但收尾常需别人兜。',
    INFJ: '理想主义洞察者：敏感于人与关系的底色，内心有很重的意义感，外柔内刚。',
    INFP: '温柔的理想派：看重真诚与价值契合，文艺、共情强，不轻易妥协底线。',
    ENFJ: '鼓舞型领袖：天然会照顾群体情绪、把人凝聚起来，常为别人操心。',
    ENFP: '热情的探索者：点子多、人来疯、对新鲜事物上头快，热爱自由与意义。',
    ISTJ: '可靠的守门人：守规则、重承诺、把细节做扎实，是团队里最稳的那块砖。',
    ISFJ: '沉默的守护者：细心、体贴、记挂别人的需要，默默把事儿办妥。',
    ESTJ: '务实的管理者：讲效率、立规矩、把混乱理清，认流程也认结果。',
    ESFJ: '关系的维系者：热心、周到、在意和谐，是聚会和团队里的黏合剂。',
    ISTP: '冷静的手艺人：动手强、临场稳，遇故障先拆开看看再说。',
    ISFP: '随性的艺术家：审美在线、活在当下，讨厌被绑死在条条框框里。',
    ESTP: '天生的行动派：机敏、敢冲、临场反应一流，边干边学最来劲。',
    ESFP: '现场的气氛组：热情、爱玩、感染力强，把平淡场子点旺的那个人。',
};

/** 维度首极默认名（平票时取）。 */
const DEFAULT_POLE = { EI: 'E', SN: 'S', TF: 'T', JP: 'J' };

/**
 * 计算 MBTI 类型。
 * @param {{ answers:number[] }} input answers 长度须为 24，每项为 0（A 选项）或 1（B 选项）。
 *   缺省/非法项按「不算该维该极」处理（不代填），不足 24 题时结果标注 incomplete。
 * @returns {{ meta:object, type:string, dimensions:object, profile:string, sources:string[], disclaimer:string }}
 */
export function computeMbti(input) {
    const answers = Array.isArray(input?.answers) ? input.answers : [];
    if (answers.length !== QUESTIONS.length) {
        // 不代填、不报错阻断，但明确标注不完整，让上层决定要不要回问用户。
        return {
            meta: { answered: answers.length, expected: QUESTIONS.length, complete: false },
            type: null,
            dimensions: null,
            profile: null,
            sources: ['MBTI 十六型问卷：本地确定性计分（24 题二选一）'],
            disclaimer: '本测试为性格倾向参考，非心理诊断；结果由问卷确定性计分得出，不构成任何专业建议。',
        };
    }
    const tally = { EI: { E: 0, I: 0 }, SN: { S: 0, N: 0 }, TF: { T: 0, F: 0 }, JP: { J: 0, P: 0 } };
    const ties = {};
    QUESTIONS.forEach((q, i) => {
        const ans = answers[i];
        if (ans !== 0 && ans !== 1) return; // 跳过非法/缺答
        // q.pole 是 A 选项(=0)归属的极；选 B(=1)则归属另一极
        const pole = ans === 0 ? q.pole : DIMENSIONS[q.dim].poles.find((p) => p !== q.pole);
        tally[q.dim][pole] += 1;
    });
    const dims = {};
    let type = '';
    for (const dim of ['EI', 'SN', 'TF', 'JP']) {
        const [p0, p1] = DIMENSIONS[dim].poles;
        const c0 = tally[dim][p0];
        const c1 = tally[dim][p1];
        let win = p0;
        if (c1 > c0) win = p1;
        else if (c0 === c1) { win = DEFAULT_POLE[dim]; ties[dim] = true; }
        dims[dim] = { pole: win, names: DIMENSIONS[dim].names, label: DIMENSIONS[dim].label, score: [c0, c1] };
        type += win;
    }
    return {
        meta: { answered: QUESTIONS.length, expected: QUESTIONS.length, complete: true, ...(Object.keys(ties).length ? { ties } : {}) },
        type,
        dimensions: dims,
        profile: PROFILES[type] ?? '（未收录该型档案）',
        sources: ['MBTI 十六型问卷：本地确定性计分（24 题二选一，平票取首极并标注）'],
        disclaimer: '本测试为性格倾向参考，非心理诊断；结果由问卷确定性计分得出，不构成任何专业建议。',
    };
}

/** 返回问卷（供模型/面板向用户逐题发问）。 */
export function mbtiQuestions() {
    return QUESTIONS.map((q) => ({ id: q.id, dim: q.dim, text: q.text, options: [q.a, q.b] }));
}
