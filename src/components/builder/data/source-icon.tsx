import { DatabaseIcon, FileSpreadsheetIcon, FileTextIcon, Sheet as SheetIcon } from "lucide-react";
import type { SourceKind } from "@/lib/model/types";

export function SourceIcon({ kind, className }: { kind: SourceKind; className?: string }) {
  const Icon = kind === "csv" ? FileTextIcon : kind === "excel" ? FileSpreadsheetIcon : kind === "google-sheets" ? SheetIcon : DatabaseIcon;
  return <Icon className={className} aria-hidden />;
}
