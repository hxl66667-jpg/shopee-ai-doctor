import * as XLSX from "xlsx";
import { num, rate, safeDivide } from "./number";
import { parseShopeePeriod } from "./period";
import type {
  AdMetric,
  AdsReport,
  AffiliateMetric,
  BusinessInsightsReport,
  OrderStageSummary,
  ProductPerformanceReport,
  ProductSourceMetric,
  SkuMetric,
  Stage,
  TrafficSourceMetric
} from "./types";

type Row = Record<string, unknown>;
type MatrixRow = unknown[];

function objectRows(sheet: XLSX.WorkSheet): Row[] {
  return XLSX.utils.sheet_to_json<Row>(sheet, { defval: "" });
}

function matrixRows(sheet: XLSX.WorkSheet): MatrixRow[] {
  return XLSX.utils.sheet_to_json<MatrixRow>(sheet, { header: 1, defval: "" });
}

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function cleanRaw(row: Row): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(row)) {
    if (value !== "") out[key] = value;
  }
  return out;
}

export function parseProductPerformance(buffer: ArrayBuffer): ProductPerformanceReport {
  const wb = XLSX.read(buffer, { type: "array" });
  const preferred = wb.SheetNames.includes("热销商品") ? "热销商品" : wb.SheetNames[0];
  if (!preferred) throw new Error("Product Performance workbook has no sheets.");
  const rows = objectRows(wb.Sheets[preferred]);

  const products = [] as ProductPerformanceReport["products"];
  const skus: SkuMetric[] = [];
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const r of rows) {
    const itemId = text(r["商品编号"]);
    if (!itemId) continue;
    const skuId = text(r["规格编号"] || "-");

    if (skuId === "-") {
      if (seen.has(itemId)) duplicates.add(itemId);
      seen.add(itemId);

      const impressions = num(r["商品显示次数"]);
      const clicks = num(r["商品点击数"]);
      const visitors = num(r["商品访客（访问）"]);
      const addToCartVisitors = num(r["商品访客（添加至购物车）"]);
      const placedOrders = num(r["已下订单"]);
      const confirmedOrders = num(r["已确定订单"]);
      const placedBuyers = num(r["买家数（已下单）"]);
      const confirmedBuyers = num(r["买家数（已确认订单）"]);

      products.push({
        itemId,
        productName: text(r["商品"]),
        status: text(r["商品当前状态"]),
        impressions,
        clicks,
        ctr: rate(r["点击率"]) || safeDivide(clicks, impressions),
        placedOrderCr: rate(r["订单转化率（已下订单）"]) || safeDivide(placedOrders, clicks),
        confirmedOrderCr: rate(r["订单转化率（已确认订单）"]) || safeDivide(confirmedOrders, clicks),
        uniqueImpressions: num(r["不重复的商品展示次数"]),
        uniqueClicks: num(r["不重复的商品点击数"]),
        visitors,
        pageVisitors: num(r["商品页面访客"]),
        bounceVisitors: num(r["跳出商品页面的访客数"]),
        bounceRate: rate(r["商品跳出率"]),
        searchClicks: num(r["搜索点击数"]),
        likes: num(r["赞"]),
        addToCartVisitors,
        addToCartItems: num(r["件数 (加入购物车）"]),
        addToCartRate: rate(r["转化率 (加入购物车率)"]) || safeDivide(addToCartVisitors, visitors),
        placedOrders,
        confirmedOrders,
        placedItems: num(r["件数（已下单）"]),
        confirmedItems: num(r["件数（已确认订单）"]),
        placedBuyers,
        confirmedBuyers,
        placedBuyerCr: rate(r["转化率（已下单）"]) || safeDivide(placedBuyers, visitors),
        confirmedBuyerCr: rate(r["转化率（已确认订单）"]) || safeDivide(confirmedBuyers, visitors),
        placedSales: num(r["销售额（已下单） (PHP)"]),
        confirmedSales: num(r["销售额（已确认订单） (PHP)"]),
        orderConfirmRate: safeDivide(confirmedOrders, placedOrders),
        repeatPlacedRate: rate(r["重复下单率（已下订单）"]),
        repeatConfirmedRate: rate(r["重复下单率（已确认订单）"]),
        repeatPlacedDays: num(r["重复下单平均天数（已下订单）"]),
        repeatConfirmedDays: num(r["重复下单的平均天数（已确认订单）"]),
        raw: cleanRaw(r)
      });
      continue;
    }

    skus.push({
      itemId,
      skuId,
      skuName: text(r["规格名称"]),
      skuStatus: text(r["规格当前状态"]),
      sellerSku: text(r["商品货号"]),
      parentSellerSku: text(r["主商品货号"]),
      placedOrders: num(r["已下订单"]),
      confirmedOrders: num(r["已确定订单"]),
      placedItems: num(r["件数（已下单）"]),
      confirmedItems: num(r["件数（已确认订单）"]),
      placedBuyers: num(r["买家数（已下单）"]),
      confirmedBuyers: num(r["买家数（已确认订单）"]),
      addToCartItems: num(r["件数 (加入购物车）"]),
      placedSales: num(r["销售额（已下单） (PHP)"]),
      confirmedSales: num(r["销售额（已确认订单） (PHP)"]),
      repeatPlacedRate: rate(r["重复下单率（已下订单）"]),
      repeatConfirmedRate: rate(r["重复下单率（已确认订单）"]),
      raw: cleanRaw(r)
    });
  }

  return { products, skus, duplicateProductIds: [...duplicates] };
}

