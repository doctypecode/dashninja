"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertTriangleIcon,
  ArrowUpIcon,
  CheckIcon,
  DatabaseIcon,
  Loader2Icon,
  PlusIcon,
  RotateCcwIcon,
  SparklesIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import type { Dashboard, Dataset, TransformStep } from "@/lib/model/types";
import { useBuilder, isDataBound } from "@/lib/builder/store";
import { addDataset, updateDataset, updateSteps } from "@/lib/builder/data-actions";
import { getSourceTable } from "@/lib/connectors";
import { runPipeline, describeStep, STEP_LABELS, type StepResult } from "@/lib/data/transform";
import { DEFAULT_MODEL_ID, FALLBACK_MODELS, PROVIDER_LABELS, type AiModel, type AiProvider } from "@/lib/ai/models";
import {
  buildContext,
  normalizeStep,
  parseReply,
  type AiAction,
  type AiChatMessage,
  type AiChatResponse,
  type AiMode,
} from "@/lib/ai/protocol";
import { cn, uid } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Segmented } from "@/components/builder/design/inspector-fields";
import { STEP_ICONS } from "@/components/builder/data/pipeline";

// ---------- Proposal evaluation ----------

interface EvaluatedAction {
  action: AiAction;
  label: string;
  target: Dataset | null;
  steps: TransformStep[];
  results: StepResult[];
  /** Problems that block applying. */
  errors: string[];
  rowsBefore: number;
  rowsAfter: number;
  columnsAdded: string[];
  columnsRemoved: string[];
}

function evaluate(d: Dashboard, action: AiAction): EvaluatedAction {
  const targetId = action.type === "add_steps" ? action.datasetId : action.fromDatasetId;
  const target = d.datasets.find((x) => x.id === targetId) ?? null;
  const errors: string[] = [];
  const steps: TransformStep[] = [];
  for (const raw of action.steps ?? []) {
    const n = normalizeStep(raw, uid("st"));
    if ("error" in n) errors.push(n.error);
    else steps.push(n.step);
  }
  const label = action.type === "add_steps" ? `Add ${steps.length} step${steps.length === 1 ? "" : "s"} to “${target?.name ?? "unknown dataset"}”` : `New dataset “${action.name || "Untitled"}”`;
  if (!target) {
    errors.push(`Dataset ${targetId} doesn't exist in this dashboard.`);
    return { action, label, target, steps, results: [], errors, rowsBefore: 0, rowsAfter: 0, columnsAdded: [], columnsRemoved: [] };
  }
  const source = d.sources.find((s) => s.id === target.sourceId);
  if (!source) errors.push("The dataset's source is missing.");
  const table = source ? getSourceTable(d, source) : { columns: [], rows: [] };
  const before = runPipeline(table, target.steps);
  const after = runPipeline(table, [...target.steps, ...steps]);
  const results = after.steps.slice(target.steps.length);
  for (const [i, r] of results.entries()) if (r.status === "error") errors.push(`Step ${i + 1} (${STEP_LABELS[steps[i].type]}): ${r.message}`);
  if (action.type === "new_dataset" && d.datasets.some((x) => x.name === action.name)) errors.push(`A dataset named “${action.name}” already exists.`);
  const beforeCols = new Set(before.table.columns.map((c) => c.name));
  const afterCols = new Set(after.table.columns.map((c) => c.name));
  return {
    action,
    label,
    target,
    steps,
    results,
    errors,
    rowsBefore: before.table.rows.length,
    rowsAfter: after.table.rows.length,
    columnsAdded: [...afterCols].filter((c) => !beforeCols.has(c)),
    columnsRemoved: [...beforeCols].filter((c) => !afterCols.has(c)),
  };
}

/** Columns that widgets bind to and that a proposal would remove. */
function brokenBindings(d: Dashboard, ev: EvaluatedAction) {
  if (ev.action.type !== "add_steps" || !ev.target || !ev.columnsRemoved.length) return [];
  const removed = new Set(ev.columnsRemoved);
  return d.widgets
    .filter(isDataBound)
    .filter((w) => w.binding.datasetId === ev.target!.id)
    .filter((w) => [w.binding.dimension, w.binding.series, ...w.binding.columns, ...w.binding.measures.map((m) => m.field)].some((c) => c && removed.has(c)))
    .map((w) => w.title);
}

// ---------- Chat state ----------

type ProposalState = "pending" | "applied" | "discarded";

interface ChatItem {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  model?: string;
  actions?: AiAction[];
  parseError?: string | null;
  proposal?: ProposalState;
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
  "Add a margin column (revenue minus cost)",
  "Make a new dataset with total revenue by region",
  "Only keep orders from 2026",
  "Which columns have empty values?",
];

