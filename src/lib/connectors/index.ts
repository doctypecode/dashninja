import type { Dashboard, DataSource, RawTable } from "@/lib/model/types";
import { getSalesSample, getTargetsSample } from "@/lib/data/samples";

export { csvConnector } from "./csv";
export { inspectWorkbook, extractTable, buildSampleWorkbook } from "./excel";
export { getGoogleSheetsConnector } from "./google-sheets";
export * from "./types";

const EMPTY: RawTable = { columns: [], rows: [] };

/** Synchronously resolve the latest imported table for a source. */
export function getSourceTable(dashboard: Pick<Dashboard, "sourceData">, source: DataSource): RawTable {
  if (source.config.kind === "sample") {
    return source.config.sampleId === "targets" ? getTargetsSample() : getSalesSample();
  }
  return dashboard.sourceData[source.id] ?? EMPTY;
}

export const SOURCE_KIND_LABELS: Record<DataSource["kind"], string> = {
  csv: "CSV",
  excel: "Excel",
  "google-sheets": "Google Sheets",
  sample: "Sample",
};
