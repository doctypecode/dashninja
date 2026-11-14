import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <Wordmark />
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-sm text-muted-foreground">The page you’re looking for doesn’t exist.</p>
      <Button asChild variant="secondary">
        <Link href="/">Go home</Link>
      </Button>
    </div>
  );
}
