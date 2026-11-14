"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ChevronDownIcon,
  DatabaseIcon,
  EyeIcon,
  EyeOffIcon,
  FlaskConicalIcon,
  LayoutTemplateIcon,
  Loader2Icon,
  MonitorIcon,
  SmartphoneIcon,
  SparklesIcon,
} from "lucide-react";
import { useBuilder } from "@/lib/builder/store";
import { useSaveDashboard } from "@/lib/api/queries";
import { getSimulateSaveFailure, setSimulateSaveFailure } from "@/lib/api/repository";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Hint } from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DashboardRuntimeProvider, useRuntime } from "@/components/widgets/runtime";
import { DashboardView } from "@/components/widgets/dashboard-view";
import { cn } from "@/lib/utils";
import { SaveStatusIndicator } from "./save-status";
import { DesignTab, type RightPanel } from "./design/design-tab";
import { BuilderRail } from "./builder-rail";
import { DataTab } from "./data/data-tab";
import { AiPanel, type ChatItem } from "./ai/ai-panel";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { useMediaQuery } from "@/lib/use-media-query";

export type BuilderTab = "design" | "data";

function useBuilderUrl() {
  const params = useSearchParams();
  const pathname = usePathname();
  const tab: BuilderTab = params.get("tab") === "data" ? "data" : "design";
  const preview = params.get("view") === "preview";
  const set = React.useCallback(
    (patch: { tab?: BuilderTab; preview?: boolean }) => {
      const q = new URLSearchParams(params);
      if (patch.tab) q.set("tab", patch.tab);
      if (patch.preview !== undefined) {
        if (patch.preview) q.set("view", "preview");
        else q.delete("view");
      }
      // Native history updates are synced into useSearchParams without a server round trip,
      // so switching tabs is instant and never remounts the draft.
      window.history.replaceState(null, "", `${pathname}?${q.toString()}`);
    },
    [params, pathname],
  );
  return { tab, preview, set };
}

