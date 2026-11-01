// lib/engine/liuyao.js — 六爻纳甲（京房）确定性引擎。
//
// 摇卦成卦 → 八宫归属 / 世应 / 纳甲干支 / 六亲 / 六神 / 旺相休囚死 / 旬空 / 月破日破 / 动爻变卦。
// 卦象、干支、六亲、六神、旺衰全部本地算出；模型只解读，不得改卦、改支、改爻。
//
// ── 三条口径纪律（写死在代码里，改前先读）──
// ① 摇卦必须由人完成：引擎不提供「代摇」。随机数只在浏览器面板里由用户点击产生
//    （与传统掷币同义）；成卦之后的一切仍是确定性计算。
// ② 爻序自下而上（初爻在最下）。六爻记录顺序与传统手抄一致，反了整盘皆反。
// ③ 六亲一律以**本卦所属八宫五行**为「我」——变卦、变爻都不改这个「我」，
//    否则同一个爻在本卦叫妻财、到变卦变成官鬼，解读会自相矛盾。

import lunarPkg from 'lunar-javascript';
import { hexagramByLines } from './hexagrams.js';
import { ZHI, ZHI_WUXING, SHENG, KE, xunKongOf } from './tables.js';
import { resolveDateStr } from './calendar.js';

const { Solar } = lunarPkg;

/** 京房八宫：宫名 → 五行 + 本宫/一世…五世/游魂/归魂 的通行本卦序号。 */
export const EIGHT_PALACES = [
    { palace: '乾', wuxing: '金', seq: [1, 44, 33, 12, 20, 23, 35, 14] },
    { palace: '兑', wuxing: '金', seq: [58, 47, 45, 31, 39, 15, 62, 54] },
    { palace: '离', wuxing: '火', seq: [30, 56, 50, 64, 4, 59, 6, 13] },
    { palace: '震', wuxing: '木', seq: [51, 16, 40, 32, 46, 48, 28, 17] },
    { palace: '巽', wuxing: '木', seq: [57, 9, 37, 42, 25, 21, 27, 18] },
    { palace: '坎', wuxing: '水', seq: [29, 60, 3, 63, 49, 55, 36, 7] },
    { palace: '艮', wuxing: '土', seq: [52, 22, 26, 41, 38, 10, 61, 53] },
    { palace: '坤', wuxing: '土', seq: [2, 24, 19, 11, 34, 43, 5, 8] },
];

/** 世爻位（1–6，自下而上）按「本宫/一世…五世/游魂/归魂」排列：归魂世三、游魂世四。 */
export const SHI_POSITION = [6, 1, 2, 3, 4, 5, 4, 3];
export const GEN_TEXTS = ['本宫', '一世', '二世', '三世', '四世', '五世', '游魂', '归魂'];

/**
 * 卦序号（1–64）→ { palace, gen, genText, shi, palaceWuxing }。
 * 建表时直接断言 64 卦不重不漏——八宫表是六爻的骨架，漏一个卦就会落回「未知」而静默出错。
 */
export const PALACE_INDEX = (() => {
    const map = new Map();
    for (const { palace, wuxing, seq } of EIGHT_PALACES) {
        seq.forEach((kingWen, gen) => {
            if (map.has(kingWen)) {
                throw new Error(`六爻八宫表重复：卦序 ${kingWen} 同时属于 ${map.get(kingWen).palace} 与 ${palace}`);
            }
            map.set(kingWen, { palace, gen, genText: GEN_TEXTS[gen], shi: SHI_POSITION[gen], palaceWuxing: wuxing });
        });
    }
    if (map.size !== 64) throw new Error(`六爻八宫表不完整：${map.size}/64`);
    return map;
})();

/**
 * 纳甲：每个经卦的（内卦天干, 外卦天干）与逐爻地支。
 * 阳卦（乾震坎艮）地支顺行、阴卦（坤巽离兑）逆行；乾纳甲壬、坤纳乙癸，内卦用前干、外卦用后干。
 * 例：天风姤 = 上乾下巽 → 初辛丑、二辛亥、三辛酉、四壬午、五壬申、上壬戌。
 */
