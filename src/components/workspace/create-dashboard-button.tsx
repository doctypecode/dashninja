"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDownIcon, DatabaseIcon, Loader2Icon, PlusIcon, SquareDashedIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCreateDashboard } from "@/lib/api/queries";

export function useCreateAndOpen(workspaceId: string) {
  const router = useRouter();
  const create = useCreateDashboard();
  const run = React.useCallback(
    (template: "blank" | "sample-data") =>
      create.mutate(
        { workspaceId, template },
        {
          onSuccess: (d) => router.push(`/dashboards/${d.id}?tab=design`),
          onError: (e) => toast.error("Couldn’t create dashboard", { description: e.message }),
        },
      ),
    [create, workspaceId, router],
  );
  return { run, pending: create.isPending };
}

export function CreateDashboardButton({ workspaceId, size = "sm" }: { workspaceId: string; size?: "sm" | "default" }) {
  const { run, pending } = useCreateAndOpen(workspaceId);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size={size} disabled={pending} aria-busy={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <PlusIcon />}
          <span className="hidden sm:inline">Create dashboard</span>
          <span className="sm:hidden">Create</span>
          <ChevronDownIcon className="-mr-0.5 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuItem onSelect={() => run("blank")} className="items-start">
          <SquareDashedIcon className="mt-0.5" />
          <span className="grid">
            <span className="font-medium">Blank dashboard</span>
            <span className="text-xs text-muted-foreground">Empty canvas, no data connected</span>
          </span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => run("sample-data")} className="items-start">
          <DatabaseIcon className="mt-0.5" />
          <span className="grid">
            <span className="font-medium">Start with sample data</span>
            <span className="text-xs text-muted-foreground">Empty canvas with demo sales data connected</span>
          </span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
