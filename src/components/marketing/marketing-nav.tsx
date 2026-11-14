import Link from "next/link";
import { Wordmark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/brand/theme-toggle";
import { Button } from "@/components/ui/button";

export function MarketingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4 sm:px-6">
        <Wordmark />
        <nav aria-label="Primary" className="hidden items-center gap-1 text-[13px] text-muted-foreground md:flex">
          <Link href="/#features" className="rounded-md px-2.5 py-1.5 transition-colors hover:bg-muted hover:text-foreground">
            Features
          </Link>
          <Link href="/#how-it-works" className="rounded-md px-2.5 py-1.5 transition-colors hover:bg-muted hover:text-foreground">
            How it works
          </Link>
          <Link href="/sample" className="rounded-md px-2.5 py-1.5 transition-colors hover:bg-muted hover:text-foreground">
            Sample
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/sign-up">Get started</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