export const NAJIA = {
    乾: { gan: ['甲', '壬'], zhi: [['子', '寅', '辰'], ['午', '申', '戌']] },
    震: { gan: ['庚', '庚'], zhi: [['子', '寅', '辰'], ['午', '申', '戌']] },
    坎: { gan: ['戊', '戊'], zhi: [['寅', '辰', '午'], ['申', '戌', '子']] },
    艮: { gan: ['丙', '丙'], zhi: [['辰', '午', '申'], ['戌', '子', '寅']] },
    坤: { gan: ['乙', '癸'], zhi: [['未', '巳', '卯'], ['丑', '亥', '酉']] },
    巽: { gan: ['辛', '辛'], zhi: [['丑', '亥', '酉'], ['未', '巳', '卯']] },
    离: { gan: ['己', '己'], zhi: [['卯', '丑', '亥'], ['酉', '未', '巳']] },
    兑: { gan: ['丁', '丁'], zhi: [['巳', '卯', '丑'], ['亥', '酉', '未']] },
};

/** 六神固定序（自初爻向上循环）。 */
export const LIUSHEN = ['青龙', '朱雀', '勾陈', '腾蛇', '白虎', '玄武'];

/** 起卦日天干 → 初爻起始六神序号（甲乙起青龙、丙丁起朱雀、戊起勾陈、己起腾蛇、庚辛起白虎、壬癸起玄武）。 */
export const LIUSHEN_START = { 甲: 0, 乙: 0, 丙: 1, 丁: 1, 戊: 2, 己: 3, 庚: 4, 辛: 4, 壬: 5, 癸: 5 };

/** 六亲主事（传统通行口径，一句话白话，供模型引用，不代为断吉凶）。 */
export const LIUQIN_USAGE = {
    父母: '长辈、文书、合同、房子、学历、辛劳',
    兄弟: '同辈、朋友、竞争者、破财耗散',
    子孙: '晚辈、产出、福气、医药、解忧制官鬼',
    妻财: '钱财、收益、物资、妻子（男测）',
    官鬼: '官职、工作、上司、管束、疾病、忧患',
};

/** 六冲（地支两两相冲）。 */
export const CHONG_PAIRS = [['子', '午'], ['丑', '未'], ['寅', '申'], ['卯', '酉'], ['辰', '戌'], ['巳', '亥']];
const chongOf = (zhi) => CHONG_PAIRS.find(([a, b]) => a === zhi || b === zhi)?.find((x) => x !== zhi) ?? null;

/** 爻辞名：阳爻称九、阴爻称六（初爻/上爻在前）。 */
const YAO_POS = ['初', '二', '三', '四', '五', '上'];
function yaoMing(idx, yang) {
    return `${YAO_POS[idx - 1]}${yang ? '九' : '六'}`;
}

/** 爻名（初爻…上爻）。 */
const YAO_NAME = ['初爻', '二爻', '三爻', '四爻', '五爻', '上爻'];

/**
 * 六亲：以八宫五行（我）对爻支五行。
 * 生我者父母、同我者兄弟、我生者子孙、克我者官鬼、我克者妻财。
 */
export function liuqinOf(woWuxing, yaoWuxing) {
    if (woWuxing === yaoWuxing) return '兄弟';
    if (SHENG[yaoWuxing] === woWuxing) return '父母'; // 爻生我
    if (SHENG[woWuxing] === yaoWuxing) return '子孙'; // 我生爻
    if (KE[yaoWuxing] === woWuxing) return '官鬼'; // 爻克我
    if (KE[woWuxing] === yaoWuxing) return '妻财'; // 我克爻
    return null;
}

/**
 * 旺相休囚死：以月建五行为当令者（我），看爻五行与之的关系。
 * 同我者旺、我生者相、生我者休、克我者囚、我克者死。
 */
export function wangShuaiOf(yueWuxing, yaoWuxing) {
    if (yaoWuxing === yueWuxing) return '旺';
    if (SHENG[yueWuxing] === yaoWuxing) return '相';
    if (SHENG[yaoWuxing] === yueWuxing) return '休';
    if (KE[yaoWuxing] === yueWuxing) return '囚';
    if (KE[yueWuxing] === yaoWuxing) return '死';
    return null;
}

