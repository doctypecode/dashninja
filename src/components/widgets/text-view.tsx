import type { TextWidget } from "@/lib/model/types";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: ["text-sm", "text-xs"],
  md: ["text-base", "text-sm"],
  lg: ["text-lg", "text-sm"],
  xl: ["text-2xl tracking-tight", "text-sm"],
} as const;

/** First line renders as the heading; following lines as supporting text. */
export function TextView({ widget }: { widget: TextWidget }) {
  const [first, ...rest] = widget.options.content.split("\n");
  const [h, p] = SIZES[widget.options.size];
  return (
    <div className={cn("flex h-full flex-col justify-center gap-1", widget.style.align === "center" && "items-center text-center")}>
      {first ? <p className={cn("font-semibold text-foreground", h)}>{first}</p> : <p className="text-sm text-muted-foreground">Empty text</p>}
      {rest.filter(Boolean).map((line, i) => (
        <p key={i} className={cn("text-muted-foreground", p)}>
          {line}
        </p>
      ))}
    </div>
  );
}