function adFromRow(r: Row): AdMetric {
  const impressions = num(r["Impression"]);
  const clicks = num(r["Clicks"]);
  const conversions = num(r["Conversions"]);
  const expense = num(r["Expense"]);
  const gmv = num(r["GMV"]);
  return {
    itemId: text(r["Product ID"]),
    adName: text(r["Ad Name"]),
    status: text(r["Status"]),
    adsType: text(r["Ads Type"]),
    biddingMethod: text(r["Bidding Method"]),
    placement: text(r["Placement"]),
    impressions,
    clicks,
    ctr: rate(r["CTR"]) || safeDivide(clicks, impressions),
    addToCart: num(r["Add to Cart"]),
    addToCartRate: rate(r["Add to Cart Rate"]),
    conversions,
    directConversions: num(r["Direct Conversions"]),
    conversionRate: rate(r["Conversion Rate"]) || safeDivide(conversions, clicks),
    directConversionRate: rate(r["Direct Conversion Rate"]),
    itemsSold: num(r["Items Sold"]),
    directItemsSold: num(r["Direct Items Sold"]),
    gmv,
    directGmv: num(r["Direct GMV"]),
    expense,
    roas: num(r["ROAS"]) || safeDivide(gmv, expense),
    directRoas: num(r["Direct ROAS"]),
    acos: rate(r["ACOS"]) || safeDivide(expense, gmv),
    directAcos: rate(r["Direct ACOS"]),
    voucherAmount: num(r["Voucher Amount"]),
    voucheredSales: num(r["Vouchered Sales"]),
    raw: cleanRaw(r)
  };
}

export function parseAdsCsv(buffer: ArrayBuffer): AdsReport {
  const source = new TextDecoder("utf-8").decode(buffer).replace(/^\uFEFF/, "");
  const lines = source.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.startsWith("Sequence,Ad Name,"));
  if (headerIndex < 0) throw new Error("Unable to locate Shopee Ads header row.");

  const metadata = new Map<string, string>();
  for (const line of lines.slice(0, headerIndex)) {
    const comma = line.indexOf(",");
    if (comma <= 0) continue;
    metadata.set(line.slice(0, comma).trim(), line.slice(comma + 1).trim());
  }

  const csv = lines.slice(headerIndex).join("\n");
  const wb = XLSX.read(csv, { type: "string" });
  const rows = objectRows(wb.Sheets[wb.SheetNames[0]]);
  const parsed = rows.filter((r) => text(r["Ad Name"]) || text(r["Product ID"])).map(adFromRow);

  return {
    meta: {
      username: metadata.get("User Name"),
      shopName: metadata.get("Shop Name"),
      shopId: metadata.get("Shop ID"),
      createdAt: metadata.get("Report Creation Time"),
      period: parseShopeePeriod(metadata.get("Date Period"))
    },
    itemRows: parsed.filter((row) => row.itemId && row.itemId !== "-"),
    storeRows: parsed.filter((row) => !row.itemId || row.itemId === "-")
  };
}

export function parseAffiliateCsv(buffer: ArrayBuffer): AffiliateMetric[] {
  const csv = new TextDecoder("utf-8").decode(buffer).replace(/^\uFEFF/, "");
  const wb = XLSX.read(csv, { type: "string" });
  const rows = objectRows(wb.Sheets[wb.SheetNames[0]]);
  return rows
    .filter((r) => text(r["联盟伙伴编号"]))
    .map((r) => ({
      partnerId: text(r["联盟伙伴编号"]),
      partnerName: text(r["联盟伙伴昵称"]),
      username: text(r["联盟伙伴用户名"]),
      gmv: num(r["总销售金额(₱)"]),
      grossItems: num(r["总销售商品额"]),
      orders: num(r["订单"]),
      clicks: num(r["Clicks"]),
      commission: num(r["预估佣金(₱)"]),
      roi: num(r["投资产出比"]),
      buyers: num(r["买家总数"]),
      newBuyers: num(r["新买家"]),
      raw: cleanRaw(r)
    }));
}

