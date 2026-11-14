import type { CellValue, RawTable } from "@/lib/model/types";

/**
 * Connector contracts. The UI only talks to these interfaces, so the demo
 * implementations (local file parsing, mocked Google Sheets) can be swapped
 * for server-backed integrations without touching components.
 */

export interface ParsedImport {
  table: RawTable;
  warnings: string[];
  /** Rows discarded or padded during import (ragged rows, blank lines). */
  issues: { row: number; message: string }[];
}

export interface CsvParseOptions {
  delimiter: "auto" | "," | ";" | "\t" | "|";
  hasHeader: boolean | "auto";
}

export interface CsvParseResult extends ParsedImport {
  detectedDelimiter: "," | ";" | "\t" | "|";
  detectedHeader: boolean;
  hasHeader: boolean;
}

export interface FileConnector<Options, Result extends ParsedImport> {
  kind: "csv" | "excel";
  accept: string;
  maxBytes: number;
  parse(input: File | string | ArrayBuffer, options: Options): Promise<Result>;
}

export interface WorksheetInfo {
  name: string;
  rowCount: number;
  columnCount: number;
  /** First rows as a matrix, used for header/range configuration. */
  matrix: CellValue[][];
}

export interface WorkbookInspection {
  sheets: WorksheetInfo[];
}

export interface GoogleAccount {
  email: string;
  name: string;
}

export interface SpreadsheetSummary {
  id: string;
  name: string;
  modifiedAt: string;
  worksheets: { name: string; rowCount: number; columnCount: number }[];
}

export type GoogleConnectionState =
  | { status: "disconnected" }
  | { status: "connecting" }
  | { status: "connected"; account: GoogleAccount }
  | { status: "expired"; account: GoogleAccount };

export interface GoogleSheetsConnector {
  /** True when this is a mock implementation that never calls Google. */
  readonly isDemo: boolean;
  getConnection(): GoogleConnectionState;
  connect(): Promise<GoogleAccount>;
  disconnect(): Promise<void>;
  listSpreadsheets(): Promise<SpreadsheetSummary[]>;
  fetchRange(spreadsheetId: string, worksheet: string, range: string): Promise<ParsedImport>;
  /** Demo-only: simulate an expired OAuth grant to exercise reconnect flows. */
  simulateExpiry?(): void;
}

export class ConnectorError extends Error {
  constructor(
    public code: string,
    message: string,
    public detail?: string,
  ) {
    super(message);
  }
}
