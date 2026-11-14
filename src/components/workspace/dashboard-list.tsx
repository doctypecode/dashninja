"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  AlertCircleIcon,
  CopyIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  LayoutGridIcon,
  ListIcon,
  MoreHorizontalIcon,
  PencilIcon,
  RefreshCwIcon,
  SquareDashedIcon,
  Trash2Icon,
} from "lucide-react";
import type { DashboardSummary } from "@/lib/model/types";
import { useDashboards, useDeleteDashboard, useDuplicateDashboard, useRenameDashboard } from "@/lib/api/queries";
import { relativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { DashboardThumbnail } from "./dashboard-thumbnail";
import { useCreateAndOpen } from "./create-dashboard-button";
import { useCurrentWorkspace } from "./use-workspace";

type View = "grid" | "list";

function useViewPreference(): [View, (v: View) => void] {
  const [view, setView] = React.useState<View>("grid");
  React.useEffect(() => {
    try {
      const v = localStorage.getItem("dashninja:workspace-view");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate a per-viewer preference after mount
      if (v === "list" || v === "grid") setView(v);
    } catch {
      /* ignore */
    }
  }, []);
  return [
    view,
    (v) => {
      setView(v);
      try {
        localStorage.setItem("dashninja:workspace-view", v);
      } catch {
        /* ignore */
      }
    },
  ];
}

export function DashboardList() {
  const { workspaceId, workspace } = useCurrentWorkspace();
  const query = useDashboards(workspaceId);
  const [view, setView] = useViewPreference();
  const [renaming, setRenaming] = React.useState<DashboardSummary | null>(null);
  const [deleting, setDeleting] = React.useState<DashboardSummary | null>(null);
  const duplicate = useDuplicateDashboard(workspaceId);

  const onDuplicate = (d: DashboardSummary) =>
    duplicate.mutate(d.id, {
      onSuccess: (copy) => toast.success(`Duplicated as “${copy.name}”`),
      onError: (e) => toast.error("Couldn’t duplicate", { description: e.message }),
    });

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.03em]">Your dashboards.</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {workspace?.demo
              ? "A shared team workspace. In this demo it starts empty and isn’t shared with anyone."
              : "Open a dashboard to edit its design and data, or start a new one."}
          </p>
        </div>
        {query.data && query.data.length > 0 ? (
          <ToggleGroup type="single" value={view} onValueChange={(v) => v && setView(v as View)} aria-label="Layout">
            <ToggleGroupItem value="grid" aria-label="Grid view">
              <LayoutGridIcon />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view">
              <ListIcon />
            </ToggleGroupItem>
          </ToggleGroup>
        ) : null}
      </div>

      <div className="mt-8">
        {query.isPending ? (
          <LoadingGrid />
        ) : query.isError ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface px-6 py-14 text-center" role="alert">
            <AlertCircleIcon className="size-5 text-destructive" aria-hidden />
            <div>
              <p className="font-medium">Couldn’t load dashboards</p>
              <p className="mt-1 text-sm text-muted-foreground">{query.error.message}</p>
            </div>
            <Button variant="secondary" size="sm" onClick={() => query.refetch()}>
              <RefreshCwIcon /> Try again
            </Button>
          </div>
        ) : query.data.length === 0 ? (
          <EmptyWorkspace workspaceId={workspaceId} />
        ) : view === "grid" ? (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {query.data.map((d, i) => (
              <li key={d.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 30}ms` }}>
                <DashboardCard d={d} onRename={setRenaming} onDuplicate={onDuplicate} onDelete={setDeleting} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-surface">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-border text-left text-xs text-muted-foreground">
                <tr>
                  <th className="h-9 px-4 font-medium">Name</th>
                  <th className="px-4 font-medium">Status</th>
                  <th className="px-4 font-medium">Sources</th>
                  <th className="px-4 font-medium">Last edited</th>
                  <th className="w-12 px-4">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {query.data.map((d) => (
                  <tr key={d.id} className="group border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="px-4 py-2.5">
                      <Link href={`/dashboards/${d.id}`} className="font-medium hover:underline underline-offset-4">
                        {d.name}
                      </Link>
                    </td>
                    <td className="px-4">
                      <StatusBadge d={d} />
                    </td>
                    <td className="px-4 text-muted-foreground">{d.sourceSummary}</td>
                    <td className="px-4 text-muted-foreground tabular">{relativeTime(d.updatedAt)}</td>
                    <td className="px-2">
                      <CardMenu d={d} onRename={setRenaming} onDuplicate={onDuplicate} onDelete={setDeleting} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RenameDialog workspaceId={workspaceId} target={renaming} onClose={() => setRenaming(null)} />
      <DeleteDialog workspaceId={workspaceId} target={deleting} onClose={() => setDeleting(null)} />
    </div>
  );
}

function StatusBadge({ d }: { d: DashboardSummary }) {
  return (
    <span className="flex flex-wrap gap-1">
      {d.isSample ? <Badge variant="info">Sample</Badge> : null}
      <Badge variant={d.status === "published" ? "success" : "outline"}>
        <span className={cn("size-1.5 rounded-full", d.status === "published" ? "bg-success" : "bg-muted-foreground")} aria-hidden />
        {d.status === "published" ? "Published" : "Draft"}
      </Badge>
    </span>
  );
}

interface CardProps {
  d: DashboardSummary;
  onRename: (d: DashboardSummary) => void;
  onDuplicate: (d: DashboardSummary) => void;
  onDelete: (d: DashboardSummary) => void;
}

function DashboardCard(props: CardProps) {
  const { d } = props;
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-surface transition-[border-color,box-shadow] duration-150 hover:border-border-strong hover:shadow-raised focus-within:border-border-strong">
      <div className="aspect-[16/9] border-b border-border bg-background p-3">
        <DashboardThumbnail items={d.thumbnail} />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start gap-2">
          <h2 className="min-w-0 flex-1 truncate font-medium tracking-tight">
            <Link href={`/dashboards/${d.id}`} className="outline-none after:absolute after:inset-0 after:rounded-xl focus-visible:after:outline-2 focus-visible:after:outline-focus">
              {d.name}
            </Link>
          </h2>
          <div className="relative z-10 -mt-1 -mr-1">
            <CardMenu {...props} />
          </div>
        </div>
        <StatusBadge d={d} />
        <div className="mt-auto flex items-center justify-between gap-2 pt-2 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1.5 truncate">
            <DatabaseIcon className="size-3.5 shrink-0" aria-hidden />
            {d.sourceSummary}
          </span>
          <span className="shrink-0 tabular">Edited {relativeTime(d.updatedAt)}</span>
        </div>
      </div>
    </article>
  );
}

function CardMenu({ d, onRename, onDuplicate, onDelete }: CardProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label={`Actions for ${d.name}`}>
          <MoreHorizontalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem asChild>
          <Link href={`/dashboards/${d.id}`}>
            <ExternalLinkIcon /> Open
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onRename(d)}>
          <PencilIcon /> Rename
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => onDuplicate(d)}>
          <CopyIcon /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => onDelete(d)}>
          <Trash2Icon /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RenameDialog({ workspaceId, target, onClose }: { workspaceId: string; target: DashboardSummary | null; onClose: () => void }) {
  const rename = useRenameDashboard(workspaceId);
  const [name, setName] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  React.useEffect(() => {
    if (target) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the form each time the dialog opens
      setName(target.name);
      setSubmitted(false);
    }
  }, [target]);
  const error = submitted && !name.trim() ? "Name can’t be empty." : null;
  return (
    <Dialog open={Boolean(target)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
            if (!target || !name.trim()) return;
            rename.mutate(
              { id: target.id, name: name.trim() },
              { onError: (err) => toast.error("Couldn’t rename", { description: err.message }) },
            );
            onClose();
          }}
          className="grid gap-4"
        >
          <DialogHeader>
            <DialogTitle>Rename dashboard</DialogTitle>
            <DialogDescription>Names are visible to everyone with access.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Dashboard name" aria-invalid={Boolean(error) || undefined} autoFocus maxLength={80} />
            {error ? <p className="text-xs text-destructive">{error}</p> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Rename</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ workspaceId, target, onClose }: { workspaceId: string; target: DashboardSummary | null; onClose: () => void }) {
  const del = useDeleteDashboard(workspaceId);
  return (
    <AlertDialog open={Boolean(target)} onOpenChange={(o) => !o && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{target?.name}”?</AlertDialogTitle>
          <AlertDialogDescription>
            The dashboard, its widgets and its imported data will be removed. This can’t be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => {
              if (!target) return;
              const name = target.name;
              del.mutate(target.id, {
                onSuccess: () => toast.success(`Deleted “${name}”`),
                onError: (e) => toast.error("Couldn’t delete", { description: e.message }),
              });
            }}
          >
            Delete dashboard
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading dashboards">
      {[0, 1, 2].map((i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-border bg-surface">
          <Skeleton className="aspect-[16/9] rounded-none" />
          <div className="grid gap-2 p-4">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-16" />
            <Skeleton className="mt-2 h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyWorkspace({ workspaceId }: { workspaceId: string }) {
  const { run, pending } = useCreateAndOpen(workspaceId);
  return (
    <div className="relative overflow-hidden rounded-xl border border-dashed border-border-strong bg-surface px-6 py-16 text-center">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-dots mask-fade-radial opacity-70" />
      <div className="relative mx-auto max-w-md">
        <div className="mx-auto flex size-10 items-center justify-center rounded-lg border border-border bg-background shadow-surface">
          <SquareDashedIcon className="size-5" aria-hidden />
        </div>
        <h2 className="mt-4 text-lg font-medium tracking-tight">No dashboards here yet</h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Create a blank dashboard and connect a CSV, Excel workbook or Google Sheet — or start with sample data to see how bindings work.
        </p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button onClick={() => run("blank")} disabled={pending}>
            Create blank dashboard
          </Button>
          <Button variant="secondary" onClick={() => run("sample-data")} disabled={pending}>
            Start with sample data
          </Button>
        </div>
      </div>
    </div>
  );
}
