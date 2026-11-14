import { cn } from "@/lib/utils";

/** Small "+" marker placed on grid intersections. Purely decorative. */
export function Cross({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className={cn("pointer-events-none absolute size-4 text-border-strong", className)}>
      <path d="M8 0v16M0 8h16" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

/** A section bounded by the page's vertical rules, with intersection markers. */
export function Section({
  id,
  children,
  className,
  markers = true,
  innerClassName,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
  innerClassName?: string;
  markers?: boolean;
}) {
  return (
    <section id={id} className={cn("relative border-t border-border scroll-mt-14", className)}>
      <div className={cn("relative mx-auto max-w-6xl border-x border-border", innerClassName)}>
        {markers ? (
          <>
            <Cross className="-top-2 -left-2" />
            <Cross className="-top-2 -right-2" />
          </>
        ) : null}
        {children}
      </div>
    </section>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{children}</p>;
}