/** 旺/相为得令，用于判暗动与日破。 */
const isWangXiang = (w) => w === '旺' || w === '相';

/** 用神分类：问事关键词 → 六亲。多个类别命中则并列，绝不替用户猜事。 */
export const YONGSHEN_CATEGORY = [
    { liuqin: '妻财', keys: ['财', '钱', '收益', '利润', '买卖', '交易', '生意', '工资', '薪水', '投资', '价格', '成本'] },
    { liuqin: '官鬼', keys: ['官', '工作', '职位', '升迁', '官司', '诉讼', '疾病', '病', '灾', '邪', '盗', '小人', '考公'] },
    { liuqin: '父母', keys: ['文书', '合同', '考试', '学历', '文凭', '长辈', '父母', '房子', '房屋', '证件', '印章', '签约'] },
    { liuqin: '子孙', keys: ['子女', '孩子', '医药', '病愈', '福', '宠物', '快乐', '演出', '创作'] },
    { liuqin: '兄弟', keys: ['兄弟', '朋友', '同辈', '合伙', '竞争', '分财', '同事', '闺蜜'] },
];

/**
 * 定位用神（六爻解读的入手点）。
 * 纪律：所占之事未知时不猜——返回 found=false 并要求先问。用神只看本卦六亲（八宫五行之「我」），
 * 变卦/变爻不改「我」，故用神也只在本卦六爻里找。
 * @returns {{ found:boolean, question?:string, categories?:string[], targets?:string[],
 *             lines?:object[], note?:string, yingqi?:string[], reason?:string }}
 */
export function resolveYongShen(question, lines, { shi, ying } = {}) {
    if (!question) {
        return { found: false, reason: '所占之事未知，须先问用户「占问何事」才能定用神（不猜）' };
    }
    const q = String(question);
    const hits = YONGSHEN_CATEGORY.filter((c) => c.keys.some((k) => q.includes(k)));
    if (hits.length === 0) {
        return { found: false, reason: '未能从问句识别用神类别，请用户明确所占之事性质（求财/问官/问文书/问子孙/问兄弟等）' };
    }
    const targets = [...new Set(hits.map((h) => h.liuqin))];
    const matched = lines.filter((l) => targets.includes(l.liuqin)).map((l) => ({
        idx: l.idx, name: l.name, ganZhi: l.ganZhi, liuqin: l.liuqin,
        wangShuai: l.wangShuai, deLing: l.deLing, xunKong: l.xunKong,
        chong: l.chong, moving: l.moving, isShi: l.isShi, isYing: l.isYing,
    }));
    const yingqi = yingqiHeuristics(matched, { shi, ying });
    return {
        found: true,
        question: q,
        categories: hits.map((h) => h.liuqin),
        targets,
        lines: matched,
        note: '用神是解读入手点：先看用神旺衰、旬空、月破、动静，再结合世应判断事之「我」与「彼」。用神与世爻同看——世为问事者自身，应多为所问对象。',
        yingqi,
    };
}

/**
 * 应期启发式（非定论，仅供引导）：依用神旺衰/旬空/月破/动静给出粗略应期方向。
 * 每条都标「启发式」，明言不可据此断死月日。
 */
function yingqiHeuristics(yongLines) {
    const hints = [];
    for (const l of yongLines) {
        if (l.xunKong) hints.push(`用神（${l.name} ${l.ganZhi}）旬空：应期常在出空、填实或冲空之月日`);
        if (l.chong === '月破') hints.push(`用神（${l.name}）月破：应期在实破、逢合或填实之月日，破散之期不可用`);
        else if (l.chong === '日破') hints.push(`用神（${l.name}）日破：若旺相则暗动近应，若衰则破散难成`);
        if (l.moving) hints.push(`用神（${l.name}）发动：多逢值日或逢合日应（动而克世尤为速）`);
        if (l.deLing && !l.moving) hints.push(`用神（${l.name}）得令静旺：应期近，逢生扶或逢冲之月日可见`);
        if (!l.deLing && !l.moving && !l.xunKong) hints.push(`用神（${l.name}）失令静爻：应期迟，须待旺相或逢生扶之月日`);
    }
    if (hints.length === 0) hints.push('用神状态平和，应期须依世应动变综合判断，难以单爻定死月日');
    return [...new Set(hints)].map((h) => `启发式：${h}`);
}


