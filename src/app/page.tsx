import Link from "next/link";
import {
  ArrowRightIcon,
  BlendIcon,
  FileSpreadsheetIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  LinkIcon,
  MousePointerClickIcon,
  Share2Icon,
  Sheet as SheetIcon,
  WorkflowIcon,
  PlugIcon,
  PaletteIcon,
} from "lucide-react";
import { MarketingNav } from "@/components/marketing/marketing-nav";
import { Cross, Eyebrow, Section } from "@/components/marketing/grid-frame";
import { HeroPreview } from "@/components/marketing/hero-preview";
import { BuilderTabsPreview } from "@/components/marketing/builder-tabs-preview";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/brand/logo";

const SOURCES = [
  {
    icon: FileTextIcon,
    name: "CSV",
    detail: ".csv · .tsv",
    points: ["Delimiter and header detection", "Column type inference", "Import validation with row-level issues"],
  },
  {
    icon: FileSpreadsheetIcon,
    name: "Excel",
    detail: ".xlsx",
    points: ["Workbook inspection", "Worksheet selection", "Header row and A1 range"],
  },
  {
    icon: SheetIcon,
    name: "Google Sheets",
    detail: "OAuth · range",
    points: ["Pick spreadsheet and worksheet", "Manual, hourly or daily refresh", "Clear authorization states"],
  },
];

const STEPS = [
  { n: "01", icon: PlugIcon, title: "Connect", body: "Upload a CSV or Excel file, or pick a Google Sheet. DashNinja reads the structure and suggests column types." },
  { n: "02", icon: LayoutDashboardIcon, title: "Design", body: "Place KPI cards, charts, tables and filters on a grid. Bind each widget to a dataset, a dimension and a measure." },
  { n: "03", icon: Share2Icon, title: "Share", body: "Preview the dashboard exactly as viewers see it, with interactive filters that apply across widgets." },
];

