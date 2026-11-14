import type { RawTable, Row } from "@/lib/model/types";
import { createRandom } from "./random";

/**
 * Deterministic demo datasets. Every number shown in the sample dashboard,
 * the landing page preview and the Data tab is derived from these tables.
 * All data is synthetic and labelled as demo data in the UI.
 */

export const SAMPLE_REGIONS = ["North America", "Europe", "Asia Pacific", "Latin America"] as const;
export const SAMPLE_CHANNELS = ["Online", "Retail", "Partner"] as const;
export const SAMPLE_CATEGORIES = ["Hardware", "Software", "Services"] as const;

const PRODUCTS: Record<(typeof SAMPLE_CATEGORIES)[number], { name: string; price: number; margin: number }[]> = {
  Hardware: [
    { name: "Edge Sensor", price: 189, margin: 0.34 },
    { name: "Gateway Pro", price: 649, margin: 0.29 },
    { name: "Dock Station", price: 129, margin: 0.38 },
  ],
  Software: [
    { name: "Analytics Seat", price: 420, margin: 0.82 },
    { name: "Fleet License", price: 1180, margin: 0.78 },
  ],
  Services: [
    { name: "Onboarding", price: 1500, margin: 0.46 },
    { name: "Support Plan", price: 860, margin: 0.55 },
  ],
};

/** First day of each month in the sample range: Jan 2025 → Oct 2026 (22 months). */
export const SAMPLE_MONTHS: string[] = (() => {
  const months: string[] = [];
  for (let i = 0; i < 22; i++) {
    const year = 2025 + Math.floor(i / 12);
    const month = (i % 12) + 1;
    months.push(`${year}-${String(month).padStart(2, "0")}-01`);
  }
  return months;
})();

const REGION_WEIGHT: Record<string, number> = {
  "North America": 0.4,
  Europe: 0.3,
  "Asia Pacific": 0.2,
  "Latin America": 0.1,
};

let salesCache: RawTable | null = null;

export function getSalesSample(): RawTable {
  if (salesCache) return salesCache;
  const rand = createRandom(20250101);
  const rows: Row[] = [];
  let orderNo = 10001;
  SAMPLE_MONTHS.forEach((monthStart, mi) => {
    const [y, m] = monthStart.split("-").map(Number);
    const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
    // Growth trend + Q4 seasonality + a summer dip.
    const seasonal = [0.92, 0.9, 1.0, 1.0, 1.02, 0.96, 0.9, 0.93, 1.04, 1.08, 1.14, 1.22][m - 1];
    const orders = Math.round((48 + mi * 1.6) * seasonal);
    for (let i = 0; i < orders; i++) {
      const region = rand.weighted(SAMPLE_REGIONS.map((r) => [r, REGION_WEIGHT[r]] as const));
      const channel = rand.weighted([
        ["Online", 0.5 + mi * 0.006],
        ["Retail", 0.3 - mi * 0.004],
        ["Partner", 0.2],
      ] as const);
      const category = rand.weighted([
        ["Hardware", 0.45],
        ["Software", 0.35],
        ["Services", 0.2],
      ] as const);
      const product = rand.pick(PRODUCTS[category]);
      const units = category === "Services" ? rand.int(1, 3) : rand.int(1, 12);
      const discount = channel === "Partner" ? 0.12 : channel === "Retail" ? 0.04 : 0;
      const revenue = Math.round(units * product.price * (1 - discount) * (0.95 + rand.next() * 0.1) * 100) / 100;
      const cost = Math.round(revenue * (1 - product.margin) * (0.97 + rand.next() * 0.06) * 100) / 100;
      const day = rand.int(1, daysInMonth);
      rows.push({
        order_id: `SO-${orderNo++}`,
        order_date: `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        region,
        channel,
        category,
        product: product.name,
        units,
        revenue,
        cost,
      });
    }
  });
  rows.sort((a, b) => String(a.order_date).localeCompare(String(b.order_date)));
  salesCache = {
    columns: [
      { name: "order_id", type: "string" },
      { name: "order_date", type: "date" },
      { name: "region", type: "string" },
      { name: "channel", type: "string" },
      { name: "category", type: "string" },
      { name: "product", type: "string" },
      { name: "units", type: "number" },
      { name: "revenue", type: "number" },
      { name: "cost", type: "number" },
    ],
    rows,
  };
  return salesCache;
}

let targetsCache: RawTable | null = null;

/** Monthly revenue targets per region, derived from actuals so they are plausible. */
export function getTargetsSample(): RawTable {
  if (targetsCache) return targetsCache;
  const rand = createRandom(424242);
  const sales = getSalesSample();
  const totals = new Map<string, number>();
  for (const row of sales.rows) {
    const key = `${String(row.order_date).slice(0, 7)}|${row.region}`;
    totals.set(key, (totals.get(key) ?? 0) + Number(row.revenue));
  }
  const rows: Row[] = [];
  for (const month of SAMPLE_MONTHS) {
    for (const region of SAMPLE_REGIONS) {
      const actual = totals.get(`${month.slice(0, 7)}|${region}`) ?? 0;
      rows.push({
        month,
        region,
        target_revenue: Math.round((actual * (0.92 + rand.next() * 0.18)) / 100) * 100,
        owner: `${region.split(" ")[0]} team`,
      });
    }
  }
  targetsCache = {
    columns: [
      { name: "month", type: "date" },
      { name: "region", type: "string" },
      { name: "target_revenue", type: "number" },
      { name: "owner", type: "string" },
    ],
    rows,
  };
  return targetsCache;
}

let ticketsCache: RawTable | null = null;

export function getTicketsSample(): RawTable {
  if (ticketsCache) return ticketsCache;
  const rand = createRandom(777);
  const rows: Row[] = [];
  for (let i = 0; i < 420; i++) {
    const month = SAMPLE_MONTHS[Math.floor((i / 420) * SAMPLE_MONTHS.length)];
    const priority = rand.weighted([
      ["Low", 0.4],
      ["Medium", 0.38],
      ["High", 0.17],
      ["Urgent", 0.05],
    ] as const);
    const base = { Low: 30, Medium: 18, High: 8, Urgent: 3 }[priority];
    rows.push({
      ticket_id: `T-${5000 + i}`,
      opened_at: `${month.slice(0, 8)}${String(rand.int(1, 28)).padStart(2, "0")}`,
      priority,
      team: rand.pick(["Billing", "Integrations", "Platform", "Onboarding"] as const),
      resolution_hours: Math.round(base * (0.5 + rand.next()) * 10) / 10,
      // ~6% missing satisfaction scores to exercise empty-value handling.
      csat: rand.next() < 0.06 ? null : rand.int(2, 5),
    });
  }
  ticketsCache = {
    columns: [
      { name: "ticket_id", type: "string" },
      { name: "opened_at", type: "date" },
      { name: "priority", type: "string" },
      { name: "team", type: "string" },
      { name: "resolution_hours", type: "number" },
      { name: "csat", type: "number" },
    ],
    rows,
  };
  return ticketsCache;
}

/** CSV text of the sales sample, used by "Use sample file" so the real CSV parser runs. */
export function getSalesCsvText(limit = 400): string {
  const t = getSalesSample();
  const header = t.columns.map((c) => c.name).join(",");
  const lines = t.rows.slice(0, limit).map((r) =>
    t.columns
      .map((c) => {
        const v = r[c.name];
        const s = v === null ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      })
      .join(","),
  );
  return [header, ...lines].join("\n");
}
