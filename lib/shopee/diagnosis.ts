import type { AdMetric, AffiliateMetric, AnalysisResult, Benchmarks, Diagnosis, ProductMetric, ProductRow, Severity } from "./types";
import { buildBenchmarks } from "./benchmark";
import { clamp, safeDivide } from "./number";

function mergeAds(ads: AdMetric[]): Map<string, AdMetric> {
  const map = new Map<string, AdMetric>();
  for (const ad of ads) {
    const current = map.get(ad.itemId);
    if (!current) {
      map.set(ad.itemId, { ...ad });
      continue;
    }
    const impressions = current.impressions + ad.impressions;
    const clicks = current.clicks + ad.clicks;
    const addToCart = current.addToCart + ad.addToCart;
    const conversions = current.conversions + ad.conversions;
    const gmv = current.gmv + ad.gmv;
    const expense = current.expense + ad.expense;
    map.set(ad.itemId, {
      ...current,
      adName: [current.adName, ad.adName].filter(Boolean).join(" + "),
      impressions,
      clicks,
      ctr: safeDivide(clicks, impressions),
      addToCart,
      addToCartRate: safeDivide(addToCart, clicks),
      conversions,
      conversionRate: safeDivide(conversions, clicks),
      gmv,
      expense,
      roas: safeDivide(gmv, expense),
      acos: safeDivide(expense, gmv),
    });
  }
  return map;
}

function mergeRows(products: ProductMetric[], ads: AdMetric[], affiliate: AffiliateMetric[]): ProductRow[] {
  const adMap = mergeAds(ads);
  const affiliateByItem = new Map<string, { gmv: number; orders: number }>();
  for (const row of affiliate) {
    if (!row.itemId) continue;
    const current = affiliateByItem.get(row.itemId) ?? { gmv: 0, orders: 0 };
    current.gmv += row.gmv;
    current.orders += row.orders;
    affiliateByItem.set(row.itemId, current);
  }
  return products.map((product) => {
    const aff = affiliateByItem.get(product.itemId);
    return {
      ...product,
      ad: adMap.get(product.itemId),
      affiliateGmv: aff?.gmv,
      affiliateOrders: aff?.orders,
    };
  });
}

function gap(value: number, benchmark: number): number {
  if (benchmark <= 0) return 0;
  return clamp((benchmark - value) / benchmark, 0, 1);
}

function levelFor(row: ProductRow, benchmarks: Benchmarks): { severity: Severity; problem: string; evidence: string[]; actions: string[] } {
  const cr = row.confirmedBuyerCr || row.placedBuyerCr;
  const confirmRate = safeDivide(row.confirmedOrders, row.placedOrders);
  const evidence: string[] = [];

  if (row.impressions < 100 && row.visitors < 20) {
    return {
      severity: "WATCH",
      problem: "样本量不足，暂不做强诊断",
      evidence: [`曝光 ${Math.round(row.impressions)}，访客 ${Math.round(row.visitors)}，低于稳定判断所需样本。`],
      actions: ["先获得更多自然/广告流量，再判断主图与转化问题。", "避免因为少量点击或少量订单就大幅改价或停广告。"],
    };
  }

  const ctrBad = row.impressions >= 300 && benchmarks.ctr.p25 > 0 && row.ctr < benchmarks.ctr.p25;
  const atcBad = row.visitors >= 30 && benchmarks.addToCartRate.p25 > 0 && row.addToCartRate < benchmarks.addToCartRate.p25;
  const crBad = row.visitors >= 30 && benchmarks.conversionRate.p25 > 0 && cr < benchmarks.conversionRate.p25;
  const adBad = (row.ad?.expense ?? 0) > 0 && benchmarks.roas.p25 > 0 && (row.ad?.roas ?? 0) < benchmarks.roas.p25;
  const confirmBad = row.placedOrders >= 5 && benchmarks.orderConfirmRate.p25 > 0 && confirmRate < benchmarks.orderConfirmRate.p25;

  if (ctrBad) evidence.push(`CTR ${(row.ctr * 100).toFixed(2)}%，低于店内 P25 ${(benchmarks.ctr.p25 * 100).toFixed(2)}%。`);
  if (atcBad) evidence.push(`加购率 ${(row.addToCartRate * 100).toFixed(2)}%，低于店内 P25 ${(benchmarks.addToCartRate.p25 * 100).toFixed(2)}%。`);
  if (crBad) evidence.push(`成交转化率 ${(cr * 100).toFixed(2)}%，低于店内 P25 ${(benchmarks.conversionRate.p25 * 100).toFixed(2)}%。`);
  if (adBad) evidence.push(`广告 ROAS ${(row.ad?.roas ?? 0).toFixed(2)}，低于店内广告 P25 ${benchmarks.roas.p25.toFixed(2)}。`);
  if (confirmBad) evidence.push(`订单确认率 ${(confirmRate * 100).toFixed(1)}%，低于店内 P25 ${(benchmarks.orderConfirmRate.p25 * 100).toFixed(1)}%。`);

  if (ctrBad && row.impressions >= 1000) {
    return {
      severity: "P0",
      problem: "高曝光但点击弱：主图/标题/价格竞争力优先修复",
      evidence,
      actions: [
        "先做主图 A/B：产品主体放大、核心规格大字化、首屏只保留 1–2 个强卖点。",
        "复查标题前 60–80 字是否覆盖菲律宾买家真实搜索词，并把尺寸/功率/用途前置。",
        "对比同类头部链接到手价、优惠券、COD、赠品和评分露出，避免广告买到无效曝光。",
      ],
    };
  }

  if (crBad && row.visitors >= 80) {
    return {
      severity: "P0",
      problem: "有流量但成交弱：商品页与价格/信任问题",
      evidence,
      actions: [
        "检查 SKU 命名、价格梯度、库存与优惠是否让买家能快速选对型号。",
        "详情页按“主卖点→痛点→参数→场景→对比→配件→售后”重排，减少无关信息。",
        "优先补强真实评价、售后承诺、COD/包装保障与关键参数一致性。",
      ],
    };
  }

  if (atcBad || adBad || confirmBad) {
    return {
      severity: "P1",
      problem: atcBad ? "点击后兴趣不足：详情页/卖点承接偏弱" : adBad ? "广告效率偏低" : "下单后的确认/履约损耗偏高",
      evidence,
      actions: atcBad
        ? ["把首屏卖点与主图承诺完全对齐。", "突出菲律宾场景、适用对象、配件和使用方法，减少买家理解成本。", "检查高流量 SKU 是否价格或规格描述造成犹豫。"]
        : adBad
          ? ["把预算从低 ROAS 广告转移到高转化 SKU。", "先修低 CTR 素材，再扩大 GMV Max 或关键词广告。", "区分自然流量问题和广告流量问题，不要只靠加预算解决。"]
          : ["检查缺货、取消、异常物流和买家沟通。", "确认承诺时效、COD 与包装说明是否清晰。", "对高取消 SKU 单独做原因追踪。"],
    };
  }

  const strongCtr = row.ctr >= benchmarks.ctr.p75 && benchmarks.ctr.p75 > 0;
  const strongCr = cr >= benchmarks.conversionRate.p75 && benchmarks.conversionRate.p75 > 0;
  const strongRoas = !row.ad || row.ad.expense <= 0 || benchmarks.roas.p75 === 0 || row.ad.roas >= benchmarks.roas.p75;
  if (strongCtr && strongCr && strongRoas) {
    return {
      severity: "SCALE",
      problem: "店内强势链接，可扩大流量",
      evidence: [
        `CTR ${(row.ctr * 100).toFixed(2)}% 达到店内 P75 以上。`,
        `成交转化率 ${(cr * 100).toFixed(2)}% 达到店内 P75 以上。`,
      ],
      actions: ["逐步扩大广告预算而不是一次性翻倍。", "复制高转化主图/详情页结构到同类链接。", "优先保证库存、价格稳定和评价增长。"],
    };
  }

  return {
    severity: "P2",
    problem: "整体中等，存在可优化空间",
    evidence: evidence.length ? evidence : ["核心指标位于店内中间区间，暂未发现单一严重短板。"],
    actions: ["每次只改一个主要变量并记录日期。", "优先优化点击或转化中较弱的一项。", "7–14 天后用同口径报表复盘变化。"],
  };
}