export function BuilderShell() {
  const b = useBuilder();
  const { tab, preview, set } = useBuilderUrl();
  const router = useRouter();
  const saveMutation = useSaveDashboard();
  const [leaveOpen, setLeaveOpen] = React.useState(false);
  const [visited, setVisited] = React.useState<Record<BuilderTab, boolean>>({ design: tab === "design", data: tab === "data" });
  const [simulateFailure, setSimulateFailure] = React.useState(false);
  // Right rail: one panel at a time. Settings belongs to Design; chat works in both tabs.
  // Each tab remembers its own panel: Design defaults to settings, Data to transformations.
  const [panels, setPanels] = React.useState<Record<BuilderTab, RightPanel>>({ design: "settings", data: "transformations" });
  const [dataFocus, setDataFocus] = React.useState<string | null>(null);
  const [chatItems, setChatItems] = React.useState<ChatItem[]>([]);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  React.useEffect(() => {
    // Phones and tablets start with panels closed; they open as sheets on demand.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time viewport adjustment
    if (!isDesktop) setPanels({ design: null, data: null });
  }, [isDesktop]);
  const rightPanel = panels[tab];
  const setDesignPanel = React.useCallback((p: RightPanel) => setPanels((x) => ({ ...x, design: p })), []);
  const setDataPanel = React.useCallback((p: RightPanel) => setPanels((x) => ({ ...x, data: p })), []);
  const setRightPanel = (p: RightPanel) => (tab === "design" ? setDesignPanel(p) : setDataPanel(p));
  const aiOpen = rightPanel === "chat";
  // After the assistant adds widgets, show them in Design and keep the chat beside them.
  const showDesignWithChat = React.useCallback(() => {
    setPanels((x) => ({ ...x, design: "chat" }));
    set({ tab: "design" });
  }, [set]);
  const setAiOpen = (open: boolean) => setRightPanel(open ? "chat" : null);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- read a demo-only toggle from storage after mount
    setSimulateFailure(getSimulateSaveFailure());
  }, []);

  React.useEffect(() => {
    // Lazily mount each tab on first visit, then keep it mounted so local UI state survives switching.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setVisited((v) => (v[tab] ? v : { ...v, [tab]: true }));
  }, [tab]);

  const save = React.useCallback(() => {
    if (b.status === "saving") return;
    const revision = b.markSaving();
    const snapshot = b.draft;
    saveMutation.mutate(snapshot, {
      onSuccess: (saved) => b.markSaved(revision, saved.updatedAt),
      onError: (e) => {
        b.markFailed(e.message);
        toast.error("Save failed", { description: e.message, action: { label: "Retry", onClick: () => document.getElementById("builder-save")?.click() } });
      },
    });
  }, [b, saveMutation]);

  const dirty = b.status === "unsaved" || b.status === "failed" || b.status === "saving";

  // Warn before closing the tab with unsaved changes.
  React.useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Global shortcuts: save, undo/redo, tab switching, preview.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const typing = target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      } else if (mod && e.key.toLowerCase() === "z" && !typing) {
        e.preventDefault();
        if (e.shiftKey) b.redo();
        else b.undo();
      } else if (mod && e.key.toLowerCase() === "y" && !typing) {
        e.preventDefault();
        b.redo();
      } else if (e.altKey && !mod && (e.key === "1" || e.key === "2") && !typing) {
        e.preventDefault();
        set({ tab: e.key === "1" ? "design" : "data" });
      } else if (e.key === "Escape" && preview && !typing) {
        set({ preview: false });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, b, set, preview]);

  const openData = React.useCallback(() => set({ tab: "data", preview: false }), [set]);
  const repair = React.useCallback(
    (id: string) => {
      b.requestRepair(id);
      set({ tab: "design", preview: false });
    },
    [b, set],
  );

  const onBack = (e: React.MouseEvent) => {
    if (dirty) {
      e.preventDefault();
      setLeaveOpen(true);
    }
  };

  return (
    <DashboardRuntimeProvider dashboard={b.draft} mode={preview ? "view" : "edit"} onRequestData={openData} onRepair={repair}>
      <div className="flex h-dvh flex-col overflow-hidden bg-background">
        <header className="z-30 grid h-12 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-border bg-surface px-2 sm:px-3">
          {/* Left: global exit + dashboard identity */}
          <div className="flex min-w-0 items-center gap-1.5">
            <Hint label="Back to workspace">
              <Button asChild variant="ghost" size="icon-sm">
                <Link href="/workspace" onClick={onBack} aria-label="Back to workspace">
                  <ArrowLeftIcon />
                </Link>
              </Button>
            </Hint>
            <span className="h-5 w-px shrink-0 bg-border" aria-hidden />
            <TitleEditor readOnly={preview} />
            {b.draft.isSample ? (
              <Badge variant="info" className="hidden lg:inline-flex">
                Sample
              </Badge>
            ) : null}
            <SaveStatusIndicator status={b.status} error={b.saveError} onRetry={save} />
          </div>

          {/* Center: Design / Data */}
          {preview ? (
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted px-2.5 py-1 text-xs font-medium">
              <EyeIcon className="size-3.5" aria-hidden /> Preview
            </span>
          ) : (
            <div role="tablist" aria-label="Builder" className="inline-flex h-8 items-center gap-0.5 rounded-md border border-border bg-muted p-0.5">
              <TabButton active={tab === "design"} onClick={() => set({ tab: "design" })} controls="panel-design" shortcut="Alt 1">
                <LayoutTemplateIcon /> <span className="sr-only sm:not-sr-only">Design</span>
              </TabButton>
              <TabButton active={tab === "data"} onClick={() => set({ tab: "data" })} controls="panel-data" shortcut="Alt 2">
                <DatabaseIcon /> <span className="sr-only sm:not-sr-only">Data</span>
                <IssueDot />
              </TabButton>
            </div>
          )}

          {/* Right: dashboard-level actions */}
          <div className="flex items-center justify-end gap-1.5">
            {!preview && !isDesktop ? (
              <Hint label="Ask the data assistant">
                <Button variant={aiOpen ? "secondary" : "ghost"} size="icon-sm" onClick={() => setAiOpen(!aiOpen)} aria-pressed={aiOpen} aria-label="Ask AI">
                  <SparklesIcon />
                </Button>
              </Hint>
            ) : null}
            <Button variant={preview ? "secondary" : "ghost"} size="sm" onClick={() => set({ preview: !preview })} aria-pressed={preview}>
              {preview ? <EyeOffIcon /> : <EyeIcon />}
              <span className="hidden sm:inline">{preview ? "Exit preview" : "Preview"}</span>
            </Button>
            <div className="flex">
              <Button
                id="builder-save"
                size="sm"
                onClick={save}
                disabled={b.status === "saving" || b.status === "saved"}
                className="rounded-r-none"
                aria-keyshortcuts="Control+S Meta+S"
              >
                {b.status === "saving" ? <Loader2Icon className="animate-spin" /> : null}
                Save
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" className="rounded-l-none border-l border-primary-foreground/20 px-1.5" aria-label="Save options">
                    <ChevronDownIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Demo controls</DropdownMenuLabel>
                  <DropdownMenuCheckboxItem
                    checked={simulateFailure}
                    onCheckedChange={(c) => {
                      setSimulateSaveFailure(Boolean(c));
                      setSimulateFailure(Boolean(c));
                    }}
                  >
                    <FlaskConicalIcon /> Simulate save failure
                  </DropdownMenuCheckboxItem>
                  <DropdownMenuSeparator />
                  <p className="px-2 py-1.5 text-xs text-muted-foreground">
                    Saved to this browser. Shortcut <span className="font-mono">⌘/Ctrl S</span>.
                  </p>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {preview ? (
          <PreviewMode />
        ) : (
          <div className="flex min-h-0 flex-1">
            <div className="flex min-w-0 flex-1 flex-col">
              <div id="panel-design" role="tabpanel" aria-label="Design" hidden={tab !== "design"} className={cn("min-h-0 flex-1", tab === "design" ? "flex flex-col" : "hidden")}>
                {visited.design ? <DesignTab active={tab === "design"} panel={panels.design} onPanelChange={setDesignPanel} /> : null}
              </div>
              <div id="panel-data" role="tabpanel" aria-label="Data" hidden={tab !== "data"} className={cn("min-h-0 flex-1", tab === "data" ? "flex flex-col" : "hidden")}>
                {visited.data ? <DataTab onRepair={repair} onFocusDataset={setDataFocus} panel={panels.data} onPanelChange={setDataPanel} /> : null}
              </div>
            </div>
            {aiOpen && isDesktop ? (
              <aside aria-label="Data assistant" className="w-[360px] shrink-0 border-l border-border animate-fade-in xl:w-[380px]">
                <AiPanel onClose={() => setRightPanel(null)} focusDatasetId={tab === "data" ? dataFocus : null} items={chatItems} setItems={setChatItems} onWidgetsAdded={showDesignWithChat} />
              </aside>
            ) : null}
            {isDesktop ? <BuilderRail tab={tab} panel={rightPanel} onPanelChange={setRightPanel} /> : null}
          </div>
        )}
      </div>

      {!isDesktop && !preview ? (
        <Sheet open={aiOpen} onOpenChange={(o) => setRightPanel(o ? "chat" : null)}>
          <SheetContent side="right" className="w-[min(100vw,400px)] [&>button:last-child]:hidden">
            <SheetTitle className="sr-only">Data assistant</SheetTitle>
            <SheetDescription className="sr-only">Ask for transformations in plain language.</SheetDescription>
            <AiPanel onClose={() => setAiOpen(false)} focusDatasetId={tab === "data" ? dataFocus : null} items={chatItems} setItems={setChatItems} onWidgetsAdded={showDesignWithChat} />
          </SheetContent>
        </Sheet>
      ) : null}

      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave without saving?</AlertDialogTitle>
            <AlertDialogDescription>
              {b.status === "failed"
                ? "The last save failed. Your changes only exist in this tab."
                : "You have unsaved changes to this dashboard’s design or data."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <Button
              variant="secondary"
              onClick={() => {
                setLeaveOpen(false);
                router.push("/workspace");
              }}
            >
              Discard changes
            </Button>
            <Button
              onClick={() => {
                const revision = b.markSaving();
                saveMutation.mutate(b.draft, {
                  onSuccess: (saved) => {
                    b.markSaved(revision, saved.updatedAt);
                    router.push("/workspace");
                  },
                  onError: (e) => {
                    b.markFailed(e.message);
                    setLeaveOpen(false);
                    toast.error("Save failed", { description: e.message });
                  },
                });
              }}
              disabled={b.status === "saving"}
            >
              {b.status === "saving" ? <Loader2Icon className="animate-spin" /> : null}
              Save and leave
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardRuntimeProvider>
  );
}

