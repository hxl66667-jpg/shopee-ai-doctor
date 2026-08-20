export function num(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const raw = String(value ?? "").trim();
  if (!raw || raw === "-" || raw === "--") return 0;
  const negative = /^\(.*\)$/.test(raw);
  const cleaned = raw.replace(/[₱$,%\s,()]/g, "");
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return 0;
  return negative ? -parsed : parsed;
}

export function rate(value: unknown): number {
  if (typeof value === "number") return value > 1 ? value / 100 : value;
  const raw = String(value ?? "").trim();
  if (!raw || raw === "-") return 0;
  const parsed = num(raw);
  return raw.includes("%") || parsed > 1 ? parsed / 100 : parsed;
}

export function safeDivide(numerator: number, denominator: number): number {
  return denominator > 0 ? numerator / denominator : 0;
}

export function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}
