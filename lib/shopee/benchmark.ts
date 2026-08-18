import { Benchmarks, MasterProduct, Quartiles } from "./types";

function quantile(values: number[], q: number): number {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  return sorted[base + 1] !== undefined
    ? sorted[base] + rest * (sorted[base + 1] - sorted[base])
    : sorted[base];
}

function quartiles(values: number[]): Quartiles {
  return { p25: quantile(values, 0.25), median: quantile(values, 0.5), p75: quantile(values, 0.75) };
}

export function calculateBenchmarks(products: MasterProduct[]): Benchmarks {
  // Samples are deliberately gated so tiny/new listings do not distort the store baseline.
  const traffic = products.filter((p) => p.impressions >= 1000 && p.clicks >= 20);
  const engagement = products.filter((p) => p.visitors >= 100);
  const conversion = products.filter((p) => p.visitors >= 100 && p.placedOrders >= 5);
  const confirmation = products.filter((p) => p.placedOrders >= 10);
  const adRows = products.filter((p) => p.ad && p.ad.impressions >= 1000 && p.ad.clicks >= 20);

  return {
    ctr: quartiles(traffic.map((p) => p.ctr)),
    bounceRate: quartiles(engagement.map((p) => p.bounceRate)),
    addToCartRate: quartiles(engagement.map((p) => p.addToCartRate)),
    placedBuyerCr: quartiles(conversion.map((p) => p.placedBuyerCr)),
    confirmedBuyerCr: quartiles(conversion.map((p) => p.confirmedBuyerCr)),
    orderConfirmRate: quartiles(confirmation.map((p) => p.orderConfirmRate)),
    adCtr: quartiles(adRows.map((p) => p.ad!.ctr)),
    adConversionRate: quartiles(adRows.map((p) => p.ad!.conversionRate)),
    adRoas: quartiles(adRows.map((p) => p.ad!.roas))
  };
}
