"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LayoutGridIcon, LogOutIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthAdapter, useSession } from "@/lib/auth";

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function AccountMenu() {
  const session = useSession();
  const auth = useAuthAdapter();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  if (!session) return <span className="size-8 rounded-full bg-muted" />;
  const { user } = session;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex size-8 items-center justify-center rounded-full border border-border bg-muted text-[11px] font-semibold text-foreground transition-colors hover:border-border-strong"
        aria-label={`Account menu for ${user.name}`}
      >
        {initials(user.name) || "?"}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <div className="px-2 py-2">
          <p className="truncate text-[13px] font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          {auth.isDemo ? (
            <p className="mt-1.5 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              Demo account · {user.provider === "google" ? "Google (simulated)" : "email"}
            </p>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/workspace">
            <LayoutGridIcon /> Your dashboards
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
          {resolvedTheme === "dark" ? <SunIcon /> : <MoonIcon />}
          {resolvedTheme === "dark" ? "Light theme" : "Dark theme"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="sr-only">Session</DropdownMenuLabel>
        <DropdownMenuItem
          onSelect={async () => {
            await auth.signOut();
            router.replace("/sign-in");
          }}
        >
          <LogOutIcon /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
