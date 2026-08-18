import type { Benchmarks, MasterProduct, Quartiles } from "./types";
import { safeDivide } from "./number";

function quartiles(values: number[]): Quartiles {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return { p25: 0, median: 0, p75: 0 };
  const q = (p: number) => {
    const pos = (sorted.length - 1) * p;
    const base = Math.floor(pos);
    const rest = pos - base;
    return sorted[base + 1] !== undefined ? sorted[base] + rest * (sorted[base + 1] - sorted[base]) : sorted[base];
  };
  return { p25: q(0.25), median: q(0.5), p75: q(0.75) };
}

export function calculateBenchmarks(products: MasterProduct[]): Benchmarks {
  const ctrCohort = products.filter((p) => p.impressions >= 1000);
  const engagementCohort = products.filter((p) => p.visitors >= 50);
  const conversionCohort = products.filter((p) => p.visitors >= 100);
  const confirmationCohort = products.filter((p) => p.placedOrders >= 5);
  const searchCohort = products.filter((p) => p.clicks >= 50);
  const adCtrCohort = products.filter((p) => (p.ad?.impressions ?? 0) >= 1000 && !!p.ad);
  const adCrCohort = products.filter((p) => (p.ad?.clicks ?? 0) >= 50 && !!p.ad);
  const adEfficiencyCohort = products.filter((p) => (p.ad?.expense ?? 0) >= 100 && !!p.ad);

  return {
    ctr: quartiles(ctrCohort.map((p) => p.ctr)),
    bounceRate: quartiles(engagementCohort.map((p) => p.bounceRate)),
    addToCartRate: quartiles(engagementCohort.map((p) => p.addToCartRate)),
    placedBuyerCr: quartiles(conversionCohort.map((p) => p.placedBuyerCr)),
    confirmedBuyerCr: quartiles(conversionCohort.map((p) => p.confirmedBuyerCr)),
    orderConfirmRate: quartiles(confirmationCohort.map((p) => p.orderConfirmRate)),
    searchClickShare: quartiles(searchCohort.map((p) => safeDivide(p.searchClicks, p.clicks))),
    adCtr: quartiles(adCtrCohort.map((p) => p.ad!.ctr)),
    adConversionRate: quartiles(adCrCohort.map((p) => p.ad!.conversionRate)),
    adRoas: quartiles(adEfficiencyCohort.map((p) => p.ad!.roas)),
    adAcos: quartiles(adEfficiencyCohort.map((p) => p.ad!.acos)),
    cohorts: {
      ctr: ctrCohort.length,
      engagement: engagementCohort.length,
      conversion: conversionCohort.length,
      confirmation: confirmationCohort.length,
      search: searchCohort.length,
      adCtr: adCtrCohort.length,
      adConversion: adCrCohort.length,
      adEfficiency: adEfficiencyCohort.length
    }
  };
}