function TabButton({
  active,
  onClick,
  children,
  controls,
  shortcut,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  controls: string;
  shortcut: string;
}) {
  return (
    <Hint label={active ? "Current tab" : "Switch tab"} shortcut={shortcut}>
      <button
        type="button"
        role="tab"
        aria-selected={active}
        aria-controls={controls}
        onClick={onClick}
        className={cn(
          "relative inline-flex h-full items-center gap-1.5 rounded-[4px] px-2.5 text-[13px] font-medium transition-[color,background-color,box-shadow] duration-150 sm:px-3 [&_svg]:size-3.5",
          active ? "bg-surface text-foreground shadow-surface" : "text-muted-foreground hover:text-foreground",
        )}
      >
        {children}
      </button>
    </Hint>
  );
}

function IssueDot() {
  const { issues } = useRuntime();
  if (issues.length === 0) return null;
  return (
    <span className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-warning px-1 font-mono text-[10px] text-background" aria-label={`${issues.length} binding issues`}>
      {issues.length}
    </span>
  );
}

function TitleEditor({ readOnly }: { readOnly: boolean }) {
  const b = useBuilder();
  const [value, setValue] = React.useState(b.draft.name);
  const [editing, setEditing] = React.useState(false);
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- follow undo/redo when not editing
    if (!editing) setValue(b.draft.name);
  }, [b.draft.name, editing]);
  const commit = () => {
    setEditing(false);
    const name = value.trim();
    if (!name) {
      setValue(b.draft.name);
      return;
    }
    if (name !== b.draft.name) b.update((d) => ({ ...d, name }));
  };
  if (readOnly) return <span className="truncate px-1 text-[13px] font-medium">{b.draft.name}</span>;
  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onFocus={() => setEditing(true)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setValue(b.draft.name);
          setEditing(false);
          requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
        }
      }}
      aria-label="Dashboard title"
      maxLength={80}
      size={Math.max(8, Math.min(value.length + 1, 36))}
      className="h-7 min-w-0 max-w-[16rem] truncate rounded-md border border-transparent bg-transparent px-1.5 text-[13px] font-medium outline-none transition-colors hover:border-border focus:border-focus focus:bg-surface focus:ring-3 focus:ring-focus/15 lg:max-w-[22rem]"
    />
  );
}