/**
 * 逐爻纳甲：下卦管初/二/三，上卦管四/五/上。
 * @returns {string[][]} 六位 [干, 支]
 */
function najiaLines(lower, upper) {
    const lo = NAJIA[lower];
    const up = NAJIA[upper];
    if (!lo || !up) throw new Error(`纳甲表缺卦：${lower}/${upper}`);
    return [
        [lo.gan[0], lo.zhi[0][0]],
        [lo.gan[0], lo.zhi[0][1]],
        [lo.gan[0], lo.zhi[0][2]],
        [up.gan[1], up.zhi[1][0]],
        [up.gan[1], up.zhi[1][1]],
        [up.gan[1], up.zhi[1][2]],
    ];
}

/** 爻象：6=老阴（变）、7=少阳、8=少阴、9=老阳（变）。 */
const YAO_NUM = {
    6: { yang: false, moving: true, label: '老阴', mark: '×', fu: '⚋' },
    7: { yang: true, moving: false, label: '少阳', mark: '—', fu: '⚊' },
    8: { yang: false, moving: false, label: '少阴', mark: '--', fu: '⚋' },
    9: { yang: true, moving: true, label: '老阳', mark: '○', fu: '⚊' },
};

/**
 * 解析摇卦结果。两种给法：
 *  · nums：六个数（6/7/8/9），自下而上；数组或「6,7,8,9,7,8」串都收；
 *  · coins：六次掷币，每次三枚，「背」为阳面（朱熹《周易本义》筮仪：三背老阳、三字老阴、
 *    两背一字少阳、一背两字少阴）。写作「背背背 背背字 …」或数组。
 * @returns {{ nums:number[], source:string }}
 */
export function parseTosses(input) {
    const mode = input.mode === 'coins' ? 'coins' : 'numbers';
    if (mode === 'numbers') {
        const raw = input.nums ?? input.tosses;
        const arr = Array.isArray(raw)
            ? raw
            : String(raw ?? '').split(/[^\d]+/).filter((s) => s !== '').map(Number);
        if (arr.length !== 6) {
            throw new Error(`摇卦要正好六个数（6/7/8/9，自下而上：初爻→上爻），收到 ${arr.length} 个——少一个爻不成卦，不要替用户补。`);
        }
        const nums = arr.map((n, i) => {
            const v = Number(n);
            if (!YAO_NUM[v]) {
                throw new Error(`第 ${i + 1} 爻的爻象必须是 6（老阴）/7（少阳）/8（少阴）/9（老阳），收到「${n}」`);
            }
            return v;
        });
        return { nums, source: `六爻数 ${nums.join(' ')}` };
    }

    // ── 掷币记录：先压平成 18 个「背/字」再按三次一组切 ──
    // 数组、空格串、逗号串都收；分隔符一律丢弃，只数字符，避免「背背背」被切成单字。
    const flat = (Array.isArray(input.coins) ? input.coins.join('') : String(input.coins ?? ''))
        .replace(/[^背字bzBZ01]/g, '');
    if (flat.length !== 18) {
        throw new Error(`掷币要正好六次、每次三枚（共 18 个「背/字」，如「背背背 背背字 …」），收到 ${flat.length} 个——少一次摇不成卦。`);
    }
    const tosses = [];
    const nums = [];
    for (let i = 0; i < 6; i += 1) {
        const g = flat.slice(i * 3, i * 3 + 3);
        tosses.push(g);
        // 背=阳：3背老阳9、2背少阳7、1背少阴8、0背老阴6
        nums.push([6, 8, 7, 9][[...g].filter((c) => '背bB1'.includes(c)).length]);
    }
    return { nums, source: `掷币 ${tosses.map((g) => `[${g}]`).join(' ')} → ${nums.join(' ')}` };
}

/**
 * 六爻纳甲起卦。
 * @param {{ mode?:'numbers'|'coins', nums?:number[]|string, coins?:string[]|string,
 *           question?:string, date?:string, calendar?:'solar'|'lunar', isLeapMonth?:boolean }} input
 */
