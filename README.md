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

## AI data assistant

The chat icon in the builder's right-hand rail opens a chat that reads the dashboard's datasets (column names, types and up to
15 sample rows each) and proposes transformation steps.

- **Models**: OpenAI, DeepSeek and Anthropic models through OpenRouter, plus "Auto" (`openrouter/auto`).
  The list is fetched live from OpenRouter's public catalog, with a built-in fallback.
- **Plan mode**: proposals show each step with a before/after preview (rows, added and removed columns, errors).
  Nothing changes until you press Apply.
- **Auto mode**: valid proposals are applied immediately as one undoable change.
- Proposals are validated in the browser by running them through the real pipeline. Invalid steps can't be applied,
  and changes that would break widget bindings are flagged.
- **Builds dashboards**: besides transformation steps, the assistant can add KPI cards, charts, tables, text and filters
  to Design, bound to existing datasets or to ones it creates in the same reply. Filters are wired to every widget whose
  dataset has the filter's field. Widgets that reference missing columns are skipped and listed, never guessed.
- **Daily spend limit**: every request records OpenRouter's reported cost (tokens in and out) in `.data/ai-usage.json`
  (gitignored). The chat shows a usage bar with % used, spent, remaining and when it resets (local midnight), plus a
  per-model breakdown. Requests are refused once the day's limit is reached. The default is \$1, set with
  `AI_DAILY_LIMIT_USD`. The check runs before each request, so the last request of a day can go slightly over.

Setup: copy `.env.example` to `.env.local` and set `OPENROUTER_API_KEY`, then restart the server. The key is only
read by the server route `src/app/api/ai/chat/route.ts`, which requires a signed-in session. Without a key, the panel
shows a "not configured" message.

[`docs/builder-guide.md`](docs/builder-guide.md) explains how the builder works (sources, datasets, steps, bindings).
The assistant receives it as its system context, so keep it in sync when steps or the model change.

## Demo adapters and what needs configuration

Everything runs in the browser today. Each integration sits behind one function so a real backend can be swapped in
without touching UI code.

| Integration | Current behavior | Swap point |
| --- | --- | --- |
| Authentication | Demo adapter: accounts and sessions in `localStorage`, plus a `dn_session` cookie for `proxy.ts`. Google sign-in, email verification and password reset are simulated; no email is sent. | `getAuthAdapter()` in `src/lib/auth/index.tsx` (implements `AuthAdapter` in `src/lib/auth/types.ts`) |
| Dashboard storage | Local repository: dashboards stored per user in `localStorage` with simulated latency. "Simulate save failure" in the Save menu exercises the failure and retry path. | `getRepository()` in `src/lib/api/repository.ts` |
| Google Sheets | Demo connector: no Google calls. Connect, sheet picking, token expiry and reconnect are simulated against sample spreadsheets. Needs a Google OAuth client and a server route to read sheets. | `getGoogleSheetsConnector()` in `src/lib/connectors/google-sheets.ts` |
| CSV / Excel | Real parsing in the browser (papaparse; exceljs loaded on demand). Delimiter, header row and type detection included. Large files would benefit from server-side parsing. | `src/lib/connectors/csv.ts`, `excel.ts` |
| AI assistant | Real OpenRouter calls when `OPENROUTER_API_KEY` is set in `.env.local`. | `src/app/api/ai/chat/route.ts` |
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