function parseStageSummary(wb: XLSX.WorkBook, sheetName: string, stage: Stage): OrderStageSummary | undefined {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return undefined;
  const rows = matrixRows(sheet);
  if (rows.length < 2) return undefined;
  const header = rows[0].map(text);
  const values = rows[1];
  const get = (name: string) => values[header.indexOf(name)];
  return {
    stage,
    period: parseShopeePeriod(get("日期")),
    sales: num(get("销售额 (PHP)")),
    salesAfterRebate: num(get("Sales (Shopee Rebate applied)")),
    orders: num(get("订单数")),
    aov: num(get("每个订单的销售额")),
    productClicks: num(get("商品点击数")),
    visitors: num(get("访客数")),
    conversionRate: rate(get("订单转化率")),
    canceledOrders: num(get("已取消的订单")),
    canceledSales: num(get("已取消的销售")),
    refundOrders: num(get("已退货/退款的订单")),
    refundSales: num(get("已退货/退款的销售")),
    buyers: num(get("买家数")),
    newBuyers: num(get("新买家数")),
    existingBuyers: num(get("现有买家数量")),
    potentialBuyers: num(get("潜在买家数")),
    repeatPurchaseRate: rate(get("重复购买率"))
  };
}

function parseTrafficSourceSheet(wb: XLSX.WorkBook, sheetName: string, stage: Stage): TrafficSourceMetric[] {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  const rows = matrixRows(sheet);
  const results: TrafficSourceMetric[] = [];
  let section = "";
  let header: string[] | null = null;

  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    const first = text(row[0]);
    const second = text(row[1]);
    if (!first) {
      header = null;
      continue;
    }
    if (!second && first !== "流量来源") {
      section = first;
      header = null;
      continue;
    }
    if (first === "流量来源") {
      header = row.map(text);
      continue;
    }
    if (!header || !section) continue;

    const get = (name: string) => row[header!.indexOf(name)];
    results.push({
      stage,
      section,
      source: first,
      salesRate: rate(get("销售比率")),
      sales: num(get("销售 (PHP)")),
      impressions: num(get("商品展示次数")) || num(get("直播观看次数")) || num(get("视频观看次数")),
      clicks: num(get("商品点击数")),
      orders: num(get("订单数")),
      items: num(get("件数")),
      ctr: rate(get("点击率")),
      conversionRate: rate(get("订单转化率")),
      aov: num(get("每个订单的销售额")),
      buyers: num(get("买家数")),
      uniqueImpressions: num(get("不重复的商品展示次数")) || num(get("直播观看人数")) || num(get("不重复的视频观看次数")),
      uniqueClicks: num(get("不重复的商品点击数")),
      raw: Object.fromEntries(header.map((key, idx) => [key || `col_${idx}`, row[idx]]).filter(([, value]) => value !== ""))
    });
  }
  return results;
}

function parseProductSourceSheet(wb: XLSX.WorkBook, sheetName: string, stage: Stage): ProductSourceMetric[] {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return [];
  const rows = matrixRows(sheet);
  const results: ProductSourceMetric[] = [];
  let section = "";
  let header: string[] | null = null;

  for (let i = 3; i < rows.length; i++) {
    const row = rows[i];
    const first = text(row[0]);
    const second = text(row[1]);
    if (!first) {
      header = null;
      continue;
    }
    if (!second && first !== "商品编号") {
      section = first;
      header = null;
      continue;
    }
    if (first === "商品编号") {
      header = row.map(text);
      continue;
    }
    if (!header || !section || !/^\d+$/.test(first)) continue;

    const get = (name: string) => row[header!.indexOf(name)];
    results.push({
      stage,
      section,
      itemId: first,
      productName: text(get("商品")),
      status: text(get("商品当前状态")),
      salesRate: rate(get("销售比率")),
      sales: num(get("销售 (PHP)")),
      impressions: num(get("商品展示次数")),
      clicks: num(get("商品点击数")),
      orders: num(get("订单数")),
      items: num(get("件数")),
      ctr: rate(get("点击率")),
      conversionRate: rate(get("订单转化率")),
      aov: num(get("每个订单的销售额")),
      buyers: num(get("买家数")),
      uniqueImpressions: num(get("不重复的商品展示次数")),
      uniqueClicks: num(get("不重复的商品点击数")),
      raw: Object.fromEntries(header.map((key, idx) => [key || `col_${idx}`, row[idx]]).filter(([, value]) => value !== ""))
    });
  }
  return results;
}

export function parseBusinessInsights(buffer: ArrayBuffer): BusinessInsightsReport {
  const wb = XLSX.read(buffer, { type: "array" });
  const placed = parseStageSummary(wb, "已下订单", "placed");
  const confirmed = parseStageSummary(wb, "已确定订单", "confirmed");
  const paid = parseStageSummary(wb, "已付款订单", "paid");

  const trafficSources = [
    ...parseTrafficSourceSheet(wb, "流量来源（已下订单）", "placed"),
    ...parseTrafficSourceSheet(wb, "流量来源（已确认的订单）", "confirmed"),
    ...parseTrafficSourceSheet(wb, "流量来源（已付款的订单）", "paid")
  ];
  const productSources = [
    ...parseProductSourceSheet(wb, "商品分布（已下订单）", "placed"),
    ...parseProductSourceSheet(wb, "商品分布（已确认订单）", "confirmed"),
    ...parseProductSourceSheet(wb, "商品分布（已付款订单）", "paid")
  ];

  return {
    period: placed?.period || confirmed?.period || paid?.period,
    placed,
    confirmed,
    paid,
    trafficSources,
    productSources
  };
}
