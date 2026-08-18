import { periodsEqual } from "./period";
import type { AdsReport, BusinessInsightsReport, DataWarning, MasterProduct, ProductPerformanceReport } from "./types";

export function buildDataWarnings(input: {
  productReport: ProductPerformanceReport;
  ads?: AdsReport;
  business?: BusinessInsightsReport;
  master: MasterProduct[];
}): DataWarning[] {
  const warnings: DataWarning[] = [];

  if (input.productReport.duplicateProductIds.length) {
    warnings.push({
      code: "DUPLICATE_PRODUCT_ROWS",
      level: "error",
      message: `Product Performance contains duplicate product-level Item IDs: ${input.productReport.duplicateProductIds.slice(0, 8).join(", ")}`
    });
  }

  if (input.ads?.meta.period && input.business?.period && !periodsEqual(input.ads.meta.period, input.business.period)) {
    warnings.push({
      code: "PERIOD_MISMATCH",
      level: "warning",
      message: `Business Insights (${input.business.period.start}–${input.business.period.end}) and Ads (${input.ads.meta.period.start}–${input.ads.meta.period.end}) use different periods. Cross-channel comparisons are directional only.`
    });
  }

  if (input.ads?.storeRows.length) {
    const spend = input.ads.storeRows.reduce((sum, row) => sum + row.expense, 0);
    warnings.push({
      code: "STORE_LEVEL_ADS",
      level: "info",
      message: `${input.ads.storeRows.length} Ads rows use Product ID "-" (₱${spend.toFixed(0)} spend). They are kept at store/campaign level and are never assigned to individual listings.`
    });
  }

  const anomalies = input.master.filter((p) => {
    const productRates = [p.ctr, p.bounceRate, p.addToCartRate, p.placedBuyerCr, p.confirmedBuyerCr, p.orderConfirmRate];
    const adRates = p.ad ? [p.ad.ctr, p.ad.conversionRate, p.ad.acos] : [];
    return [...productRates, ...adRates].some((v) => !Number.isFinite(v) || v < 0 || v > 1.000001);
  });
  if (anomalies.length) {
    warnings.push({
      code: "RATE_OUTLIERS",
      level: "warning",
      message: `${anomalies.length} listing(s) contain rate values outside 0–100%. They will be classified as DATA until the export is verified.`
    });
  }

  const adIds = new Set(input.ads?.itemRows.map((r) => r.itemId) ?? []);
  const productIds = new Set(input.master.map((p) => p.itemId));
  const unmatched = [...adIds].filter((id) => !productIds.has(id));
  if (unmatched.length) {
    warnings.push({
      code: "UNMATCHED_AD_PRODUCTS",
      level: "warning",
      message: `${unmatched.length} product-specific Ads Item ID(s) are not present in Product Performance.`
    });
  }

  return warnings;
}
