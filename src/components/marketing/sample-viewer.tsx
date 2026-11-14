"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRightIcon, InfoIcon } from "lucide-react";
import { createSampleDashboard } from "@/lib/model/sample-dashboard";
import { DashboardRuntimeProvider } from "@/components/widgets/runtime";
import { DashboardView } from "@/components/widgets/dashboard-view";
import { Wordmark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function SampleViewer() {
  const dashboard = React.useMemo(() => createSampleDashboard("sample", "public", "2026-11-01T00:00:00.000Z"), []);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <Wordmark />
          <span className="text-border-strong" aria-hidden>
            /
          </span>
          <span className="truncate text-[13px] font-medium">Sales overview</span>
          <Badge variant="info" className="hidden sm:inline-flex">
            Sample dashboard
          </Badge>
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeToggle />
            <Button asChild size="sm">
              <Link href="/sign-up?next=%2Fworkspace">
                Create your own <ArrowRightIcon />
              </Link>
            </Button>
          </div>
        </div>
      </header>
      <div className="border-b border-border bg-surface">
        <p className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 text-xs text-muted-foreground sm:px-6">
          <InfoIcon className="size-3.5 shrink-0" aria-hidden />
          A read-only demonstration built from synthetic sales data. Filters are interactive.
        </p>
      </div>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <DashboardRuntimeProvider dashboard={dashboard} mode="view">
          <DashboardView dashboard={dashboard} />
        </DashboardRuntimeProvider>
      </main>
    </div>
  );
}
