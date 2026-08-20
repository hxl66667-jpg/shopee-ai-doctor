import * as XLSX from "xlsx";
import type { AdMetric, AffiliateMetric, ProductMetric } from "./types";
import { num, rate, safeDivide } from "./number";

type Row = Record<string, unknown>;

function normalizeKey(value: string): string {
  return value.toLowerCase().replace(/[\s_（）()\-/%]/g, "");
}

function pick(row: Row, aliases: string[]): unknown {
  for (const alias of aliases) {
    if (row[alias] !== undefined && String(row[alias]).trim() !== "") return row[alias];
  }
  const normalized = new Map(Object.keys(row).map((key) => [normalizeKey(key), key]));
  for (const alias of aliases) {
    const hit = normalized.get(normalizeKey(alias));
    if (hit && row[hit] !== undefined && String(row[hit]).trim() !== "") return row[hit];
  }
  return "";
}

function sheetRows(sheet: XLSX.WorkSheet): Row[] {
  return XLSX.utils.sheet_to_json<Row>(sheet, { defval: "", raw: false });
}

function findBestSheet(workbook: XLSX.WorkBook, preferredNames: string[]): XLSX.WorkSheet {
  const exact = preferredNames.find((name) => workbook.SheetNames.includes(name));
  if (exact) return workbook.Sheets[exact];
  const fuzzy = workbook.SheetNames.find((name) => preferredNames.some((p) => name.includes(p)));
  return workbook.Sheets[fuzzy ?? workbook.SheetNames[0]];
}

function isAggregateProductRow(row: Row): boolean {
  const sku = String(pick(row, ["规格编号", "Variation ID", "Model ID", "SKU ID"])).trim();
  if (!sku) return true;
  return sku === "-" || sku.toLowerCase() === "all";
}

export async function parseProductPerformance(file: File): Promise<ProductMetric[]> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const rows = sheetRows(findBestSheet(workbook, ["热销商品", "商品表现", "Product Performance", "Top Products"]));

  return rows
    .filter((row) => String(pick(row, ["商品编号", "Item ID", "Product ID"])).trim() !== "")
    .filter(isAggregateProductRow)
    .map((row) => {
      const itemId = String(pick(row, ["商品编号", "Item ID", "Product ID"])).trim();
      const impressions = num(pick(row, ["商品显示次数", "Impressions", "Product Impressions"]));
      const clicks = num(pick(row, ["商品点击数", "Clicks", "Product Clicks"]));
      const visitors = num(pick(row, ["商品访客（访问）", "商品访客", "Visitors", "Product Visitors"]));
      const addToCartVisitors = num(
        pick(row, ["商品访客（添加至购物车）", "加购访客", "Add to Cart Visitors", "Add to Cart"]),
      );
      const placedOrders = num(pick(row, ["已下订单", "Placed Orders", "Orders"]));
      const confirmedOrders = num(pick(row, ["已确定订单", "Confirmed Orders", "Paid Orders"]));
      const placedBuyers = num(pick(row, ["买家数（已下单）", "Placed Buyers", "Buyers"]));
      const confirmedBuyers = num(pick(row, ["买家数（已确认订单）", "Confirmed Buyers", "Paid Buyers"]));

      return {
        itemId,
        productName: String(pick(row, ["商品", "商品名称", "Product", "Product Name", "Item Name"])).trim() || `Item ${itemId}`,
        status: String(pick(row, ["商品当前状态", "Status", "Product Status"])).trim(),
        impressions,
        clicks,
        ctr: rate(pick(row, ["点击率", "CTR"])) || safeDivide(clicks, impressions),
        visitors,
        addToCartVisitors,
        addToCartRate:
          rate(pick(row, ["转化率 (加入购物车率)", "加入购物车率", "Add to Cart Rate"])) ||
          safeDivide(addToCartVisitors, visitors),
        placedOrders,
        confirmedOrders,
        placedBuyerCr:
          rate(pick(row, ["转化率（已下单）", "Placed Conversion Rate", "Conversion Rate"])) ||
          safeDivide(placedBuyers || placedOrders, visitors),
        confirmedBuyerCr:
          rate(pick(row, ["转化率（已确认订单）", "Confirmed Conversion Rate", "Paid Conversion Rate"])) ||
          safeDivide(confirmedBuyers || confirmedOrders, visitors),
        placedSales: num(pick(row, ["销售额（已下单） (PHP)", "Placed Sales", "GMV"])),
        confirmedSales: num(pick(row, ["销售额（已确认订单） (PHP)", "Confirmed Sales", "Paid GMV"])),
        rating: num(pick(row, ["评分", "Rating", "Product Rating"])) || undefined,
      };
    })
    .filter((row) => row.itemId.length > 0);
}

