export function num(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined || value === "" || value === "-") return 0;
  const cleaned = String(value).replace(/[₱,%\s,]/g, "").trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function rate(value: unknown): number {
  if (typeof value === "number") return value > 1 ? value / 100 : value;
  const text = String(value ?? "").trim();
  if (!text || text === "-") return 0;
  const n = num(text);
  return text.includes("%") || n > 1 ? n / 100 : n;
}

export function safeDivide(a: number, b: number): number {
  return b > 0 ? a / b : 0;
}
