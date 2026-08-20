import type { Benchmarks, ProductRow, Quartiles } from "./types";
import { safeDivide } from "./number";

function quantile(values: number[], q: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * q;
  const base = Math.floor(position);
  const rest = position - base;
  const next = sorted[base + 1];
  return next === undefined ? sorted[base] : sorted[base] + rest * (next - sorted[base]);
}

function quartiles(values: number[]): Quartiles {
  const cleaned = values.filter((value) => Number.isFinite(value) && value >= 0);
  return {
    p25: quantile(cleaned, 0.25),
    median: quantile(cleaned, 0.5),
    p75: quantile(cleaned, 0.75),
  };
}

export function buildBenchmarks(products: ProductRow[]): Benchmarks {
  const eligible = products.filter((row) => row.impressions > 0 || row.visitors > 0);
  return {
    ctr: quartiles(eligible.map((row) => row.ctr)),
    addToCartRate: quartiles(eligible.map((row) => row.addToCartRate)),
    conversionRate: quartiles(eligible.map((row) => row.confirmedBuyerCr || row.placedBuyerCr)),
    roas: quartiles(eligible.filter((row) => (row.ad?.expense ?? 0) > 0).map((row) => row.ad?.roas ?? 0)),
    orderConfirmRate: quartiles(
      eligible.map((row) => safeDivide(row.confirmedOrders, row.placedOrders)).filter((value) => value > 0),
    ),
  };
}
