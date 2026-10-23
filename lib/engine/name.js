// lib/engine/name.js — 起名确定性引擎：
// 一期（action=assess，评估向）：① 复用八字引擎算喜用倾向（简化判定，非流派定量）；② 内置常用字五行字库逐字评估；
// ③ 字库未收录的字符如实标注「未收录」，不臆断五行。
// 二期（action=generate，候选向）：④ 从自建候选字库（带字义与性别倾向标注）按喜用五行筛字组合，确定性排序出候选名；
// 音韵声调/谐音/生肖用字不在口径内，如实标注。口径与出处全程透明。

import { SHENG, KE, GAN, GAN_WUXING, ZHI, ZHI_WUXING } from './tables.js';
import { computeBazi } from './bazi.js';
import { resolveBirthTime } from './birth-time.js';

/**
 * 常用名字五行字库（自建，按字义/偏旁通行口径，241 字）。
 * 覆盖有限是刻意如实：未收录字符标注「未收录」而不是猜。
 *
 * 已知不完美（如实记录，别当已解决）：本库混用了两套归行规则——
 * 偏旁/字义（林→木、钊→金、涵→水）与部分字的姓名学笔画数理（昌→金、宁/富/宏→土）。
 * 姓名学界对这些字本就各表不一，要统一必须先定一本权威字典再逐字重做，
 * 不宜在代码里凭感觉改；test/name.test.mjs 只锁得住**可机械判定**的那部分
 * （天干/地支字不得与 tables.js 冲突），笔数量理类争议留给作者决策。
 * 例外已修：甲 旧作「土」（按田字格象形），而甲是十天干之首、五行属木，
 * 与自家 tables.js 直接冲突——同一插件里八字说木、起名说土是不能接受的。
 */
export const CHAR_WUXING = {
    // 木
    甲: '木', // 十天干之首，五行属木（与 tables.js 同口径；旧表按田字格象形误作土）
    林: '木', 森: '木', 树: '木', 材: '木', 松: '木', 柏: '木', 梅: '木', 兰: '木', 竹: '木', 桂: '木',
    桃: '木', 李: '木', 杨: '木', 柳: '木', 楠: '木', 榕: '木', 权: '木', 杜: '木', 栋: '木', 樱: '木',
    芳: '木', 草: '木', 花: '木', 芯: '木', 茉: '木', 莉: '木', 菲: '木', 萍: '木', 萌: '木', 蓉: '木',
    蕊: '木', 薇: '木', 艺: '木', 苗: '木', 英: '木', 茂: '木', 春: '木', 楚: '木', 楷: '木', 榆: '木',
    槿: '木', 樾: '木', 彬: '木', 杰: '木', 健: '木', 筠: '木', 箐: '木', 茗: '木', 莞: '木', 蔓: '木',
    // 火
    火: '火', 炎: '火', 焱: '火', 灿: '火', 烨: '火', 煜: '火', 焕: '火', 炜: '火', 烁: '火', 炀: '火',
    明: '火', 昕: '火', 晗: '火', 曦: '火', 晓: '火', 晖: '火', 旭: '火', 昊: '火', 晏: '火', 昱: '火',
    晶: '火', 景: '火', 智: '火', 暖: '火', 昭: '火', 曜: '火', 丹: '火', 彤: '火', 影: '火', 晴: '火',
    灵: '火', 炅: '火', 南: '火', 夏: '火', 然: '火', 煦: '火', 熙: '火', 燃: '火', 燊: '火', 昶: '火',
    // 土
    土: '土', 山: '土', 石: '土', 岩: '土', 峰: '土', 岚: '土', 崇: '土', 岳: '土', 峥: '土', 磊: '土',
    城: '土', 培: '土', 基: '土', 堂: '土', 境: '土', 增: '土', 壁: '土', 田: '土', 由: '土',
    宇: '土', 安: '土', 宏: '土', 容: '土', 宽: '土', 家: '土', 宸: '土', 富: '土', 圣: '土', 宁: '土',
    坤: '土', 垚: '土', 圭: '土', 均: '土', 坚: '土', 维: '土', 远: '土', 运: '土', 逸: '土', 宴: '土',
    嵩: '土', 屹: '土', 峻: '土', 墨: '土', 韦: '土', 卫: '土', 阳: '土', 隆: '土', 唐: '土', 圆: '土',
    // 金
    金: '金', 鑫: '金', 钢: '金', 铁: '金', 银: '金', 铭: '金', 锐: '金', 锋: '金', 钧: '金', 锦: '金',
    玉: '金', 珏: '金', 琮: '金', 璋: '金', 瑾: '金', 瑜: '金', 琰: '金', 珊: '金', 珍: '金', 玲: '金',
    珠: '金', 琪: '金', 琦: '金', 璇: '金', 玮: '金', 珂: '金', 铃: '金', 钰: '金', 静: '金', 素: '金',
    白: '金', 西: '金', 席: '金', 瑞: '金', 珀: '金', 铖: '金', 钊: '金', 镇: '金', 铉: '金', 锡: '金',
    世: '金', 仕: '金', 仁: '金', 修: '金', 承: '金', 昌: '金', 宣: '金',
    // 水
    水: '水', 冰: '水', 雪: '水', 霜: '水', 露: '水', 雨: '水', 云: '水', 霖: '水', 霏: '水', 雯: '水',
    江: '水', 河: '水', 湖: '水', 海: '水', 洋: '水', 池: '水', 泉: '水', 沐: '水', 沛: '水', 洁: '水',
    洪: '水', 洲: '水', 浩: '水', 涵: '水', 淇: '水', 清: '水', 淳: '水', 渊: '水', 涛: '水', 澜: '水',
    潇: '水', 瀚: '水', 泓: '水', 波: '水', 汐: '水', 沁: '水', 淼: '水', 润: '水', 泽: '水', 汉: '水',
    慕: '水', 治: '水', 法: '水', 永: '水', 泰: '水', 源: '水', 溪: '水', 潼: '水', 灏: '水', 湘: '水',
    文: '水', 斌: '水', 平: '水', 学: '水',
};

