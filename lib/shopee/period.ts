import type { ReportPeriod } from "./types";

function isoFromDmy(value: string): string | null {
  const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

export function parseShopeePeriod(value: unknown): ReportPeriod | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  const parts = raw.split(/\s*-\s*/);
  if (parts.length !== 2) return undefined;
  const start = isoFromDmy(parts[0]);
  const end = isoFromDmy(parts[1]);
  if (!start || !end) return undefined;
  return { raw, start, end };
}

export function periodsEqual(a?: ReportPeriod, b?: ReportPeriod): boolean {
  if (!a || !b) return false;
  return a.start === b.start && a.end === b.end;
}

export function formatPeriod(period?: ReportPeriod): string {
  return period ? `${period.start} → ${period.end}` : "Unknown";
}
