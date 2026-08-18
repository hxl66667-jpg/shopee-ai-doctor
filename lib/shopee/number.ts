export function num(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined || value === "" || value === "-" || value === "--") return 0;
  const cleaned = String(value).replace(/[₱,%\s,]/g, "").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function rate(value: unknown): number {
  if (typeof value === "number") return value > 1 ? value / 100 : value;
  const text = String(value ?? "").trim();
  if (!text || text === "-" || text === "--") return 0;
  const n = num(text);
  return text.includes("%") || Math.abs(n) > 1 ? n / 100 : n;
}

export function safeDivide(a: number, b: number): number {
  return b > 0 ? a / b : 0;
}

export function money(value: number): string {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 }).format(value || 0);
}

export function pct(value: number): string {
  return `${((value || 0) * 100).toFixed(2)}%`;
}
