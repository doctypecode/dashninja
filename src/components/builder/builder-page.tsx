"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AlertCircleIcon, ArrowLeftIcon, RefreshCwIcon } from "lucide-react";
import { useDashboard } from "@/lib/api/queries";
import { NotFoundError } from "@/lib/api/repository";
import { BuilderProvider } from "@/lib/builder/store";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BuilderShell } from "./builder-shell";

export function BuilderPage() {
  const params = useParams<{ id: string }>();
  const query = useDashboard(params.id);

  if (query.isPending) return <BuilderSkeleton />;
  if (query.isError) {
    const notFound = query.error instanceof NotFoundError;
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <div className="max-w-sm text-center" role="alert">
          <AlertCircleIcon className="mx-auto size-6 text-muted-foreground" aria-hidden />
          <h1 className="mt-3 text-lg font-medium">{notFound ? "Dashboard not found" : "Couldn’t open this dashboard"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {notFound ? "It may have been deleted, or the link is wrong." : query.error.message}
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Button asChild variant="secondary">
              <Link href="/workspace">
                <ArrowLeftIcon /> Back to workspace
              </Link>
            </Button>
            {!notFound ? (
              <Button onClick={() => query.refetch()}>
                <RefreshCwIcon /> Retry
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }
  return (
    <BuilderProvider key={query.data.id} initial={query.data}>
      <BuilderShell />
    </BuilderProvider>
  );
}

export function BuilderSkeleton() {
  return (
    <div className="flex h-dvh flex-col" role="status" aria-label="Loading dashboard">
      <div className="grid h-12 grid-cols-[1fr_auto_1fr] items-center border-b border-border bg-surface px-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-7 w-36" />
        <Skeleton className="ml-auto h-7 w-32" />
      </div>
      <div className="h-11 border-b border-border bg-surface" />
      <div className="grid flex-1 grid-cols-12 content-start gap-3 bg-background p-6">
        {[3, 3, 3, 3, 8, 4].map((w, i) => (
          <Skeleton key={i} className={i < 4 ? "h-28" : "h-64"} style={{ gridColumn: `span ${w}` }} />
        ))}
      </div>
    </div>
  );
}
