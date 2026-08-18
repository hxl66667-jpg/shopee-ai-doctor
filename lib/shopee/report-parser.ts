import * as XLSX from "xlsx";
import { AdMetric, AffiliateMetric, ProductMetric } from "./types";
import { num, rate, safeDivide } from "./number";

type Row = Record<string, unknown>;

function rowsFromSheet(sheet: XLSX.WorkSheet): Row[] {
  return XLSX.utils.sheet_to_json<Row>(sheet, { defval: "" });
}

export function parseProductPerformance(buffer: ArrayBuffer): ProductMetric[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const preferred = wb.SheetNames.includes("热销商品") ? "热销商品" : wb.SheetNames[0];
  const rows = rowsFromSheet(wb.Sheets[preferred]);

  return rows
    .filter((r) => String(r["商品编号"] ?? "").trim() !== "")
    // Product aggregate rows use '-' in Shopee's 规格编号 column. SKU rows must not be added again.
    .filter((r) => String(r["规格编号"] ?? "-").trim() === "-")
    .map((r) => {
      const placedOrders = num(r["已下订单"]);
      const confirmedOrders = num(r["已确定订单"]);
      const visitors = num(r["商品访客（访问）"]);
      const placedBuyers = num(r["买家数（已下单）"]);
      const confirmedBuyers = num(r["买家数（已确认订单）"]);
      const impressions = num(r["商品显示次数"]);
      const clicks = num(r["商品点击数"]);
      const addToCartVisitors = num(r["商品访客（添加至购物车）"]);

      return {
        itemId: String(r["商品编号"]).trim(),
        productName: String(r["商品"] ?? "").trim(),
        status: String(r["商品当前状态"] ?? "").trim(),
        impressions,
        clicks,
        ctr: rate(r["点击率"]) || safeDivide(clicks, impressions),
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
        placedBuyers,
        confirmedBuyers,
        placedBuyerCr: rate(r["转化率（已下单）"]) || safeDivide(placedBuyers, visitors),
        confirmedBuyerCr: rate(r["转化率（已确认订单）"]) || safeDivide(confirmedBuyers, visitors),
        placedSales: num(r["销售额（已下单） (PHP)"]),
        confirmedSales: num(r["销售额（已确认订单） (PHP)"]),
        orderConfirmRate: safeDivide(confirmedOrders, placedOrders)
      };
    });
}

export function parseAdsCsv(buffer: ArrayBuffer): AdMetric[] {
  const text = new TextDecoder("utf-8").decode(buffer);
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.startsWith("Sequence,Ad Name,"));
  if (headerIndex < 0) throw new Error("Unable to locate Shopee Ads header row.");

  const csv = lines.slice(headerIndex).join("\n");
  const wb = XLSX.read(csv, { type: "string" });
  const rows = rowsFromSheet(wb.Sheets[wb.SheetNames[0]]);

  return rows
    .filter((r) => String(r["Product ID"] ?? "").trim() !== "")
    .filter((r) => String(r["Product ID"] ?? "").trim() !== "-")
    .map((r) => ({
      itemId: String(r["Product ID"]).trim(),
      adName: String(r["Ad Name"] ?? "").trim(),
      impressions: num(r["Impression"]),
      clicks: num(r["Clicks"]),
      ctr: rate(r["CTR"]),
      addToCart: num(r["Add to Cart"]),
      addToCartRate: rate(r["Add to Cart Rate"]),
      conversions: num(r["Conversions"]),
      conversionRate: rate(r["Conversion Rate"]),
      gmv: num(r["GMV"]),
      expense: num(r["Expense"]),
      roas: num(r["ROAS"]),
      acos: rate(r["ACOS"])
    }));
}

export function parseAffiliateCsv(buffer: ArrayBuffer): AffiliateMetric[] {
  const text = new TextDecoder("utf-8").decode(buffer).replace(/^\uFEFF/, "");
  const wb = XLSX.read(text, { type: "string" });
  const rows = rowsFromSheet(wb.Sheets[wb.SheetNames[0]]);
  return rows
    .filter((r) => String(r["联盟伙伴编号"] ?? "").trim() !== "")
    .map((r) => ({
      partnerId: String(r["联盟伙伴编号"] ?? "").trim(),
      partnerName: String(r["联盟伙伴昵称"] ?? "").trim(),
      username: String(r["联盟伙伴用户名"] ?? "").trim(),
      gmv: num(r["总销售金额(₱)"]),
      orders: num(r["订单"]),
      clicks: num(r["Clicks"]),
      commission: num(r["预估佣金(₱)"]),
      roi: num(r["投资产出比"]),
      buyers: num(r["买家总数"]),
      newBuyers: num(r["新买家"])
    }));
}
