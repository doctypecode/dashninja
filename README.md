# DashNinja

Turn CSV files, Excel workbooks and Google Sheets into interactive dashboards.

Built with Next.js (App Router), TypeScript, Tailwind CSS v4, shadcn/ui-style components on Radix,
Recharts with shadcn/ui Charts, TanStack Query and TanStack Table.

## Getting started

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm lint
pnpm typecheck
pnpm build && pnpm start
```

Sign in with the demo account **demo@example.com / dashninja**, or create a new account (any email works;
the verification step is simulated). "Explore a sample dashboard" on the landing page works without signing in.

## What's in the app

| Area | Route | Notes |
| --- | --- | --- |
| Landing | `/` | Hero preview and feature sections render real widgets from the deterministic sample data. |
| Sample viewer | `/sample` | Read-only sample dashboard, no account needed. |
| Auth | `/sign-in`, `/sign-up`, `/verify-email`, `/forgot-password`, `/reset-password` | Inline validation, password toggle, Google button, loading and error states. |
| Workspace | `/workspace` | Dashboard cards (thumbnail, status, sources, last edited), rename, duplicate, delete, empty state. |
| Builder | `/dashboards/[id]?tab=design\|data` | Design and Data tabs share one draft; undo/redo, save states, preview mode. |

Protected routes (`/workspace`, `/dashboards/*`) are guarded by `src/proxy.ts` (cookie check) plus a client
`RequireAuth` gate. Unauthenticated visits redirect to `/sign-in?next=…` and return to the original page.

### Builder shortcuts

`⌘/Ctrl+S` save · `⌘/Ctrl+Z` undo · `⇧⌘/Ctrl+Shift+Z` redo · `Alt+1` / `Alt+2` switch tabs ·
arrow keys move the selected widget (Shift+arrows resize) · `⌘/Ctrl+D` duplicate · `Delete` remove · `Esc` deselect / exit preview.

## Demo adapters and what needs configuration

Everything runs in the browser today. Each integration sits behind one function so a real backend can be swapped in
without touching UI code.

| Integration | Current behavior | Swap point |
| --- | --- | --- |
| Authentication | Demo adapter: accounts and sessions in `localStorage`, plus a `dn_session` cookie for `proxy.ts`. Google sign-in, email verification and password reset are simulated; no email is sent. | `getAuthAdapter()` in `src/lib/auth/index.tsx` (implements `AuthAdapter` in `src/lib/auth/types.ts`) |
| Dashboard storage | Local repository: dashboards stored per user in `localStorage` with simulated latency. "Simulate save failure" in the Save menu exercises the failure and retry path. | `getRepository()` in `src/lib/api/repository.ts` |
| Google Sheets | Demo connector: no Google calls. Connect, sheet picking, token expiry and reconnect are simulated against sample spreadsheets. Needs a Google OAuth client and a server route to read sheets. | `getGoogleSheetsConnector()` in `src/lib/connectors/google-sheets.ts` |
| CSV / Excel | Real parsing in the browser (papaparse; exceljs loaded on demand). Delimiter, header row and type detection included. Large files would benefit from server-side parsing. | `src/lib/connectors/csv.ts`, `excel.ts` |
| Scheduled refresh | Not implemented; refresh is manual. Needs a server job. | n/a |

## Code layout

```
src/app                 routes (landing, auth, workspace, builder, sample)
src/components/ui       shadcn/ui-style primitives, including chart.tsx (ChartContainer etc.)
src/components/widgets  KPI, chart, table, text and filter widgets + dashboard runtime
src/components/builder  builder shell, design/ (canvas, palette, inspector), data/ (sources, pipeline, preview)
src/lib/model           typed, serializable dashboard model, defaults, sample dashboard
src/lib/data            deterministic sample data, schema inference, transforms, queries, binding validation
src/lib/connectors      CSV, Excel and Google Sheets connectors
src/lib/builder         builder store (undo/redo, dirty tracking) and data actions
```

Sample data is generated from a fixed seed, so every run shows the same numbers.