/**
 * 喜用倾向 → 对名字用字五行打分。
 * 偏强 → 喜克泄耗（官杀/食伤/财），偏弱 → 喜生扶（印/比劫），中和 → 缺补有余亦看格局。
 */
function favorableElements(strength) {
    const dayEl = strength.dayElement;
    if (strength.state === '偏强') {
        // 宜克泄耗：官杀=克我(KE)、食伤=我生(SHENG)、财=我克(KE 的反向查找)。
        // 注意财星必须走 KE 反向查找，走 SHENG 得到的是「印」，会把身强最忌的生扶当成喜用。
        return {
            favorable: [
                KE[dayEl],
                SHENG[dayEl],
                Object.entries(KE).find(([, v]) => v === dayEl)?.[0],
            ].filter(Boolean).filter((e) => e !== dayEl),
            rule: '偏强 → 宜克泄耗（官杀/食伤/财）',
        };
    }
    if (strength.state === '偏弱') {
        return {
            favorable: [dayEl, Object.entries(SHENG).find(([, v]) => v === dayEl)?.[0]].filter(Boolean),
            rule: '偏弱 → 宜生扶（比劫/印）',
        };
    }
    return { favorable: null, rule: '中和 → 五行以调和为先，名字五行与日主生克平和即可' };
}

/**
 * 名字评估。
 * @param {{ surname:string, givenName:string, birth?:{year,month,day,hour?,minute?,gender,calendar?,isLeapMonth?,applyDST?,city?,longitude?} }} input
 *  surname 必填（用于整体音形提示，不参与五行）；birth 给出则做喜用匹配，否则只列各字五行。
 */
