import { cn } from "@/lib/utils";

/** Horizontal bar used for need charts and score breakdowns (CSS only). */
export function Bar({ value, className, tone = "primary" }: { value: number; className?: string; tone?: "primary" | "warning" | "success" | "muted" }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const color = { primary: "bg-primary", warning: "bg-warning", success: "bg-success", muted: "bg-muted-foreground/40" }[tone];
  return (
    <div className={cn("h-2.5 w-full overflow-hidden rounded-full bg-muted", className)} role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}
