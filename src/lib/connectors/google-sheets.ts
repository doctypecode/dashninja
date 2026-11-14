import type { RawTable } from "@/lib/model/types";
import { getTargetsSample, getTicketsSample } from "@/lib/data/samples";
import { sleep } from "@/lib/utils";
import { columnLetter, parseRange } from "./excel";
import {
  ConnectorError,
  type GoogleAccount,
  type GoogleConnectionState,
  type GoogleSheetsConnector,
  type ParsedImport,
  type SpreadsheetSummary,
} from "./types";

/**
 * DEMO Google Sheets connector.
 *
 * No request is made to Google. Connecting simulates an OAuth grant for a demo
 * account and serves deterministic synthetic spreadsheets. To go live, implement
 * GoogleSheetsConnector with Google OAuth (scope spreadsheets.readonly) and the
 * Sheets API `spreadsheets.values.get`, ideally behind a server route that holds
 * refresh tokens, then swap it in at `getGoogleSheetsConnector()`.
 */

const STORAGE_KEY = "dashninja:google-demo";
const DEMO_ACCOUNT: GoogleAccount = { email: "demo.sheets@example.com", name: "Demo Google account" };

function tableToMatrix(t: RawTable) {
  return [t.columns.map((c) => c.name), ...t.rows.map((r) => t.columns.map((c) => r[c.name]))];
}

const SPREADSHEETS: (SpreadsheetSummary & { data: Record<string, () => RawTable> })[] = [
  {
    id: "demo-sheet-targets",
    name: "Regional revenue targets (demo)",
    modifiedAt: "2026-11-02T09:30:00Z",
    worksheets: [{ name: "Targets", rowCount: 89, columnCount: 4 }],
    data: { Targets: getTargetsSample },
  },
  {
    id: "demo-sheet-support",
    name: "Support tickets (demo)",
    modifiedAt: "2026-11-10T16:05:00Z",
    worksheets: [{ name: "Tickets", rowCount: 421, columnCount: 6 }],
    data: { Tickets: getTicketsSample },
  },
];

function read(): GoogleConnectionState {
  if (typeof window === "undefined") return { status: "disconnected" };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { status: "disconnected" };
    const parsed = JSON.parse(raw) as { expired?: boolean };
    return parsed.expired ? { status: "expired", account: DEMO_ACCOUNT } : { status: "connected", account: DEMO_ACCOUNT };
  } catch {
    return { status: "disconnected" };
  }
}

function write(value: { expired: boolean } | null) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("dashninja:google-demo"));
  } catch {
    /* storage unavailable: state stays in memory for this page */
  }
}

function requireConnected() {
  const s = read();
  if (s.status === "expired")
    throw new ConnectorError("auth_expired", "Google authorization expired", "Reconnect your Google account to keep refreshing this source.");
  if (s.status !== "connected") throw new ConnectorError("not_connected", "Google account not connected");
}

export const demoGoogleSheetsConnector: GoogleSheetsConnector = {
  isDemo: true,
  getConnection: read,
  async connect() {
    await sleep(900);
    write({ expired: false });
    return DEMO_ACCOUNT;
  },
  async disconnect() {
    await sleep(200);
    write(null);
  },
  async listSpreadsheets() {
    await sleep(500);
    requireConnected();
    return SPREADSHEETS.map(({ data: _data, ...s }) => s);
  },
  async fetchRange(spreadsheetId, worksheet, range) {
    await sleep(650);
    requireConnected();
    const sheet = SPREADSHEETS.find((s) => s.id === spreadsheetId);
    if (!sheet) throw new ConnectorError("not_found", "Spreadsheet not found", "It may have been deleted or unshared.");
    const get = sheet.data[worksheet];
    if (!get) throw new ConnectorError("not_found", `Worksheet “${worksheet}” not found`);
    const full = get();
    const matrix = tableToMatrix(full);
    const bounds = parseRange(range);
    const warnings: string[] = [];
    let columns = full.columns;
    let rows = full.rows;
    if (bounds) {
      const header = matrix[bounds.r0];
      if (!header) throw new ConnectorError("bad_range", "Range starts below the last row");
      const names = header.slice(bounds.c0, bounds.c1 + 1).map(String);
      columns = full.columns.filter((c) => names.includes(c.name));
      rows = full.rows.slice(bounds.r0, bounds.r1).map((r) => Object.fromEntries(columns.map((c) => [c.name, r[c.name]])));
      if (columns.length === 0) warnings.push("The selected range has no header cells; check that it starts on the header row.");
    }
    return { table: { columns, rows }, warnings, issues: [] } satisfies ParsedImport;
  },
  simulateExpiry() {
    if (read().status === "connected") write({ expired: true });
  },
};

export function getGoogleSheetsConnector(): GoogleSheetsConnector {
  return demoGoogleSheetsConnector;
}

export function fullRangeFor(rowCount: number, columnCount: number) {
  return `A1:${columnLetter(columnCount - 1)}${rowCount}`;
}
