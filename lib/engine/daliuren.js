// lib/engine/daliuren.js — 大六壬（本地确定性排盘引擎，实验性）。
//
// ⚠️ 实验性声明：本模块落地了「天地盘 + 四课 + 贼克法初传 + 顺布中末传」核心，
// 并通过了结构不变量与一处手算贼克锚点；但九宗门其余八法（涉害/遥克/昴星/别责/八专/伏吟/返吟）
// 与中末传的若干流派差异**尚未做经典案例对拍校准**，故标注「实验性」，模型给用户解读时必须照实说明，
// 不可当作定论。这是为补齐「竞品有大六壬、本插件缺失」的体系空白而先交付的核心骨架。
//
// 依赖：lunar-javascript 取日干支与节气月建（与项目其余引擎同源，非自造历法）。

import { ZHI, ZHI_WUXING, GAN_YINYANG, GAN } from './tables.js';
import { Solar } from 'lunar-javascript';

/** 日干寄宫（大六壬专用）：甲寅 乙辰 丙巳 丁未 戊巳 己未 庚申 辛戌 壬亥 癸丑。 */
const GAN_JIGONG = { 甲: '寅', 乙: '辰', 丙: '巳', 丁: '未', 戊: '巳', 己: '未', 庚: '申', 辛: '戌', 壬: '亥', 癸: '丑' };

/** 六合（月将取法）：子丑 寅亥 卯戌 辰酉 巳申 午未。 */
const LIUHE = { 子: '丑', 丑: '子', 寅: '亥', 卯: '戌', 辰: '酉', 巳: '申', 午: '未', 未: '午', 申: '巳', 酉: '辰', 戌: '卯', 亥: '寅' };

const idx = (z) => ZHI.indexOf(z);
const zhiWuxing = (z) => ZHI_WUXING[idx(z)];

/** 五行生克：a 克 b？ */
function ke(a, b) {
    const map = { 木: '土', 土: '水', 水: '火', 火: '金', 金: '木' };
    return map[a] === b;
}

/**
 * 解析输入为 { dayGan, dayZhi, monthZhi, hourZhi }。
 * 支持：① 公历生日+时辰；② 直接给 dayGanZhi + hourZhi。
 */
function resolveInput(input) {
    if (input?.dayGanZhi && input?.hourZhi) {
        const dg = input.dayGanZhi[0];
        const dz = input.dayGanZhi.slice(1);
        const mz = input.monthZhi ?? null;
        return { dayGan: dg, dayZhi: dz, monthZhi: mz, hourZhi: input.hourZhi };
    }
    const { year, month, day, hour } = input;
    if (![year, month, day, hour].every((x) => Number.isInteger(x))) {
        throw new Error('大六壬需要公历 year/month/day/hour，或 dayGanZhi+hourZhi；缺输入不猜（纪律）');
    }
    const lu = Solar.fromYmd(year, month, day).getLunar();
    const dayGanZhi = lu.getDayInGanZhi();
    const dayGan = dayGanZhi[0];
    const dayZhi = dayGanZhi.slice(1);
    const monthZhi = lu.getMonthZhi();
    const hourZhi = ZHI[Math.floor(((hour + 1) % 24) / 2)];
    return { dayGan, dayZhi, monthZhi, hourZhi };
}

/**
 * 排天地盘：地盘固定十二支顺时针；天盘以「月将加临占时宫」顺布十二支。
 * @returns {{ earth:string[], heaven:string[], yuejiang:string, zhan:string }}
 */
export function computeDiTianPan(monthZhi, hourZhi) {
    const yuejiang = LIUHE[monthZhi]; // 月将 = 月建六合支
    if (!yuejiang) throw new Error(`月建 ${monthZhi} 无对应月将`);
    const zhan = hourZhi;
    const yj = idx(yuejiang);
    const zh = idx(zhan);
    // 天盘[宫位 z] = ZHI[(yuejiang_idx + (z_index - zhan_index)) mod 12]
    const heaven = ZHI.map((_, i) => ZHI[(yj + (i - zh)) % 12]);
    return { earth: [...ZHI], heaven, yuejiang, zhan };
}

/**
 * 排四课：干上/干阴/支上/支阴（各为地支）。
 * 日干寄宫后取天盘；四课依次为 干位→干上→干阴、支→支上→支阴。
 */
export function computeSiKe(dayGan, dayZhi, heaven) {
    const tianAt = (z) => heaven[idx(z)]; // 天盘在某宫位的支
    const ganWei = GAN_JIGONG[dayGan];
    const ganShang = tianAt(ganWei);
    const ganYin = tianAt(ganShang);
    const zhiShang = tianAt(dayZhi);
    const zhiYin = tianAt(zhiShang);
    return [
        { ben: ganWei, shang: ganShang },
        { ben: ganShang, shang: ganYin },
        { ben: dayZhi, shang: zhiShang },
        { ben: zhiShang, shang: zhiYin },
    ];
}

/**
 * 贼克法取初传（九宗门第一法）：
 *   优先「下克上」（本支克上神），其次「上克下」（上神克本支）；
 *   多者取首（比用/涉害等其余细则待校准，见文件头声明）。
 * @returns {string|null} 初传地支；四课无克返回 null（需昴星/遥克等，本版未实现）。
 */
export function zeikeChuan(dayGan, four) {
    const isKe = (ben, shang) => ke(zhiWuxing(ben), zhiWuxing(shang)); // 上克下
    const isKeReverse = (ben, shang) => ke(zhiWuxing(shang), zhiWuxing(ben)); // 下克上（本克上）
    const xiaKe = four.filter((k) => isKeReverse(k.ben, k.shang)); // 下克上优先
    const shangKe = four.filter((k) => isKe(k.ben, k.shang));
    const pool = xiaKe.length ? xiaKe : shangKe.length ? shangKe : [];
    if (pool.length === 0) return null;
    return pool[0].shang; // 初传取行克之上神
}

/**
 * 大六壬主函数。
 * @param {{ year?:number, month?:number, day?:number, hour?:number, dayGanZhi?:string, monthZhi?:string, hourZhi?:string }} input
 */
export function computeDaliuren(input) {
    const { dayGan, dayZhi, monthZhi, hourZhi } = resolveInput(input);
    if (!monthZhi) {
        throw new Error('无法确定月将（缺月建）：公历路径由 lunar 取节气月建，直接给 dayGanZhi 时请补 monthZhi。');
    }
    const { earth, heaven, yuejiang, zhan } = computeDiTianPan(monthZhi, hourZhi);
    const four = computeSiKe(dayGan, dayZhi, heaven);
    const chu = zeikeChuan(dayGan, four);
    let chuan = null;
    if (chu) {
        const zhong = heaven[idx(chu)];
        const mo = heaven[idx(zhong)];
        chuan = [chu, zhong, mo];
    }
    return {
        meta: {
            experimental: true,
            dayGanZhi: dayGan + dayZhi,
            monthZhi,
            yuejiang,
            zhan,
            note: '实验性：天地盘/四课与贼克初传已落地；九宗门其余八法及中末传流派差异待经典案例对拍校准，解读须照实说明。',
        },
        earth,
        heaven,
        four,
        sanChuan: chuan, // null 表示四课无克，需昴星/遥克等（本版未实现）
        sources: ['大六壬：天地盘·四课·贼克法（实验性，待经典对拍校准）'],
        disclaimer: '大六壬为传统占卜体系，属文化娱乐用途，不构成任何现实决策依据；本引擎为实验性实现，结果须经典籍复核。',
    };
}