export function AiPanel({ onClose, focusDatasetId }: { onClose: () => void; focusDatasetId?: string | null }) {
  const b = useBuilder();
  const [items, setItems] = React.useState<ChatItem[]>([]);
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
      const d = b.draft;
      const evaluated = (item.actions ?? []).map((a) => evaluate(d, a));
      const blocked = evaluated.filter((e) => e.errors.length);
      if (blocked.length) {
        if (!opts.auto) toast.error("This proposal can't be applied", { description: blocked[0].errors[0] });
        return false;
      }
      b.update((draft) => {
        let next = draft;
        for (const ev of evaluated) {
          if (!ev.target) continue;
          if (ev.action.type === "add_steps") {
            next = updateSteps(next, ev.target.id, (s) => [...s, ...ev.steps]);
          } else {
            const id = uid("ds");
            next = addDataset(next, ev.target.sourceId, id, ev.target).next;
            next = updateDataset(next, id, { name: ev.action.name || `${ev.target.name} (AI)` });
            next = updateSteps(next, id, (s) => [...s, ...ev.steps]);
          }
        }
        return next;
      });
      setItems((list) => list.map((x) => (x.id === item.id ? { ...x, proposal: "applied" } : x)));
      toast.success(opts.auto ? "Applied automatically" : "Applied", {
        description: evaluated.map((e) => e.label).join(" · "),
        action: { label: "Undo", onClick: () => b.undo() },
      });
      return true;
    },
    [b],
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
      const json = (await res.json().catch(() => ({}))) as Partial<AiChatResponse> & { error?: string };
      if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
      const parsed = parseReply(json.content ?? "");
      const reply: ChatItem = {
        id: uid("m"),
        role: "assistant",
        content: json.content ?? "",
        model: json.model,
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
              {(["auto", "openai", "deepseek", "anthropic"] as AiProvider[]).map((p) =>
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
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-3" aria-live="polite">
        {items.length === 0 ? (
          <div className="grid gap-3 pt-2">
            <p className="text-xs text-muted-foreground">
              Ask in plain language. The assistant looks at your datasets&apos; columns and a sample of rows, then proposes transformation steps.
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
            placeholder={focusName ? `Ask about ${focusName}…` : "Ask about your data…"}
            aria-label="Message the data assistant"
            className="max-h-40 min-h-10 flex-1 resize-none bg-transparent px-1.5 py-1 text-[13px] outline-none placeholder:text-muted-foreground"
          />
          <Button type="submit" size="icon-sm" disabled={!input.trim() || pending} aria-label="Send">
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
      {item.model ? <p className="font-mono text-[10px] text-muted-foreground">{item.model}</p> : null}
    </div>
  );
}

function ProposalCard({ item, dashboard, onApply, onDiscard }: { item: ChatItem; dashboard: Dashboard; onApply: () => void; onDiscard: () => void }) {
  // Re-evaluate against the live draft so the preview stays honest if data changed.
  const evaluated = React.useMemo(() => (item.proposal === "pending" ? (item.actions ?? []).map((a) => evaluate(dashboard, a)) : null), [item, dashboard]);
  const blocked = evaluated?.some((e) => e.errors.length);

  if (item.proposal !== "pending") {
    return (
      <div className={cn("flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs", item.proposal === "applied" ? "border-success/30 bg-success-muted text-success" : "border-border text-muted-foreground")}>
        {item.proposal === "applied" ? <CheckIcon className="size-3.5" aria-hidden /> : <XIcon className="size-3.5" aria-hidden />}
        {item.proposal === "applied" ? "Applied. Use Undo (⌘Z) to revert." : "Discarded"}
      </div>
    );
  }

  return (
    <div className="grid gap-2 rounded-lg border border-border-strong bg-background p-2.5">
      <p className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">Proposed changes</p>
      {evaluated!.map((ev, i) => {
        const broken = brokenBindings(dashboard, ev);
        return (
          <div key={i} className="grid gap-1.5">
            <p className="flex items-center gap-1.5 text-xs font-medium">
              {ev.action.type === "new_dataset" ? <PlusIcon className="size-3.5" aria-hidden /> : <DatabaseIcon className="size-3.5" aria-hidden />}
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
            {ev.target ? (
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
            {broken.length ? (
              <p className="flex gap-1 text-[11px] text-warning">
                <AlertTriangleIcon className="mt-px size-3 shrink-0" aria-hidden /> Breaks bindings in {broken.join(", ")}. You can repair them after applying, or ask for a new dataset instead.
              </p>
            ) : null}
          </div>
        );
      })}
      <div className="flex items-center gap-1.5 pt-1">
        <Button size="xs" onClick={onApply} disabled={blocked}>
          <CheckIcon /> Apply
        </Button>
        <Button size="xs" variant="ghost" onClick={onDiscard}>
          <Trash2Icon /> Discard
        </Button>
        {blocked ? <span className="text-[11px] text-muted-foreground">Fix or ask again; nothing was changed.</span> : null}
      </div>
    </div>
  );
}