export function assessName(input) {
    const surname = typeof input.surname === 'string' ? input.surname.trim() : '';
    const givenName = typeof input.givenName === 'string' ? input.givenName.trim() : '';
    if (!givenName) throw new Error('缺少必要输入：givenName（要评估的名字，1–2 个汉字）——按插件纪律应向用户询问，不要代填。');
    if (givenName.length > 2) throw new Error('givenName 目前支持 1–2 个汉字（复姓双名暂不支持）');

    const chars = [...givenName];
    const charInfos = chars.map((ch) => {
        const wuxing = CHAR_WUXING[ch];
        return {
            char: ch,
            wuxing: wuxing ?? null,
            status: wuxing ? '已收录' : '未收录',
        };
    });

    let bazi = null;
    let favor = null;
    let timeNotes = [];
    if (input.birth) {
        // 统一时间管线：历法归一 → 夏令时 → 真太阳时（applyDST/city/longitude 真实生效）。
        const rt = resolveBirthTime(input.birth);
        timeNotes = rt.notes;
        bazi = computeBazi({
            year: rt.solar.year, month: rt.solar.month, day: rt.solar.day,
            hour: rt.hour ?? 12, minute: rt.minute, gender: input.birth.gender,
            calendar: 'solar', timeKnown: rt.timeKnown, notes: rt.notes,
        }, {});
        favor = favorableElements(bazi.strength);
    }

    let score = 0;
    const details = charInfos.map((c, i) => {
        const d = { ...c };
        if (favor?.favorable && c.wuxing) {
            if (favor.favorable.includes(c.wuxing)) { score += 1; d.match = '合喜用（+1）'; }
            else { score -= 1; d.match = `非喜用（-1，喜用：${favor.favorable.join('、')}）`; }
        } else if (favor?.favorable && !c.wuxing) {
            d.match = '字库未收录，无法判五行（请以字义自行斟酌，或换用字库内同义字）';
        }
        return d;
    });

    // 「评不了」和「评过且中和」是两件事。旧实现只看 score：全部用字都不在字库里时
    // score 停在 0，于是输出「平：名字五行与喜用关系平和，不补不冲」——
    // 把无知当成中性结论，用户会以为这个名字安全，其实引擎压根没看过这两个字（AUDIT P2-6）。
    const evaluable = charInfos.filter((c) => c.wuxing).length;
    const unknownList = charInfos.filter((c) => !c.wuxing).map((c) => c.char).join('、');

    let verdict;
    if (!favor) {
        verdict = { verdict: '未评', text: '未提供生辰，只列各字五行；补生辰后可对照喜用神评估。' };
    } else if (evaluable === 0) {
        verdict = {
            verdict: '未评',
            text: `名字用字（${unknownList}）均不在内置字库内，无法判断与喜用的关系。本条属于未采集到数据，不要当作已判定为无碍——请以字义自行斟酌，或换用字库内同义字后重评。`,
        };
    } else if (score >= chars.length) {
        verdict = { verdict: '上', text: '名字用字五行全合喜用，与命局生扶克泄方向一致。' };
    } else if (score > 0) {
        verdict = { verdict: '中上', text: '名字五行大体合喜用，个别字可斟酌替换。' };
    } else if (score === 0) {
        verdict = {
            verdict: '平',
            text: '名字五行与喜用关系平和，不补不冲。'
                + (unknownList ? `其中未收录字（${unknownList}）未参与计分，不等同于判定为平和。` : ''),
        };
    } else {
        verdict = { verdict: '需斟酌', text: '名字五行与喜用相逆，如有备选名可对照本表比选。' };
    }

    return {
        meta: {
            name: `${surname}${givenName}`,
            surname,
            givenName,
            ...(bazi ? {
                bazi: { pillars: bazi.pillars, dayMaster: bazi.dayMaster, strength: bazi.strength },
            } : {}),
            ...(timeNotes.length > 0 ? { notes: timeNotes } : {}),
        },
        favor: favor ? { favorable: favor.favorable, rule: favor.rule, note: bazi.strength.note } : null,
        chars: details,
        score,
        verdict,
        sources: [
            '喜用倾向：八字引擎简化判定（得令+得势计数法）',
            '字义五行：自建常用字库（字义/偏旁通行口径，未收录字符如实标注）',
        ],
        disclaimer: '名字评估为传统五行口径的本地计算，属民俗参考；名字好坏更在寓意与读音，请综合斟酌，仅供娱乐。',
    };
}

