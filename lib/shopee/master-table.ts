import { safeDivide } from "./number";
import type { AdMetric, MasterProduct, ProductMetric } from "./types";

function mergeAdRows(rows: AdMetric[]): AdMetric {
  const names = [...new Set(rows.map((r) => r.adName).filter(Boolean))];
  const total = rows.reduce(
    (acc, r) => {
      acc.impressions += r.impressions;
      acc.clicks += r.clicks;
      acc.addToCart += r.addToCart;
      acc.conversions += r.conversions;
      acc.directConversions += r.directConversions;
      acc.itemsSold += r.itemsSold;
      acc.directItemsSold += r.directItemsSold;
      acc.gmv += r.gmv;
      acc.directGmv += r.directGmv;
      acc.expense += r.expense;
      acc.voucherAmount += r.voucherAmount;
      acc.voucheredSales += r.voucheredSales;
      return acc;
    },
    {
      impressions: 0,
      clicks: 0,
      addToCart: 0,
      conversions: 0,
      directConversions: 0,
      itemsSold: 0,
      directItemsSold: 0,
      gmv: 0,
      directGmv: 0,
      expense: 0,
      voucherAmount: 0,
      voucheredSales: 0
    }
  );

  return {
    itemId: rows[0]?.itemId ?? "",
    adName: names.join(" | "),
    status: rows.some((r) => r.status === "Ongoing") ? "Ongoing" : rows[0]?.status,
    adsType: [...new Set(rows.map((r) => r.adsType).filter(Boolean))].join(" | "),
    biddingMethod: [...new Set(rows.map((r) => r.biddingMethod).filter(Boolean))].join(" | "),
    placement: [...new Set(rows.map((r) => r.placement).filter(Boolean))].join(" | "),
    impressions: total.impressions,
    clicks: total.clicks,
    ctr: safeDivide(total.clicks, total.impressions),
    addToCart: total.addToCart,
    addToCartRate: safeDivide(total.addToCart, total.clicks),
    conversions: total.conversions,
    directConversions: total.directConversions,
    conversionRate: safeDivide(total.conversions, total.clicks),
    directConversionRate: safeDivide(total.directConversions, total.clicks),
    itemsSold: total.itemsSold,
    directItemsSold: total.directItemsSold,
    gmv: total.gmv,
    directGmv: total.directGmv,
    expense: total.expense,
    roas: safeDivide(total.gmv, total.expense),
    directRoas: safeDivide(total.directGmv, total.expense),
    acos: safeDivide(total.expense, total.gmv),
    directAcos: safeDivide(total.expense, total.directGmv),
    voucherAmount: total.voucherAmount,
    voucheredSales: total.voucheredSales,
    raw: { aggregatedRows: rows.length, adNames: names }
  };
}

export function aggregateAds(rows: AdMetric[]): Map<string, AdMetric> {
  const grouped = new Map<string, AdMetric[]>();
  for (const row of rows) {
    const bucket = grouped.get(row.itemId) ?? [];
    bucket.push(row);
    grouped.set(row.itemId, bucket);
  }
  return new Map([...grouped.entries()].map(([id, bucket]) => [id, mergeAdRows(bucket)]));
}

function itemUrl(shopId: string | undefined, itemId: string): string | undefined {
  return shopId ? `https://shopee.ph/product/${shopId}/${itemId}` : undefined;
}

export function buildMasterTable(products: ProductMetric[], ads: AdMetric[], shopId?: string): MasterProduct[] {
  const adMap = aggregateAds(ads);
  return products.map((product) => ({
    ...product,
    ad: adMap.get(product.itemId),
    productUrl: itemUrl(shopId, product.itemId)
  }));
}
