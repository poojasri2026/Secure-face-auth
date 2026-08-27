import { cn } from "../../utils/cn";

export function ProgressBar({
  value,
  className,
  tone = "brand",
}: {
  value: number; // 0..1
  className?: string;
  tone?: "brand" | "green";
}) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-slate-200", className)}>
      <div
        className={cn("h-full rounded-full transition-all", tone === "green" ? "bg-green-500" : "bg-brand-600")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