/**
 * 候选名字库（自建，~135 字；全部取自上方 CHAR_WUXING，五行运行时查表——不重复维护两份五行）。
 * · meaning：字义短注（通行寓意口径）；
 * · g：性别倾向 m=偏男 / f=偏女 / n=中性（通行取名习惯，非硬规则）。
 * 覆盖有限是刻意如实：音韵声调、谐音、生肖用字不在口径内，见 generateNames 的 notes。
 */
export const CANDIDATE_CHARS = [
    // 木
    { c: '林', meaning: '双木成林，兴盛', g: 'n' }, { c: '森', meaning: '繁茂有生气', g: 'n' },
    { c: '松', meaning: '松树，坚韧长青', g: 'm' }, { c: '柏', meaning: '柏树，常青挺拔', g: 'm' },
    { c: '梅', meaning: '梅花，傲雪清雅', g: 'f' }, { c: '兰', meaning: '兰花，高洁', g: 'f' },
    { c: '竹', meaning: '修竹，有节君子', g: 'n' }, { c: '芳', meaning: '芬芳', g: 'f' },
    { c: '莉', meaning: '茉莉，清丽', g: 'f' }, { c: '菲', meaning: '花草芬芳', g: 'f' },
    { c: '萌', meaning: '萌芽，生机', g: 'f' }, { c: '蓉', meaning: '芙蓉', g: 'f' },
    { c: '薇', meaning: '蔷薇，柔美', g: 'f' }, { c: '艺', meaning: '才艺', g: 'f' },
    { c: '英', meaning: '英才，出众', g: 'f' }, { c: '彬', meaning: '文质彬彬', g: 'n' },
    { c: '杰', meaning: '俊杰，才智出众', g: 'm' }, { c: '健', meaning: '康健有力', g: 'm' },
    { c: '茗', meaning: '茶之雅称，清逸', g: 'n' }, { c: '楷', meaning: '楷模', g: 'm' },
    { c: '楚', meaning: '清晰、秀美', g: 'n' }, { c: '楠', meaning: '楠木，坚实贵重', g: 'm' },
    { c: '权', meaning: '谋断、权变', g: 'm' },
    // 火
    { c: '烨', meaning: '光辉灿烂', g: 'm' }, { c: '煜', meaning: '照耀、明亮', g: 'm' },
    { c: '明', meaning: '光明磊落', g: 'n' }, { c: '昕', meaning: '拂晓之光', g: 'n' },
    { c: '晗', meaning: '天将明，含光', g: 'n' }, { c: '曦', meaning: '晨光', g: 'n' },
    { c: '晓', meaning: '破晓、通晓', g: 'n' }, { c: '晖', meaning: '阳光', g: 'm' },
    { c: '旭', meaning: '旭日东升', g: 'm' }, { c: '昊', meaning: '广阔苍天', g: 'm' },
    { c: '昱', meaning: '日光昭亮', g: 'm' }, { c: '智', meaning: '聪慧明智', g: 'n' },
    { c: '彤', meaning: '红色，鲜活', g: 'f' }, { c: '晴', meaning: '晴朗明快', g: 'f' },
    { c: '灵', meaning: '灵动聪慧', g: 'f' }, { c: '夏', meaning: '盛夏，明快', g: 'f' },
    { c: '熙', meaning: '光明和乐', g: 'n' }, { c: '昭', meaning: '昭然明亮', g: 'n' },
    { c: '曜', meaning: '日光普照', g: 'm' }, { c: '炜', meaning: '光明', g: 'm' },
    { c: '烁', meaning: '星光闪烁', g: 'm' },
    // 土
    { c: '岩', meaning: '磐岩，坚毅', g: 'm' }, { c: '峰', meaning: '高峰，登顶', g: 'm' },
    { c: '岳', meaning: '五岳，稳重', g: 'm' }, { c: '磊', meaning: '光明磊落', g: 'm' },
    { c: '宇', meaning: '器宇轩昂', g: 'n' }, { c: '安', meaning: '平安顺遂', g: 'n' },
    { c: '宏', meaning: '宏大气度', g: 'm' }, { c: '容', meaning: '包容有度', g: 'n' },
    { c: '家', meaning: '温暖归属', g: 'n' }, { c: '宸', meaning: '北极星所居，尊贵', g: 'm' },
    { c: '宁', meaning: '安宁', g: 'n' }, { c: '坤', meaning: '大地，厚德', g: 'm' },
    { c: '远', meaning: '志存高远', g: 'm' }, { c: '逸', meaning: '超逸洒脱', g: 'n' },
    { c: '阳', meaning: '阳光开朗', g: 'm' }, { c: '峻', meaning: '高峻不群', g: 'm' },
    { c: '屹', meaning: '屹立不摇', g: 'm' }, { c: '墨', meaning: '文墨书卷', g: 'n' },
    { c: '崇', meaning: '崇高', g: 'm' }, { c: '嵩', meaning: '嵩山，沉稳', g: 'm' },
    // 金
    { c: '鑫', meaning: '金多兴盛', g: 'm' }, { c: '铭', meaning: '铭记、篆刻', g: 'm' },
    { c: '锐', meaning: '敏锐进取', g: 'm' }, { c: '锋', meaning: '锋芒才干', g: 'm' },
    { c: '瑜', meaning: '美玉，怀瑾握瑜', g: 'n' }, { c: '瑾', meaning: '美玉，美德', g: 'f' },
    { c: '璇', meaning: '美玉，北斗璇玑', g: 'f' }, { c: '珊', meaning: '珊瑚，玲珑', g: 'f' },
    { c: '珍', meaning: '珍宝', g: 'f' }, { c: '玲', meaning: '玲珑剔透', g: 'f' },
    { c: '琪', meaning: '美玉', g: 'f' }, { c: '琦', meaning: '美玉，不凡', g: 'f' },
    { c: '玮', meaning: '美玉，珍奇', g: 'n' }, { c: '珂', meaning: '白玛瑙', g: 'f' },
    { c: '钰', meaning: '珍宝美玉', g: 'n' }, { c: '静', meaning: '静水流深', g: 'f' },
    { c: '瑞', meaning: '祥瑞', g: 'n' }, { c: '承', meaning: '担当传承', g: 'm' },
    { c: '修', meaning: '修身', g: 'm' }, { c: '昌', meaning: '昌盛', g: 'm' },
    { c: '世', meaning: '济世', g: 'm' }, { c: '仕', meaning: '仕途有成', g: 'm' },
    { c: '仁', meaning: '仁爱', g: 'm' }, { c: '素', meaning: '素雅本真', g: 'f' },
    // 水
    { c: '雪', meaning: '白雪，纯净', g: 'f' }, { c: '雯', meaning: '成纹的云彩', g: 'f' },
    { c: '霖', meaning: '甘霖，恩泽', g: 'm' }, { c: '霏', meaning: '云霏轻扬', g: 'f' },
    { c: '云', meaning: '行云舒卷', g: 'n' }, { c: '海', meaning: '海纳百川', g: 'm' },
    { c: '洋', meaning: '汪洋宽广', g: 'm' }, { c: '泉', meaning: '清泉不竭', g: 'n' },
    { c: '沐', meaning: '如沐春风', g: 'n' }, { c: '沛', meaning: '充沛丰盛', g: 'm' },
    { c: '洁', meaning: '洁净', g: 'f' }, { c: '浩', meaning: '浩然之气', g: 'm' },
    { c: '涵', meaning: '涵养', g: 'n' }, { c: '淇', meaning: '淇水，清丽', g: 'f' },
    { c: '清', meaning: '清正', g: 'n' }, { c: '淳', meaning: '淳朴', g: 'n' },
    { c: '渊', meaning: '渊博深沉', g: 'm' }, { c: '涛', meaning: '波涛，气魄', g: 'm' },
    { c: '澜', meaning: '波澜，大气', g: 'n' }, { c: '潇', meaning: '潇洒', g: 'n' },
    { c: '瀚', meaning: '浩瀚', g: 'm' }, { c: '泓', meaning: '水深而广', g: 'm' },
    { c: '汐', meaning: '晚潮，柔美', g: 'f' }, { c: '沁', meaning: '沁人心脾', g: 'f' },
    { c: '淼', meaning: '水势浩渺', g: 'f' }, { c: '润', meaning: '温润如玉', g: 'n' },
    { c: '泽', meaning: '恩泽惠人', g: 'm' }, { c: '源', meaning: '源头活水', g: 'm' },
    { c: '溪', meaning: '清溪，灵动', g: 'f' }, { c: '湘', meaning: '湘水', g: 'f' },
    { c: '文', meaning: '文雅', g: 'n' }, { c: '斌', meaning: '文武兼备', g: 'n' },
    { c: '学', meaning: '好学', g: 'm' }, { c: '泰', meaning: '安泰', g: 'm' },
    { c: '永', meaning: '长久', g: 'm' }, { c: '汉', meaning: '云汉，大气', g: 'm' },
    { c: '慕', meaning: '向往', g: 'n' }, { c: '治', meaning: '治学治事', g: 'm' },
];

