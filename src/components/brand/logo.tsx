import Link from "next/link";
import { cn } from "@/lib/utils";

/** DashNinja mark: a 2×2 grid with one cell cut diagonally — dashboard tiles + a blade. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("size-5", className)}>
      <rect x="2" y="2" width="9" height="9" rx="2" fill="currentColor" />
      <rect x="13" y="2" width="9" height="9" rx="2" fill="currentColor" opacity="0.35" />
      <rect x="2" y="13" width="9" height="9" rx="2" fill="currentColor" opacity="0.35" />
      <path d="M13 22 L22 13 V20 a2 2 0 0 1 -2 2 Z" fill="currentColor" />
    </svg>
  );
}

export function Wordmark({ className, href = "/" }: { className?: string; href?: string | null }) {
  const content = (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight text-foreground", className)}>
      <LogoMark />
      <span className="text-[15px]">DashNinja</span>
    </span>
  );
  if (!href) return content;
  return (
    <Link href={href} className="rounded-md outline-offset-4" aria-label="DashNinja home">
      {content}
    </Link>
  );
}
