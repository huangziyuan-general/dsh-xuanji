// lib/engine/hexagrams.js — 六十四卦数据（王序/通行本卦序）。
// 每卦按「上卦×下卦」索引，含卦名、卦序号（用于取 Unicode 卦画 ䷀–䷿）、白话卦意。
// 卦意为一句话白话提炼（非原文照录），供模型解读引用，出处以原文为准。

/** 八经卦：先天卦数、单卦名、卦符、五行、逐爻（自下而上，1=阳 0=阴）。 */
export const TRIGRAMS = {
    乾: { num: 1, symbol: '☰', wuxing: '金', lines: [1, 1, 1], nature: '天' },
    兑: { num: 2, symbol: '☱', wuxing: '金', lines: [1, 1, 0], nature: '泽' },
    离: { num: 3, symbol: '☲', wuxing: '火', lines: [1, 0, 1], nature: '火' },
    震: { num: 4, symbol: '☳', wuxing: '木', lines: [1, 0, 0], nature: '雷' },
    巽: { num: 5, symbol: '☴', wuxing: '木', lines: [0, 1, 1], nature: '风' },
    坎: { num: 6, symbol: '☵', wuxing: '水', lines: [0, 1, 0], nature: '水' },
    艮: { num: 7, symbol: '☶', wuxing: '土', lines: [0, 0, 1], nature: '山' },
    坤: { num: 8, symbol: '☷', wuxing: '土', lines: [0, 0, 0], nature: '地' },
};

export const TRIGRAM_ORDER = ['乾', '兑', '离', '震', '巽', '坎', '艮', '坤'];