function scoreOpportunity(row: ProductRow, benchmarks: Benchmarks, severity: Severity): number {
  if (severity === "SCALE") return Math.round(75 + Math.min(25, Math.log10(Math.max(row.impressions, 10)) * 5));
  if (severity === "WATCH" || severity === "DATA") return 10;
  const cr = row.confirmedBuyerCr || row.placedBuyerCr;
  const trafficWeight = clamp(Math.log10(Math.max(row.impressions, 10)) / 5, 0.15, 1);
  const weakness =
    0.35 * gap(row.ctr, benchmarks.ctr.median) +
    0.25 * gap(row.addToCartRate, benchmarks.addToCartRate.median) +
    0.4 * gap(cr, benchmarks.conversionRate.median);
  const severityBoost = severity === "P0" ? 25 : severity === "P1" ? 12 : 0;
  return Math.round(clamp(weakness * trafficWeight + severityBoost / 100, 0, 1) * 100);
}

export function analyzeReports(products: ProductMetric[], ads: AdMetric[] = [], affiliate: AffiliateMetric[] = []): AnalysisResult {
  const warnings: string[] = [];
  if (!products.length) warnings.push("没有识别到商品汇总行。请确认 Product Performance 报表包含 Item ID/商品编号。 ");
  if (!ads.length) warnings.push("未导入广告报表：ROAS/广告效率诊断将跳过。 ");
  if (!affiliate.length) warnings.push("未导入联盟报表：联盟贡献暂不参与排序。 ");

  const rows = mergeRows(products, ads, affiliate);
  const benchmarks = buildBenchmarks(rows);
  const diagnoses: Diagnosis[] = rows.map((row) => {
    const result = levelFor(row, benchmarks);
    return {
      itemId: row.itemId,
      productName: row.productName,
      severity: result.severity,
      primaryProblem: result.problem,
      confidence: row.impressions >= 1000 || row.visitors >= 100 ? 0.9 : row.impressions >= 300 || row.visitors >= 30 ? 0.75 : 0.55,
      opportunityScore: scoreOpportunity(row, benchmarks, result.severity),
      evidence: result.evidence,
      actions: result.actions,
      row,
    };
  });

  const severityRank: Record<Severity, number> = { P0: 0, P1: 1, SCALE: 2, P2: 3, WATCH: 4, DATA: 5 };
  diagnoses.sort((a, b) => severityRank[a.severity] - severityRank[b.severity] || b.opportunityScore - a.opportunityScore);

  const affiliateSummary = affiliate.reduce(
    (sum, row) => ({
      partners: sum.partners,
      clicks: sum.clicks + row.clicks,
      orders: sum.orders + row.orders,
      gmv: sum.gmv + row.gmv,
      commission: sum.commission + row.commission,
    }),
    { partners: new Set(affiliate.map((row) => row.partnerId)).size, clicks: 0, orders: 0, gmv: 0, commission: 0 },
  );

  return { products: rows, diagnoses, benchmarks, warnings, affiliateSummary };
}
