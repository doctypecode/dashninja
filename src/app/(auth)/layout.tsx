import { Wordmark } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/brand/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-grid mask-fade-radial opacity-60" />
      <header className="relative flex h-14 items-center justify-between px-4 sm:px-6">
        <Wordmark />
        <ThemeToggle />
      </header>
      <main className="relative flex flex-1 items-start justify-center px-4 pt-[6vh] pb-16">{children}</main>
    </div>
  );
}
