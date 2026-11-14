import type { CellValue, ColumnType, DateFormat, DateGrain, ValueFormat } from "@/lib/model/types";

export const DEFAULT_FORMAT: ValueFormat = { kind: "number", decimals: 0, currency: "USD", percentScale: "fraction" };

export function formatValue(value: number | null | undefined, format: ValueFormat = DEFAULT_FORMAT): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const d = format.decimals;
  switch (format.kind) {
    case "currency":
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: format.currency || "USD",
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      }).format(value);
    case "percent":
      return new Intl.NumberFormat("en-US", {
        style: "percent",
        minimumFractionDigits: d,
        maximumFractionDigits: d,
      }).format(format.percentScale === "whole" ? value / 100 : value);
    case "compact":
      return new Intl.NumberFormat("en-US", {
        notation: "compact",
        maximumFractionDigits: Math.max(d, 1),
      }).format(value);
    default:
      return new Intl.NumberFormat("en-US", { minimumFractionDigits: d, maximumFractionDigits: d }).format(value);
  }
}

/** Short axis tick formatter that keeps currency symbols but compacts large numbers. */
export function formatAxis(value: number, format: ValueFormat = DEFAULT_FORMAT): string {
  if (format.kind === "percent") return formatValue(value, { ...format, decimals: 0 });
  const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(value);
  if (format.kind === "currency") {
    const symbol = new Intl.NumberFormat("en-US", { style: "currency", currency: format.currency || "USD" })
      .formatToParts(0)
      .find((p) => p.type === "currency")?.value;
    return `${symbol ?? ""}${compact}`;
  }
  return compact;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Format a bucket key produced by bucketDate(). */
export function formatBucket(key: string, grain: DateGrain, style: DateFormat["style"] = "auto"): string {
  if (style === "iso") return key;
  const [y, m, d] = key.split("-");
  const mi = Number(m) - 1;
  switch (grain) {
    case "year":
      return y;
    case "quarter":
      return `${key.slice(5)} ${style === "long" ? y : `’${y.slice(2)}`}`;
    case "month":
      return style === "long" ? `${MONTHS_LONG[mi]} ${y}` : `${MONTHS[mi]} ’${y.slice(2)}`;
    default:
      return style === "long" ? `${MONTHS_LONG[mi]} ${Number(d)}, ${y}` : `${MONTHS[mi]} ${Number(d)}`;
  }
}

export function formatDate(iso: string, style: DateFormat["style"] = "auto"): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso)) return iso;
  if (style === "iso") return iso.slice(0, 10);
  const [y, m, d] = iso.slice(0, 10).split("-");
  const mi = Number(m) - 1;
  return style === "long" ? `${MONTHS_LONG[mi]} ${Number(d)}, ${y}` : `${MONTHS[mi]} ${Number(d)}, ${y}`;
}

export function formatCell(v: CellValue, type: ColumnType, format?: ValueFormat, dateStyle?: DateFormat["style"]): string {
  if (v === null || v === undefined || v === "") return "";
  if (type === "number" && typeof v === "number") return format ? formatValue(v, format) : formatValue(v, { ...DEFAULT_FORMAT, decimals: Number.isInteger(v) ? 0 : 2 });
  if (type === "date" && typeof v === "string") return formatDate(v, dateStyle ?? "auto");
  if (type === "boolean") return v ? "true" : "false";
  return String(v);
}

export function relativeTime(iso: string | null, now = Date.now()): string {
  if (!iso) return "never";
  const diff = Math.round((now - new Date(iso).getTime()) / 1000);
  if (diff < 10) return "just now";
  if (diff < 60) return `${diff}s ago`;
  const m = Math.round(diff / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