function PreviewMode() {
  const b = useBuilder();
  const [device, setDevice] = React.useState<"desktop" | "mobile">("desktop");
  const bg = b.draft.appearance.background;
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-border bg-surface px-3 text-xs text-muted-foreground">
        <span className="truncate">Viewer preview · filters are interactive · editing controls hidden</span>
        <ToggleGroup type="single" value={device} onValueChange={(v) => v && setDevice(v as typeof device)} aria-label="Preview device">
          <ToggleGroupItem value="desktop" aria-label="Desktop preview">
            <MonitorIcon />
          </ToggleGroupItem>
          <ToggleGroupItem value="mobile" aria-label="Mobile preview">
            <SmartphoneIcon />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div className={cn("min-h-0 flex-1 overflow-auto", bg === "dots" && "bg-dots", bg === "grid" && "bg-grid")}>
        <div
          className={cn(
            "mx-auto px-4 py-6 animate-fade-in",
            device === "mobile" ? "max-w-[400px]" : b.draft.appearance.maxWidth === "narrow" ? "max-w-4xl" : b.draft.appearance.maxWidth === "wide" ? "max-w-7xl" : "max-w-none",
          )}
        >
          {b.draft.widgets.length === 0 ? (
            <p className="py-20 text-center text-sm text-muted-foreground">This dashboard has no widgets yet.</p>
          ) : (
            <DashboardView dashboard={b.draft} forceStack={device === "mobile"} />
          )}
        </div>
      </div>
    </div>
  );
}