export function computeLiuyao(input) {
    const { nums, source } = parseTosses(input);

    // ── 月建与日辰（六爻的「天时」全靠这两个）──
    // 月建按节气月（不是农历月）：lunar 的 getMonthZhi 已是节气口径，实测 2026-10-23 = 戌月。
    const dateStr = input.date
        ? resolveDateStr(input.date, input.calendar ?? 'solar', input.isLeapMonth === true).date
        : null;
    const solar = dateStr
        ? Solar.fromYmd(...dateStr.split('-').map(Number))
        : Solar.fromDate(new Date());
    const lunar = solar.getLunar();
    const yueGan = lunar.getMonthGan();
    const yueZhi = lunar.getMonthZhi();
    const riGan = lunar.getDayGan();
    const riZhi = lunar.getDayZhi();
    const yueGanZhi = yueGan + yueZhi;
    const riGanZhi = riGan + riZhi;
    const yueWuxing = ZHI_WUXING[ZHI.indexOf(yueZhi)];
    const riWuxing = ZHI_WUXING[ZHI.indexOf(riZhi)];
    const riXunKong = [...xunKongOf(riGanZhi)];
    const yueXunKong = [...xunKongOf(yueGanZhi)];

    // ── 本卦 ──
    const benLines = nums.map((n) => (YAO_NUM[n].yang ? 1 : 0));
    const ben = hexagramByLines(benLines);
    if (!ben) throw new Error('本卦反查失败：六爻组合不成卦');
    const palaceInfo = PALACE_INDEX.get(ben.kingWen);
    if (!palaceInfo) throw new Error(`卦序 ${ben.kingWen}（${ben.name}）不在八宫表里`);
    const woWuxing = palaceInfo.palaceWuxing;
    const shi = palaceInfo.shi;
    const ying = shi <= 3 ? shi + 3 : shi - 3;

    // ── 变卦（有动爻才有）──
    const movingIdxs = nums.map((n, i) => (YAO_NUM[n].moving ? i : -1)).filter((i) => i >= 0);
    const bianLines = benLines.map((b, i) => (movingIdxs.includes(i) ? (b === 1 ? 0 : 1) : b));
    const bianHex = movingIdxs.length > 0 ? hexagramByLines(bianLines) : null;
    const bianNajia = bianHex ? najiaLines(bianHex.lower, bianHex.upper) : null;

    // ── 纳甲 / 六亲 / 六神 ──
    const benNajia = najiaLines(ben.lower, ben.upper);
    const lsStart = LIUSHEN_START[riGan] ?? 0;

    const lines = nums.map((n, i) => {
        const y = YAO_NUM[n];
        const [gan, zhi] = benNajia[i];
        const wuxing = ZHI_WUXING[ZHI.indexOf(zhi)];
        const ws = wangShuaiOf(yueWuxing, wuxing);
        const liushen = LIUSHEN[(lsStart + i) % 6];
        let chong = null;
        if (chongOf(zhi) === yueZhi) chong = '月破';
        else if (chongOf(zhi) === riZhi) chong = isWangXiang(ws) ? '暗动' : '日破';
        let dayRel = '同气';
        if (SHENG[riWuxing] === wuxing) dayRel = '日生';
        else if (KE[riWuxing] === wuxing) dayRel = '日克';
        else if (SHENG[wuxing] === riWuxing) dayRel = '生日';
        else if (KE[wuxing] === riWuxing) dayRel = '克日';

        let bian = null;
        if (y.moving && bianNajia) {
            const [bg, bz] = bianNajia[i];
            const bw = ZHI_WUXING[ZHI.indexOf(bz)];
            let rel = '化比';
            if (SHENG[bw] === wuxing) rel = '化生（回头生）';
            else if (KE[bw] === wuxing) rel = '化克（回头克）';
            else if (SHENG[wuxing] === bw) rel = '化泄';
            else if (KE[wuxing] === bw) rel = '化耗';
            bian = {
                ganZhi: bg + bz, zhi: bz, wuxing: bw,
                liuqin: liuqinOf(woWuxing, bw), rel,
            };
        }

        return {
            idx: i + 1,
            name: YAO_NAME[i],
            yaoMing: yaoMing(i + 1, y.yang),
            num: n,
            yinYang: y.yang ? '阳' : '阴',
            moving: y.moving,
            label: y.label,
            mark: y.mark,
            fu: y.fu,
            ganZhi: gan + zhi,
            gan, zhi, wuxing,
            liuqin: liuqinOf(woWuxing, wuxing),
            liushen,
            isShi: i + 1 === shi,
            isYing: i + 1 === ying,
            wangShuai: ws,
            deLing: isWangXiang(ws),
            xunKong: riXunKong.includes(zhi),
            yueXunKong: yueXunKong.includes(zhi),
            chong,
            dayRel,
            bian,
        };
    });

    const shiLine = lines[shi - 1];
    const yingLine = lines[ying - 1];
    const usedLiuqin = [...new Set(lines.map((l) => l.liuqin).filter(Boolean))];

    return {
        meta: {
            question: input.question ?? null,
            mode: input.mode === 'coins' ? '掷币' : '爻象数',
            tossSource: source,
            solarText: solar.toYmd(),
            lunarText: lunar.toString(),
            calendar: input.calendar === 'lunar' ? '农历' : '公历',
            jieQi: lunar.getJieQi() ?? null,
            // 月建是六爻旺衰的唯一标尺：以节气为界，不是农历初一
            yueJian: { ganZhi: yueGanZhi, zhi: yueZhi, wuxing: yueWuxing, xunKong: yueXunKong.join('') },
            riChen: { ganZhi: riGanZhi, gan: riGan, zhi: riZhi, wuxing: riWuxing, xunKong: riXunKong.join('') },
            notes: [
                '月建按节气月（非农历月），日辰取起卦日干支——旺衰、旬空、六神全部由这两项决定',
                '六亲以本卦所属八宫五行为「我」，变卦与变爻不换「我」',
            ],
        },
        ben: {
            name: ben.name,
            symbol: ben.symbol,
            kingWen: ben.kingWen,
            upper: ben.upper,
            lower: ben.lower,
            gist: ben.gist,
            palace: `${palaceInfo.palace}宫`,
            palaceWuxing: woWuxing,
            gen: palaceInfo.genText,
        },
        bian: bianHex ? {
            name: bianHex.name,
            symbol: bianHex.symbol,
            kingWen: bianHex.kingWen,
            upper: bianHex.upper,
            lower: bianHex.lower,
            gist: bianHex.gist,
        } : null,
        shiYing: {
            shi, ying,
            shiName: YAO_NAME[shi - 1],
            yingName: YAO_NAME[ying - 1],
            shiGanZhi: shiLine.ganZhi,
            yingGanZhi: yingLine.ganZhi,
            shiLiuqin: shiLine.liuqin,
            yingLiuqin: yingLine.liuqin,
        },
        lines,
        moving: movingIdxs.map((i) => ({
            idx: i + 1,
            name: YAO_NAME[i],
            ganZhi: lines[i].ganZhi,
            liuqin: lines[i].liuqin,
            to: lines[i].bian?.ganZhi ?? null,
            toLiuqin: lines[i].bian?.liuqin ?? null,
            rel: lines[i].bian?.rel ?? null,
        })),
        liuqinGuide: Object.fromEntries(usedLiuqin.map((k) => [k, LIUQIN_USAGE[k] ?? null])),
        // 卦体关系：本卦所属八宫 + 世应位置 + 动爻数（看卦的大局，不看单爻）。
        guaTi: {
            palace: `${palaceInfo.palace}宫`,
            palaceWuxing: woWuxing,
            gen: palaceInfo.genText,
            shi, ying,
            shiName: YAO_NAME[shi - 1],
            yingName: YAO_NAME[ying - 1],
            movingCount: movingIdxs.length,
            note: '世为问事者自身、应为所问对象；动爻多则事变动剧，静卦则主安稳。',
        },
        // 用神定位 + 应期启发式（必须给问句才定用神；不猜事）。
        yongShen: resolveYongShen(input.question, lines, { shi, ying }),
        disclaimer: '卦象、纳甲干支、六亲六神与旺衰为本地确定性计算；断语属六爻传统框架，仅供娱乐参考。',
    };
}