function rowsFromCsvText(text: string): Row[] {
  const workbook = XLSX.read(text.replace(/^\uFEFF/, ""), { type: "string" });
  return sheetRows(workbook.Sheets[workbook.SheetNames[0]]);
}

export async function parseAds(file: File): Promise<AdMetric[]> {
  const text = new TextDecoder("utf-8").decode(await file.arrayBuffer()).replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => /product id/i.test(line) && /ad name/i.test(line));
  const rows = rowsFromCsvText(headerIndex >= 0 ? lines.slice(headerIndex).join("\n") : text);

  return rows
    .filter((row) => {
      const id = String(pick(row, ["Product ID", "Item ID", "商品编号"])).trim();
      return Boolean(id && id !== "-");
    })
    .map((row) => {
      const impressions = num(pick(row, ["Impression", "Impressions", "曝光"]));
      const clicks = num(pick(row, ["Clicks", "点击"]));
      const addToCart = num(pick(row, ["Add to Cart", "加购"]));
      const conversions = num(pick(row, ["Conversions", "Orders", "订单"]));
      const gmv = num(pick(row, ["GMV", "Sales", "销售额"]));
      const expense = num(pick(row, ["Expense", "Spend", "广告花费"]));
      return {
        itemId: String(pick(row, ["Product ID", "Item ID", "商品编号"])).trim(),
        adName: String(pick(row, ["Ad Name", "广告名称"])).trim(),
        impressions,
        clicks,
        ctr: rate(pick(row, ["CTR"])) || safeDivide(clicks, impressions),
        addToCart,
        addToCartRate: rate(pick(row, ["Add to Cart Rate"])) || safeDivide(addToCart, clicks),
        conversions,
        conversionRate: rate(pick(row, ["Conversion Rate"])) || safeDivide(conversions, clicks),
        gmv,
        expense,
        roas: num(pick(row, ["ROAS"])) || safeDivide(gmv, expense),
        acos: rate(pick(row, ["ACOS"])) || safeDivide(expense, gmv),
      };
    });
}

export async function parseAffiliate(file: File): Promise<AffiliateMetric[]> {
  const text = new TextDecoder("utf-8").decode(await file.arrayBuffer()).replace(/^\uFEFF/, "");
  const rows = rowsFromCsvText(text);
  return rows
    .filter((row) => String(pick(row, ["联盟伙伴编号", "Partner ID", "Affiliate ID"])).trim() !== "")
    .map((row) => ({
      itemId: String(pick(row, ["商品编号", "Product ID", "Item ID"])).trim() || undefined,
      partnerId: String(pick(row, ["联盟伙伴编号", "Partner ID", "Affiliate ID"])).trim(),
      partnerName: String(pick(row, ["联盟伙伴昵称", "Partner Name", "Username"])).trim(),
      clicks: num(pick(row, ["Clicks", "点击"])),
      orders: num(pick(row, ["订单", "Orders"])),
      gmv: num(pick(row, ["总销售金额(₱)", "GMV", "Sales"])),
      commission: num(pick(row, ["预估佣金(₱)", "Commission"])),
      roi: num(pick(row, ["投资产出比", "ROI"])),
    }));
}
