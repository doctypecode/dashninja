"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { UsageSummary } from "@/lib/ai/usage-types";
import { UsageMeter, USAGE_QUERY_KEY, useAiUsage, usd, tokens } from "./usage-meter";
import { toast } from "sonner";
import {
  AlertTriangleIcon,
  ArrowUpIcon,
  CheckIcon,
  DatabaseIcon,
  Loader2Icon,
  RotateCcwIcon,
  SparklesIcon,
  Trash2Icon,
  XIcon,
  LayoutTemplateIcon,
} from "lucide-react";
import type { Dashboard } from "@/lib/model/types";
import { useBuilder, isDataBound } from "@/lib/builder/store";
import { describeStep, STEP_LABELS } from "@/lib/data/transform";
import { planActions, type ActionPlan, type DatasetSummary, type WidgetSummary } from "@/lib/ai/plan";
import { WIDGET_LABELS } from "@/lib/model/defaults";
import { DEFAULT_MODEL_ID, FALLBACK_MODELS, PROVIDER_LABELS, type AiModel, type AiProvider } from "@/lib/ai/models";
import {
  buildContext,
  parseReply,
  type AiAction,
  type AiChatMessage,
  type AiChatResponse,
  type AiMode,
} from "@/lib/ai/protocol";
import { cn, uid } from "@/lib/utils";
import { WIDGET_ICONS } from "@/components/builder/design/widget-palette";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Segmented } from "@/components/builder/design/inspector-fields";
import { STEP_ICONS } from "@/components/builder/data/pipeline";

// ---------- Chat state ----------

type ProposalState = "pending" | "applied" | "discarded";

export interface ChatItem {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  model?: string;
  cost?: AiChatResponse["cost"];
  actions?: AiAction[];
  parseError?: string | null;
  proposal?: ProposalState;
  appliedNote?: string;
}

function summarizeStats(s: ActionPlan["stats"], skipped: number) {
  const parts = [
    s.datasets ? `${s.datasets} dataset${s.datasets === 1 ? "" : "s"}` : "",
    s.steps ? `${s.steps} step${s.steps === 1 ? "" : "s"}` : "",
    s.widgets ? `${s.widgets} widget${s.widgets === 1 ? "" : "s"}` : "",
  ].filter(Boolean);
  return `Added ${parts.join(", ")}${skipped ? ` · ${skipped} item${skipped === 1 ? "" : "s"} skipped` : ""}`;
}

const PREF_KEY = "dn:ai-prefs";

function readPrefs(): { model: string; mode: AiMode } {
  try {
    const v = JSON.parse(window.localStorage.getItem(PREF_KEY) ?? "{}") as Partial<{ model: string; mode: AiMode }>;
    return { model: v.model ?? DEFAULT_MODEL_ID, mode: v.mode === "auto" ? "auto" : "plan" };
  } catch {
    return { model: DEFAULT_MODEL_ID, mode: "plan" };
  }
}

const SUGGESTIONS = [
  "Create a sales dashboard with revenue, profit, monthly trends, regional performance and filters",
  "Add a margin column (revenue minus cost)",
  "Make a new dataset with total revenue by region",
  "Only keep orders from 2026",
  "Which columns have empty values?",
];