/**
 * 候选名生成（action=generate）。
 * @param {{ surname:string, birth:{year,month,day,hour?,gender,calendar?,isLeapMonth?,applyDST?,city?,longitude?},
 *            limit?:number }} input
 *  birth 必填且 gender 必填（性别既定喜用方向也定候选字性别倾向）；limit 缺省 10。
 *  确定性：同输入永远同一份候选（不随机）。
 */
export function generateNames(input) {
    const surname = typeof input.surname === 'string' ? input.surname.trim() : '';
    if (!surname) throw new Error('缺少必要输入：surname（姓氏）——按插件纪律应向用户询问，不要代填。');
    const birth = input.birth ?? null;
    if (!birth || !Number.isInteger(birth.year) || !Number.isInteger(birth.month) || !Number.isInteger(birth.day)) {
        throw new Error('缺少必要输入：birth（出生年月日）——候选生成必须按八字喜用筛字，请向用户询问生辰，不要代填。');
    }
    const gender = birth.gender === 'male' ? 'male' : birth.gender === 'female' ? 'female' : null;
    if (!gender) throw new Error("缺少必要输入：birth.gender（'male' | 'female'）——性别决定候选字的性别倾向筛选，请向用户询问。");
    const limit = Math.max(1, Math.min(20, Number.isInteger(input.limit) ? input.limit : 10));

    // 统一时间管线：历法归一 → 夏令时 → 真太阳时（applyDST/city/longitude 真实生效）。
    const rt = resolveBirthTime(birth);
    const bazi = computeBazi({
        year: rt.solar.year, month: rt.solar.month, day: rt.solar.day,
        hour: rt.hour ?? 12, minute: rt.minute, gender,
        calendar: 'solar', timeKnown: rt.timeKnown, notes: rt.notes,
    }, {});
    const favor = favorableElements(bazi.strength);
    const fit = favor.favorable; // null = 中和，以调和为先（不筛五行）

    // 性别倾向：偏男名给 m/n，偏女名给 f/n（n 为中性，两侧都收）。
    const want = gender === 'male' ? ['m', 'n'] : ['f', 'n'];
    const pool = CANDIDATE_CHARS.filter((x) => want.includes(x.g) && (!fit || fit.includes(CHAR_WUXING[x.c])));
    if (pool.length === 0) {
        throw new Error(`当前喜用（${fit.join('、')}）与性别倾向约束下字库为空——如实告知用户候选字库覆盖有限，建议人工按喜用五行选字。`);
    }

    // 单字与双字候选（双字取字库顺序 i<j 组合，不重复用字）。
    const raw = [];
    pool.forEach((x, i) => raw.push({ given: x.c, chars: [x], key: i, len: 1 }));
    for (let i = 0; i < pool.length; i++) {
        for (let j = i + 1; j < pool.length; j++) {
            raw.push({ given: pool[i].c + pool[j].c, chars: [pool[i], pool[j]], key: i * pool.length + j, len: 2 });
        }
    }
    // 计分：合喜用字数（fit 为 null 时不打分）。排序确定性：分高→简洁（单字在前）→字库顺序。
    for (const r of raw) {
        r.score = fit ? r.chars.filter((x) => fit.includes(CHAR_WUXING[x.c])).length : 0;
    }
    raw.sort((a, b) => b.score - a.score || a.len - b.len || a.key - b.key);

    // 贪心选取（多样性优先）：双字名首个用字不与已选重复（避免「李林X」刷屏），
    // 任何用字只出现一次；单字保底 singleTake 个（简洁选项不被双字名挤光）；
    // 仍不足 limit 时最后按序补齐（只查重名，不查字）。
    const singleTake = Math.max(1, Math.min(3, Math.floor(limit / 3)));
    const pairQuota = Math.max(0, limit - singleTake);
    const singles = raw.filter((r) => r.len === 1);
    const pairs = raw.filter((r) => r.len === 2);
    const picked = [];
    const used = new Set();
    const usedFirst = new Set();
    const seen = new Set();
    const tryPick = (r) => {
        if (seen.has(r.given)) return false;
        if (r.len === 2) {
            const [a, b] = r.chars;
            if (usedFirst.has(a.c) || used.has(a.c) || used.has(b.c)) return false;
            usedFirst.add(a.c);
        } else if (used.has(r.chars[0].c)) return false;
        picked.push(r);
        for (const x of r.chars) used.add(x.c);
        seen.add(r.given);
        return true;
    };
    for (const r of pairs) { if (picked.length >= pairQuota) break; tryPick(r); }
    for (const r of singles) { if (picked.length >= limit) break; tryPick(r); }
    for (const r of raw) { if (picked.length >= limit) break; tryPick(r); }
    if (picked.length < limit) {
        for (const r of raw) {
            if (picked.length >= limit) break;
            if (!seen.has(r.given)) { picked.push(r); seen.add(r.given); }
        }
    }

    const matchText = (r) => {
        if (!fit) return '以调和为先（中和，不按五行强筛）';
        if (r.score === r.chars.length) return '全合喜用';
        return r.score > 0 ? '部分合喜用' : '按字义生成（五行未入喜用）';
    };

    return {
        meta: {
            surname,
            gender: gender === 'male' ? '男' : '女',
            ...(fit ? {} : { zhonghe: true }),
            ...(rt.notes.length > 0 ? { notes: rt.notes } : {}),
        },
        favor: { favorable: fit, rule: favor.rule, note: bazi.strength.note },
        poolSize: pool.length,
        candidates: picked.map((r) => ({
            name: `${surname}${r.given}`,
            given: r.given,
            chars: r.chars.map((x) => ({ char: x.c, wuxing: CHAR_WUXING[x.c], meaning: x.meaning })),
            score: r.score,
            match: matchText(r),
        })),
        notes: [
            '候选只按喜用五行与性别倾向筛字：音韵声调、方言谐音、生肖用字、与长辈重名等均不在口径内，定名前请把候选逐个读念检查。',
            `候选字库为自建的 ${CANDIDATE_CHARS.length} 字子集（全部取自常用字五行字库），覆盖有限；字库外的字未参与生成，不代表不好。`,
        ],
        sources: [
            '喜用倾向：八字引擎简化判定（得令+得势计数法）',
            '选字：自建候选字库（字义/偏旁通行口径，含性别倾向标注）',
            '组合与排序：确定性规则（合喜用字数 → 简洁度 → 字库顺序），不随机',
        ],
        disclaimer: '候选名由本地字库按传统五行口径生成，属民俗参考；名字好坏更在寓意与读音，请综合斟酌，仅供娱乐。',
    };
}