/** 六十四卦：HEXAGRAMS[上卦][下卦] = { name, kingWen, gist }。 */
export const HEXAGRAMS = {
    乾: {
        乾: { name: '乾为天', kingWen: 1, gist: '刚健进取，自强不息；大有所成之象，切忌亢龙有悔。' },
        兑: { name: '天泽履', kingWen: 10, gist: '如履虎尾，谨慎前行；礼让守分则无咎。' },
        离: { name: '天火同人', kingWen: 13, gist: '与人和同，光明相聚；合作成事之象。' },
        震: { name: '天雷无妄', kingWen: 25, gist: '守正无妄，顺其自然；不妄为则吉。' },
        巽: { name: '天风姤', kingWen: 44, gist: '不期而遇，防微杜渐；邂逅之中藏隐患。' },
        坎: { name: '天水讼', kingWen: 6, gist: '争讼非美事，宜和解退让；讼则终凶。' },
        艮: { name: '天山遁', kingWen: 33, gist: '退避为宜，急流勇退；远小人以保身。' },
        坤: { name: '天地否', kingWen: 12, gist: '天地不交，闭塞之象；否极泰来，静待转机。' },
    },
    兑: {
        乾: { name: '泽天夬', kingWen: 43, gist: '决断去弊，当机立断；光明正大则可制胜。' },
        兑: { name: '兑为泽', kingWen: 58, gist: '和悦相说，朋友讲习；以诚相待则亨。' },
        离: { name: '泽火革', kingWen: 49, gist: '变革之时，顺天应人；旧貌换新颜。' },
        震: { name: '泽雷随', kingWen: 17, gist: '随时顺势，择善而从；跟随正道则无咎。' },
        巽: { name: '泽风大过', kingWen: 28, gist: '非常之时行非常之事；栋桡之危，量力而动。' },
        坎: { name: '泽水困', kingWen: 47, gist: '身处困境，守志不移；困而不失其所亨。' },
        艮: { name: '泽山咸', kingWen: 31, gist: '感应相通，两情相悦；以诚感人则吉。' },
        坤: { name: '泽地萃', kingWen: 45, gist: '荟萃聚集，人脉汇拢；聚正则亨，防生变故。' },
    },
    离: {
        乾: { name: '火天大有', kingWen: 14, gist: '富有盛大，德位相配；顺天休命则吉。' },
        兑: { name: '火泽睽', kingWen: 38, gist: '背离乖异，小同大异；求同存异可化睽。' },
        离: { name: '离为火', kingWen: 30, gist: '光明丽天，附着而明；守正则亨，防过刚致燥。' },
        震: { name: '火雷噬嗑', kingWen: 21, gist: '明罚敕法，咬合断制；除障去梗，利于用狱。' },
        巽: { name: '火风鼎', kingWen: 50, gist: '鼎新之象，去故取新；养贤凝命，大亨以养。' },
        坎: { name: '火水未济', kingWen: 64, gist: '事未竟成，慎终如始；辨物居方，徐图后举。' },
        艮: { name: '火山旅', kingWen: 56, gist: '羁旅在外，谨慎柔顺；小事可亨，大举宜缓。' },
        坤: { name: '火地晋', kingWen: 35, gist: '光明上进，晋升之象；柔进而上行则吉。' },
    },
    震: {
        乾: { name: '雷天大壮', kingWen: 34, gist: '刚壮有力，声势正盛；壮而守礼则吉，恃强则凶。' },
        兑: { name: '雷泽归妹', kingWen: 54, gist: '嫁娶归妹，位不当则悔；进退须守正礼。' },
        离: { name: '雷火丰', kingWen: 55, gist: '盛大丰盈，如日中天；盛极须防衰，守中为宜。' },
        震: { name: '震为雷', kingWen: 51, gist: '惊雷震动，戒惧致福；闻惊不乱则亨。' },
        巽: { name: '雷风恒', kingWen: 32, gist: '恒久其道，持之以恒；立不易方则吉。' },
        坎: { name: '雷水解', kingWen: 40, gist: '险困消解，往有功也；宜速解不宜久拖。' },
        艮: { name: '雷山小过', kingWen: 62, gist: '小事可过，大事宜守；飞鸟遗音，宜下不宜上。' },
        坤: { name: '雷地豫', kingWen: 16, gist: '喜悦和乐，预立则逸；乐而有节则吉。' },
    },
    巽: {
        乾: { name: '风天小畜', kingWen: 9, gist: '密云不雨，小有蓄积；力量未足，静待时机。' },
        兑: { name: '风泽中孚', kingWen: 61, gist: '诚信感通，中心笃实；信及豚鱼则吉。' },
        离: { name: '风火家人', kingWen: 37, gist: '各正其位，家和事兴；治内先于治外。' },
        震: { name: '风雷益', kingWen: 42, gist: '损上益下，施惠得众；见善则迁则吉。' },
        巽: { name: '巽为风', kingWen: 57, gist: '随风入物，谦顺行事；申命行事则亨。' },
        坎: { name: '风水涣', kingWen: 59, gist: '涣散离散，宜聚人心；王假有庙，诚可聚涣。' },
        艮: { name: '风山渐', kingWen: 53, gist: '循序渐进，如鸿渐陆；缓进则吉，急功则凶。' },
        坤: { name: '风地观', kingWen: 20, gist: '观仰示范，瞻仰德化；观其所由，静观其变。' },
    },
    坎: {
        乾: { name: '水天需', kingWen: 5, gist: '等待时机，饮食宴乐；需而有恒则亨。' },
        兑: { name: '水泽节', kingWen: 60, gist: '节制有度，甘节则吉；苦节不可久。' },
        离: { name: '水火既济', kingWen: 63, gist: '功成初定，万事已济；守成防患于未然。' },
        震: { name: '水雷屯', kingWen: 3, gist: '初创艰难，屯积力量；勿用有攸往，建侯蓄势。' },
        巽: { name: '水风井', kingWen: 48, gist: '井养不穷，守正供养；改邑不改井，持中有为。' },
        坎: { name: '坎为水', kingWen: 29, gist: '重险叠陷，诚信守常；行险而不失其信则亨。' },
        艮: { name: '水山蹇', kingWen: 39, gist: '行有蹇滞，见险而止；反身修德，利见大人。' },
        坤: { name: '水地比', kingWen: 8, gist: '亲比相依，择善而从；比之自内则吉。' },
    },
    艮: {
        乾: { name: '山天大畜', kingWen: 26, gist: '厚积薄发，大有蓄养；利涉大川，蓄极而通。' },
        兑: { name: '山泽损', kingWen: 41, gist: '损下益上，舍得之道；损而有孚则吉。' },
        离: { name: '山火贲', kingWen: 22, gist: '文饰有度，质朴为本；白贲无咎，返璞归真。' },
        震: { name: '山雷颐', kingWen: 27, gist: '颐养之道，慎言节食；自求口实，养正则吉。' },
        巽: { name: '山风蛊', kingWen: 18, gist: '整饬积弊，治蛊有为；振疲起衰，元亨。' },
        坎: { name: '山水蒙', kingWen: 4, gist: '蒙昧待启，求教于师；匪我求童蒙，童蒙求我。' },
        艮: { name: '艮为山', kingWen: 52, gist: '适可而止，止于所当止；时止则止，时行则行。' },
        坤: { name: '山地剥', kingWen: 23, gist: '剥落衰微，剥极将复；厚下安宅，静待生机。' },
    },
    坤: {
        乾: { name: '地天泰', kingWen: 11, gist: '天地交泰，通达安顺；小往大来，泰极须防否。' },
        兑: { name: '地泽临', kingWen: 19, gist: '君临其事，以上临下；临事而惧则吉。' },
        离: { name: '地火明夷', kingWen: 36, gist: '光明入地，晦而转明；用晦而明，守拙避害。' },
        震: { name: '地雷复', kingWen: 24, gist: '一阳来复，否极泰来；七日来复，顺行则吉。' },
        巽: { name: '地风升', kingWen: 46, gist: '积小成大，上升之象；柔以时升，元亨。' },
        坎: { name: '地水师', kingWen: 7, gist: '行险而顺，师出有名；统众以正，贞固则吉。' },
        艮: { name: '地山谦', kingWen: 15, gist: '谦谦君子，卑以自牧；裒多益寡，称物平施。' },
        坤: { name: '坤为地', kingWen: 2, gist: '厚德载物，柔顺包容；先迷后得主，西南得朋。' },
    },
};

/** 卦画 Unicode：U+4DC0 起按通行本卦序排布（䷀=乾 … ䷿=未济）。 */
export function hexagramSymbol(kingWen) {
    return String.fromCharCode(0x4dbf + kingWen);
}

/** 由逐爻（自下而上 6 位）反查卦：返回 { name, kingWen, gist, upper, lower }，查不到返回 null。 */
export function hexagramByLines(lines) {
    const upperLines = lines.slice(3);
    const lowerLines = lines.slice(0, 3);
    const match = (three) => TRIGRAM_ORDER.find((k) => TRIGRAMS[k].lines.join('') === three.join('')) ?? null;
    const upper = match(upperLines);
    const lower = match(lowerLines);
    if (!upper || !lower) return null;
    const hex = HEXAGRAMS[upper][lower];
    return { ...hex, upper, lower, symbol: hexagramSymbol(hex.kingWen) };
}

/** 经卦按先天卦数取名：乾一兑二离三震四巽五坎六艮七坤八（0 视作 8）。 */
export function trigramByCount(n) {
    const k = ((n - 1) % 8 + 8) % 8;
    return TRIGRAM_ORDER[k];
}