const FEATURES = [
  {
    icon: WorkflowIcon,
    title: "Data transformations",
    body: "Rename, retype, filter, fill empty values, add calculated columns and group — as an ordered pipeline you can reorder or switch off.",
    code: "margin = revenue - cost",
  },
  {
    icon: LinkIcon,
    title: "Widget bindings",
    body: "Each widget states exactly what it shows. When a field disappears, DashNinja flags the widget instead of guessing a replacement.",
    code: "SUM(revenue) BY month(order_date)",
  },
  {
    icon: PaletteIcon,
    title: "Visual customization",
    body: "Number, currency, percent and date formats; backgrounds, borders, spacing and type size; a stable color for every category.",
    code: "format: currency · USD · 0dp",
  },
  {
    icon: MousePointerClickIcon,
    title: "Interactive reporting",
    body: "Dashboard filters for categories and date ranges, sortable tables, tooltips and a preview mode with every editing control hidden.",
    code: "filter: region ∈ {Europe, APAC}",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <MarketingNav />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid mask-fade-radial opacity-70" />
          <div className="relative mx-auto max-w-6xl border-x border-border px-4 pt-16 pb-12 sm:px-6 sm:pt-24 md:pb-16">
            <Cross className="-bottom-2 -left-2" />
            <Cross className="-bottom-2 -right-2" />
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted-foreground shadow-surface animate-fade-up">
                <span className="flex gap-1" aria-hidden>
                  <span className="size-1.5 rounded-full bg-chart-1" />
                  <span className="size-1.5 rounded-full bg-chart-2" />
                  <span className="size-1.5 rounded-full bg-chart-3" />
                </span>
                CSV · Excel · Google Sheets
              </div>
              <h1 className="text-balance text-[clamp(2.5rem,7vw,4.75rem)] font-semibold leading-[0.98] tracking-[-0.045em] animate-fade-up [animation-delay:60ms]">
                Your spreadsheets.
                <br />
                <span className="text-muted-foreground">A clearer picture.</span>
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-pretty text-base text-muted-foreground sm:text-lg animate-fade-up [animation-delay:120ms]">
                Connect spreadsheet data, prepare it with a few precise steps, and turn it into interactive dashboards your
                team can read at a glance.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-2.5 sm:flex-row animate-fade-up [animation-delay:180ms]">
                <Button asChild size="lg">
                  <Link href="/sign-up?next=%2Fworkspace">
                    Create your first dashboard <ArrowRightIcon />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link href="/sample">Explore a sample dashboard</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <Section innerClassName="px-3 py-10 sm:px-6 md:py-14" markers={false}>
          <div aria-hidden className="pointer-events-none absolute inset-0 bg-dots mask-fade-y opacity-80" />
          <div className="relative animate-fade-up [animation-delay:260ms]">
            <HeroPreview />
            <p className="mt-3 text-center font-mono text-[11px] text-muted-foreground">
              Live preview · synthetic sample data · try the filters
            </p>
          </div>
        </Section>

        {/* Sources */}
        <Section id="sources">
          <div className="grid md:grid-cols-[280px_1fr]">
            <div className="border-b border-border p-6 md:border-r md:border-b-0 md:p-8">
              <Eyebrow>Sources</Eyebrow>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">Start from the files you already have.</h2>
              <p className="mt-3 text-sm text-muted-foreground">Bring in one source or several. Each becomes a named dataset you can prepare and reuse.</p>
            </div>
            <div className="grid sm:grid-cols-3">
              {SOURCES.map((s, i) => (
                <div key={s.name} className={`p-6 md:p-8 ${i > 0 ? "border-t border-border sm:border-t-0 sm:border-l" : ""}`}>
                  <div className="flex items-center justify-between">
                    <s.icon className="size-5" aria-hidden />
                    <span className="font-mono text-[11px] text-muted-foreground">{s.detail}</span>
                  </div>
                  <h3 className="mt-6 font-medium">{s.name}</h3>
                  <ul className="mt-3 grid gap-1.5 text-sm text-muted-foreground">
                    {s.points.map((p) => (
                      <li key={p} className="flex gap-2">
                        <span className="mt-2 size-1 shrink-0 rounded-full bg-border-strong" aria-hidden />
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* How it works */}
        <Section id="how-it-works">
          <div className="p-6 md:p-8">
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-3 max-w-xl text-2xl font-semibold tracking-tight sm:text-3xl">Connect → Design → Share</h2>
          </div>
          <ol className="grid border-t border-border md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.n} className={`relative p-6 md:p-8 ${i > 0 ? "border-t border-border md:border-t-0 md:border-l" : ""}`}>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted-foreground">{s.n}</span>
                  <span className="h-px flex-1 bg-border" aria-hidden />
                  <s.icon className="size-4 text-muted-foreground" aria-hidden />
                </div>
                <h3 className="mt-6 text-lg font-medium tracking-tight">{s.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{s.body}</p>
              </li>
            ))}
          </ol>
        </Section>

        {/* Features */}
        <Section id="features">
          <div className="p-6 md:p-8">
            <Eyebrow>Features</Eyebrow>
            <h2 className="mt-3 max-w-2xl text-2xl font-semibold tracking-tight sm:text-3xl">
              Precise about data. Calm about design.
            </h2>
          </div>
          <div className="grid border-t border-border sm:grid-cols-2">
            {FEATURES.map((f, i) => (
              <div
                key={f.title}
                className={[
                  "group p-6 md:p-8",
                  i % 2 === 1 ? "sm:border-l border-border" : "",
                  i > 0 ? "border-t border-border" : "",
                  i === 1 ? "sm:border-t-0" : "",
                ].join(" ")}
              >
                <f.icon className="size-5" aria-hidden />
                <h3 className="mt-5 font-medium">{f.title}</h3>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">{f.body}</p>
                <code className="mt-5 inline-block rounded-md border border-border bg-muted px-2 py-1 font-mono text-xs text-foreground transition-colors duration-150 group-hover:border-border-strong">
                  {f.code}
                </code>
              </div>
            ))}
          </div>
        </Section>

        {/* Builder preview */}
        <Section id="builder">
          <div className="grid gap-8 p-6 md:p-8 lg:grid-cols-[300px_1fr] lg:gap-10">
            <div>
              <Eyebrow>The builder</Eyebrow>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">Two tabs. One draft.</h2>
              <p className="mt-3 text-sm text-muted-foreground">
                <strong className="font-medium text-foreground">Design</strong> decides how widgets look and which fields they use.{" "}
                <strong className="font-medium text-foreground">Data</strong> decides where a dataset comes from and how it is prepared.
                Switch freely — unsaved changes, bindings and layout travel with you.
              </p>
              <div className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
                <BlendIcon className="size-4" aria-hidden /> Illustration of the builder
              </div>
            </div>
            <BuilderTabsPreview />
          </div>
        </Section>

        {/* CTA */}
        <Section>
          <div className="relative overflow-hidden px-6 py-16 text-center md:py-24">
            <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid mask-fade-radial opacity-60" />
            <div className="relative">
              <h2 className="text-balance text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">Put a spreadsheet to work.</h2>
              <p className="mx-auto mt-3 max-w-md text-muted-foreground">Start with a blank canvas or the sample data. No setup required.</p>
              <div className="mt-8 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/sign-up?next=%2Fworkspace">
                    Create your first dashboard <ArrowRightIcon />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="ghost">
                  <Link href="/sample">Explore a sample dashboard</Link>
                </Button>
              </div>
            </div>
          </div>
        </Section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 border-x border-border px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center">
          <Wordmark />
          <p className="text-xs">A frontend preview. Sample data is synthetic.</p>
          <nav aria-label="Footer" className="flex gap-4 text-xs sm:ml-auto">
            <Link href="/#features" className="hover:text-foreground">Features</Link>
            <Link href="/#how-it-works" className="hover:text-foreground">How it works</Link>
            <Link href="/sign-in" className="hover:text-foreground">Sign in</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
