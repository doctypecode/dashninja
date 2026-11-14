import type { DashboardSummary } from "@/lib/model/types";
import { GRID_COLUMNS } from "@/lib/model/types";

/** Schematic thumbnail drawn from the saved layout — always matches the real dashboard. */
export function DashboardThumbnail({ items }: { items: DashboardSummary["thumbnail"] }) {
  const rows = Math.max(12, ...items.map((i) => i.layout.y + i.layout.h));
  const W = 240;
  const cell = W / GRID_COLUMNS;
  const H = Math.min(rows, 26) * (cell * 0.62);
  const sy = (H / rows);
  if (items.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-dots">
        <span className="rounded-md border border-dashed border-border-strong bg-surface px-2 py-1 font-mono text-[10px] text-muted-foreground">
          empty canvas
        </span>
      </div>
    );
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="xMidYMin meet" aria-hidden>
      {items.map((it, i) => {
        const x = it.layout.x * cell + 2;
        const y = it.layout.y * sy + 2;
        const w = it.layout.w * cell - 4;
        const h = it.layout.h * sy - 4;
        if (it.type === "text") return <rect key={i} x={x} y={y + h / 2 - 3} width={Math.min(w * 0.6, 70)} height={5} rx={1.5} fill="var(--foreground)" opacity={0.7} />;
        return (
          <g key={i}>
            <rect x={x} y={y} width={w} height={h} rx={3} fill="var(--surface)" stroke="var(--border)" />
            {it.type === "kpi" ? (
              <rect x={x + 5} y={y + h / 2 - 3} width={w * 0.45} height={6} rx={1.5} fill="var(--foreground)" opacity={0.75} />
            ) : it.type === "line" ? (
              <polyline
                points={[0, 0.7, 0.2, 0.55, 0.4, 0.6, 0.6, 0.35, 0.8, 0.4, 1, 0.15]
                  .reduce<number[][]>((acc, v, idx, arr) => (idx % 2 === 0 ? [...acc, [arr[idx], arr[idx + 1]]] : acc), [])
                  .map(([px, py]) => `${x + 6 + px * (w - 12)},${y + 6 + py * (h - 12)}`)
                  .join(" ")}
                fill="none"
                stroke="var(--chart-1)"
                strokeWidth={1.5}
              />
            ) : it.type === "bar" ? (
              [0.8, 0.55, 0.4, 0.25].map((v, b) => {
                const bw = (w - 12) / 4 - 3;
                return <rect key={b} x={x + 6 + b * (bw + 3)} y={y + 6 + (h - 12) * (1 - v)} width={bw} height={(h - 12) * v} rx={1} fill="var(--chart-1)" opacity={0.85 - b * 0.12} />;
              })
            ) : it.type === "table" ? (
              [0, 1, 2, 3].map((r) => <rect key={r} x={x + 5} y={y + 6 + r * Math.max(4, (h - 12) / 5)} width={w - 10} height={2} fill="var(--border-strong)" />)
            ) : (
              <rect x={x + 4} y={y + h / 2 - 3} width={w - 8} height={6} rx={2} fill="var(--muted)" stroke="var(--border)" />
            )}
          </g>
        );
      })}
    </svg>
  );
}