export function AiPanel({
  onClose,
  focusDatasetId,
  items,
  setItems,
  onWidgetsAdded,
}: {
  onClose: () => void;
  focusDatasetId?: string | null;
  /** Owned by the builder so the conversation survives closing the panel or switching tabs. */
  items: ChatItem[];
  setItems: React.Dispatch<React.SetStateAction<ChatItem[]>>;
  /** Called after widgets are added, e.g. to switch to the Design tab. */
  onWidgetsAdded?: () => void;
}) {
  const b = useBuilder();
  const [input, setInput] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [prefs, setPrefs] = React.useState<{ model: string; mode: AiMode }>({ model: DEFAULT_MODEL_ID, mode: "plan" });
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    setPrefs(readPrefs());
    inputRef.current?.focus();
  }, []);
  const savePrefs = (next: { model: string; mode: AiMode }) => {
    setPrefs(next);
    try {
      window.localStorage.setItem(PREF_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const qc = useQueryClient();
  const usage = useAiUsage();
  const limitReached = Boolean(usage.data && usage.data.remainingUsd <= 0);
  const models = useQuery({
    queryKey: ["ai-models"],
    queryFn: async () => {
      const res = await fetch("/api/ai/models");
      if (!res.ok) throw new Error("models");
      return (await res.json()) as { models: AiModel[]; live: boolean };
    },
    staleTime: 60 * 60 * 1000,
  });
  const modelList = models.data?.models ?? FALLBACK_MODELS;
  const grouped = React.useMemo(() => {
    const g = new Map<AiProvider, AiModel[]>();
    for (const m of modelList) g.set(m.provider, [...(g.get(m.provider) ?? []), m]);
    // Keep a saved model selectable even if it fell out of the live list.
    if (!modelList.some((m) => m.id === prefs.model)) {
      const p = (prefs.model.split("/")[0] as AiProvider) ?? "auto";
      g.set(p, [...(g.get(p) ?? []), { id: prefs.model, name: prefs.model, provider: p }]);
    }
    return g;
  }, [modelList, prefs.model]);

  // Which dataset the user is looking at: the Data tab's, else the selected widget's, else the first.
  const selectedDatasetId =
    focusDatasetId ?? (b.selected && isDataBound(b.selected) ? b.selected.binding.datasetId : null) ?? b.draft.datasets[0]?.id ?? null;
  const focusName = b.draft.datasets.find((d) => d.id === selectedDatasetId)?.name;

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [items, pending]);

  const apply = React.useCallback(
    (item: ChatItem, opts: { auto?: boolean } = {}) => {
      const plan = planActions(b.draft, item.actions ?? []);
      const { steps, datasets, widgets } = plan.stats;
      if (!steps && !datasets && !widgets) {
        if (!opts.auto) toast.error("Nothing in this proposal can be applied", { description: plan.items.flatMap((i) => i.errors)[0] });
        return false;
      }
      // One history entry, so a single Undo reverts the whole proposal.
      b.update(() => plan.next);
      const skipped = plan.items.filter((i) => i.errors.length).length;
      setItems((list) => list.map((x) => (x.id === item.id ? { ...x, proposal: "applied", appliedNote: summarizeStats(plan.stats, skipped) } : x)));
      toast.success(opts.auto ? "Applied automatically" : "Applied", {
        description: summarizeStats(plan.stats, skipped),
        action: { label: "Undo", onClick: () => b.undo() },
      });
      if (widgets && onWidgetsAdded) onWidgetsAdded();
      return true;
    },
    [b, setItems, onWidgetsAdded],
  );

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || pending) return;
    const userItem: ChatItem = { id: uid("m"), role: "user", content };
    const history = [...items, userItem];
    setItems(history);
    setInput("");
    setPending(true);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const messages: AiChatMessage[] = history
        .filter((m) => m.role !== "error")
        .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: prefs.model, mode: prefs.mode, messages, context: buildContext(b.draft, selectedDatasetId) }),
        signal: controller.signal,
      });
      const json = (await res.json().catch(() => ({}))) as Partial<AiChatResponse> & { error?: string; usage?: UsageSummary };
      if (json.usage) qc.setQueryData(USAGE_QUERY_KEY, json.usage);
      if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
      const parsed = parseReply(json.content ?? "");
      const reply: ChatItem = {
        id: uid("m"),
        role: "assistant",
        content: json.content ?? "",
        model: json.model,
        cost: json.cost,
        actions: parsed.actions,
        parseError: parsed.parseError,
        proposal: parsed.actions.length ? "pending" : undefined,
      };
      setItems((list) => [...list, reply]);
      if (prefs.mode === "auto" && parsed.actions.length) apply(reply, { auto: true });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setItems((list) => [...list, { id: uid("m"), role: "error", content: e instanceof Error ? e.message : "Something went wrong." }]);
    } finally {
      setPending(false);
      abortRef.current = null;
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <SparklesIcon className="size-4 text-muted-foreground" aria-hidden />
        <h2 className="text-[13px] font-medium">Data assistant</h2>
        <div className="ml-auto flex items-center gap-0.5">
          {items.length ? (
            <Button variant="ghost" size="icon-sm" onClick={() => setItems([])} aria-label="Clear conversation" title="Clear conversation">
              <RotateCcwIcon />
            </Button>
          ) : null}
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close assistant">
            <XIcon />
          </Button>
        </div>
      </div>

      {/* Controls */}
      <div className="grid gap-2 border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Select value={prefs.model} onValueChange={(model) => savePrefs({ ...prefs, model })}>
            <SelectTrigger size="sm" className="h-7 min-w-0 flex-1 text-xs" aria-label="Model">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(["auto", "openai", "deepseek", "anthropic", "nvidia"] as AiProvider[]).map((p) =>
                grouped.get(p)?.length ? (
                  <SelectGroup key={p}>
                    {p !== "auto" ? <SelectLabel>{PROVIDER_LABELS[p]}</SelectLabel> : null}
                    {grouped.get(p)!.map((m) => (
                      <SelectItem key={m.id} value={m.id} className="text-xs">
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ) : null,
              )}
            </SelectContent>
          </Select>
          <div className="w-32 shrink-0">
            <Segmented
              label="Assistant mode"
              value={prefs.mode}
              onChange={(mode) => savePrefs({ ...prefs, mode })}
              options={[
                { value: "plan", label: "Plan", title: "Review proposed steps before they're applied" },
                { value: "auto", label: "Auto", title: "Apply valid proposals immediately (undo available)" },
              ]}
            />
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <DatabaseIcon className="size-3" aria-hidden />
          {focusName ? (
            <>
              Reads {b.draft.datasets.length} dataset{b.draft.datasets.length === 1 ? "" : "s"}, focused on <span className="font-medium text-foreground">{focusName}</span>
            </>
          ) : (
            "No datasets yet. Add a source in the Data tab first."
          )}
        </p>
        <UsageMeter />
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3" aria-live="polite">
        {items.length === 0 ? (
          <div className="grid gap-3 pt-2">
            <p className="text-xs text-muted-foreground">
              Ask in plain language. The assistant looks at your datasets&apos; columns and a sample of rows, then proposes transformation steps and the charts, KPIs and filters to show them.
              {prefs.mode === "plan" ? " In Plan mode you review them before anything changes." : " In Auto mode valid steps are applied right away; you can undo."}
            </p>
            <div className="grid gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={!b.draft.datasets.length}
                  onClick={() => send(s)}
                  className="rounded-md border border-border bg-background px-2.5 py-2 text-left text-xs transition-colors hover:border-border-strong hover:bg-muted/50 disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <ol className="grid gap-3">
            {items.map((m) => (
              <li key={m.id}>
                <Message item={m} onApply={() => apply(m)} onDiscard={() => setItems((list) => list.map((x) => (x.id === m.id ? { ...x, proposal: "discarded" } : x)))} />
              </li>
            ))}
            {pending ? (
              <li className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2Icon className="size-3.5 animate-spin" aria-hidden /> Thinking…
                <button type="button" className="underline underline-offset-2 hover:text-foreground" onClick={() => abortRef.current?.abort()}>
                  Stop
                </button>
              </li>
            ) : null}
          </ol>
        )}
      </div>

      {/* Composer */}
      <form
        className="border-t border-border p-2.5"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <div className="flex items-end gap-1.5 rounded-lg border border-input bg-background p-1.5 focus-within:border-border-strong focus-within:ring-2 focus-within:ring-ring/30">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={2}
            disabled={limitReached}
            placeholder={limitReached ? "Daily limit reached. Resets at midnight." : focusName ? `Ask about ${focusName}…` : "Ask about your data…"}
            aria-label="Message the data assistant"
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-1.5 py-1 text-[13px] outline-none placeholder:text-muted-foreground"
          />
          <Button type="submit" size="icon-sm" disabled={!input.trim() || pending || limitReached} aria-label="Send">
            <ArrowUpIcon />
          </Button>
        </div>
        <p className="mt-1.5 px-1 text-[10.5px] text-muted-foreground">Enter to send · Shift+Enter for a new line · Sends column names and up to 15 sample rows per dataset to the model.</p>
      </form>
    </div>
  );
}

function Message({ item, onApply, onDiscard }: { item: ChatItem; onApply: () => void; onDiscard: () => void }) {
  const b = useBuilder();
  if (item.role === "user") {
    return <div className="ml-6 rounded-lg bg-muted px-3 py-2 text-[13px] whitespace-pre-wrap">{item.content}</div>;
  }
  if (item.role === "error") {
    return (
      <div role="alert" className="flex gap-2 rounded-lg border border-destructive/30 bg-destructive-muted px-3 py-2 text-xs text-destructive">
        <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        <span>{item.content}</span>
      </div>
    );
  }
  const { text } = parseReply(item.content);
  return (
    <div className="grid gap-2">
      {text ? <div className="text-[13px] leading-relaxed whitespace-pre-wrap">{text}</div> : null}
      {item.parseError ? <p className="text-xs text-warning">{item.parseError}</p> : null}
      {item.actions?.length ? <ProposalCard item={item} dashboard={b.draft} onApply={onApply} onDiscard={onDiscard} /> : null}
      {item.model ? (
        <p className="font-mono text-[10px] text-muted-foreground">
          {item.model}
          {item.cost ? ` · ${tokens(item.cost.promptTokens)} in · ${tokens(item.cost.completionTokens)} out · ${item.cost.estimated ? "≈" : ""}${usd(item.cost.usd)}` : ""}
        </p>
      ) : null}
    </div>
  );
}

function ProposalCard({ item, dashboard, onApply, onDiscard }: { item: ChatItem; dashboard: Dashboard; onApply: () => void; onDiscard: () => void }) {
  // Re-plan against the live draft so the preview stays honest if data changed.
  const plan = React.useMemo(() => (item.proposal === "pending" ? planActions(dashboard, item.actions ?? []) : null), [item, dashboard]);

  if (item.proposal !== "pending" || !plan) {
    return (
      <div className={cn("flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs", item.proposal === "applied" ? "border-success/30 bg-success-muted text-success" : "border-border text-muted-foreground")}>
        {item.proposal === "applied" ? <CheckIcon className="size-3.5 shrink-0" aria-hidden /> : <XIcon className="size-3.5 shrink-0" aria-hidden />}
        {item.proposal === "applied" ? `${item.appliedNote ?? "Applied"}. Undo with ⌘Z.` : "Discarded"}
      </div>
    );
  }

  const valid = plan.items.filter((i) => !i.errors.length).length;
  const skipped = plan.items.length - valid;
  const datasetItems = plan.items.filter((i): i is DatasetSummary => i.kind === "dataset");
  const widgetItems = plan.items.filter((i): i is WidgetSummary => i.kind === "widget");

  return (
    <div className="grid gap-2.5 rounded-lg border border-border-strong bg-background p-2.5">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Proposed changes</p>
      {datasetItems.map((ev, i) => (
        <div key={`d${i}`} className="grid gap-1.5">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <DatabaseIcon className="size-3.5" aria-hidden />
            {ev.label}
          </p>
          <ol className="grid gap-1">
            {ev.steps.map((s, j) => {
              const Icon = STEP_ICONS[s.type];
              const r = ev.results[j];
              return (
                <li key={s.id} className={cn("flex items-start gap-1.5 rounded-md border px-2 py-1.5", r?.status === "error" ? "border-destructive/40" : "border-border")}>
                  <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block text-xs">{STEP_LABELS[s.type]}</span>
                    <span className="block font-mono text-[10.5px] break-words text-muted-foreground">{describeStep(s)}</span>
                    {r?.status === "error" ? <span className="block text-[11px] text-destructive">{r.message}</span> : null}
                  </span>
                </li>
              );
            })}
          </ol>
          {ev.rowsBefore || ev.rowsAfter ? (
            <p className="font-mono text-[10.5px] text-muted-foreground">
              Rows {ev.rowsBefore.toLocaleString("en-US")} → {ev.rowsAfter.toLocaleString("en-US")}
              {ev.columnsAdded.length ? ` · +${ev.columnsAdded.join(", ")}` : ""}
              {ev.columnsRemoved.length ? ` · −${ev.columnsRemoved.join(", ")}` : ""}
            </p>
          ) : null}
          {ev.errors.filter((e) => !e.startsWith("Step ")).map((e) => (
            <p key={e} className="text-[11px] text-destructive">
              {e}
            </p>
          ))}
          {ev.brokenWidgets.length ? (
            <p className="flex gap-1 text-[11px] text-warning">
              <AlertTriangleIcon className="mt-px size-3 shrink-0" aria-hidden /> Breaks bindings in {ev.brokenWidgets.join(", ")}. You can repair them after applying, or ask for a new dataset instead.
            </p>
          ) : null}
        </div>
      ))}
      {widgetItems.length ? (
        <div className="grid gap-1.5">
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <LayoutTemplateIcon className="size-3.5" aria-hidden />
            Add {widgetItems.length} widget{widgetItems.length === 1 ? "" : "s"} to Design
          </p>
          <ol className="grid gap-1">
            {widgetItems.map((w, i) => {
              const Icon = WIDGET_ICONS[w.widgetType];
              return (
                <li key={`w${i}`} className={cn("flex items-start gap-1.5 rounded-md border px-2 py-1.5", w.errors.length ? "border-destructive/40" : "border-border")}>
                  <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block text-xs">
                      {w.title} <span className="text-muted-foreground">· {WIDGET_LABELS[w.widgetType]}</span>
                    </span>
                    {w.detail ? <span className="block font-mono text-[10.5px] break-words text-muted-foreground">{w.detail}</span> : null}
                    {w.errors.map((e) => (
                      <span key={e} className="block text-[11px] text-destructive">
                        {e}
                      </span>
                    ))}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        <Button size="xs" onClick={onApply} disabled={!valid}>
          <CheckIcon /> {skipped && valid ? `Apply ${valid} of ${plan.items.length}` : "Apply"}
        </Button>
        <Button size="xs" variant="ghost" onClick={onDiscard}>
          <Trash2Icon /> Discard
        </Button>
        {skipped ? <span className="text-[11px] text-muted-foreground">{valid ? "Items with problems are skipped." : "Nothing here can be applied. Ask again."}</span> : null}
      </div>
    </div>
  );
}
