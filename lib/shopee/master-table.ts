import { AdMetric, MasterProduct, ProductMetric } from "./types";
import { safeDivide } from "./number";

export function aggregateAds(rows: AdMetric[]): Map<string, AdMetric> {
  const grouped = new Map<string, AdMetric>();
  for (const row of rows) {
    const prev = grouped.get(row.itemId);
    if (!prev) {
      grouped.set(row.itemId, { ...row });
      continue;
    }
    const impressions = prev.impressions + row.impressions;
    const clicks = prev.clicks + row.clicks;
    const addToCart = prev.addToCart + row.addToCart;
    const conversions = prev.conversions + row.conversions;
    const gmv = prev.gmv + row.gmv;
    const expense = prev.expense + row.expense;
    grouped.set(row.itemId, {
      itemId: row.itemId,
      adName: "Multiple ads",
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
      acos: safeDivide(expense, gmv)
    });
  }
  return grouped;
}

export function buildMasterTable(products: ProductMetric[], ads: AdMetric[], shopUrl?: string): MasterProduct[] {
  const adMap = aggregateAds(ads);
  return products.map((p) => ({
    ...p,
    ad: adMap.get(p.itemId),
    productUrl: shopUrl ? `${shopUrl.replace(/#.*$/, "")}?item=${p.itemId}` : undefined
  }));
}
