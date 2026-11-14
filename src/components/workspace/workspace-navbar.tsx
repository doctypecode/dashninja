"use client";

import * as React from "react";
import { CheckIcon, ChevronsUpDownIcon, UserIcon, UsersIcon } from "lucide-react";
import { LogoMark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { AccountMenu } from "@/components/auth/account-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { CreateDashboardButton } from "./create-dashboard-button";
import { useCurrentWorkspace } from "./use-workspace";

export function WorkspaceNavbar() {
  const { workspace, workspaces, select, workspaceId } = useCurrentWorkspace();
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 px-4 sm:px-6">
        <Link href="/workspace" aria-label="DashNinja — your dashboards" className="rounded-md p-1">
          <LogoMark />
        </Link>
        <span className="text-border-strong" aria-hidden>
          /
        </span>
        {workspaces.isPending ? (
          <Skeleton className="h-7 w-32" />
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger className="flex h-8 min-w-0 items-center gap-2 rounded-md px-2 text-[13px] font-medium transition-colors hover:bg-muted">
              <span className="flex size-5 items-center justify-center rounded-[4px] border border-border bg-muted">
                {workspace?.kind === "team" ? <UsersIcon className="size-3" /> : <UserIcon className="size-3" />}
              </span>
              <span className="truncate">{workspace?.name ?? "Workspace"}</span>
              <ChevronsUpDownIcon className="size-3.5 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-60">
              <DropdownMenuLabel>Workspaces</DropdownMenuLabel>
              {workspaces.data?.map((w) => (
                <DropdownMenuItem key={w.id} onSelect={() => select(w.id)}>
                  {w.kind === "team" ? <UsersIcon /> : <UserIcon />}
                  <span className="flex-1 truncate">{w.name}</span>
                  {w.demo ? <span className="font-mono text-[10px] text-muted-foreground">DEMO</span> : null}
                  {w.id === workspaceId ? <CheckIcon className="!text-foreground" /> : null}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <div className="ml-auto flex items-center gap-1.5">
          <CreateDashboardButton workspaceId={workspaceId} />
          <ThemeToggle />
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}
