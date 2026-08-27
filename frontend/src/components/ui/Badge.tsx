import { ReactNode } from "react";
import { cn } from "../../utils/cn";

type Tone = "gray" | "green" | "red" | "amber" | "brand";

const TONES: Record<Tone, { badge: string; dot: string }> = {
  gray: {
    badge: "bg-slate-100/90 text-slate-700 border-slate-200/60",
    dot: "bg-slate-400",
  },
  green: {
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200/70",
    dot: "bg-emerald-500",
  },
  red: {
    badge: "bg-rose-50 text-rose-700 border-rose-200/70",
    dot: "bg-rose-500",
  },
  amber: {
    badge: "bg-amber-50 text-amber-800 border-amber-200/70",
    dot: "bg-amber-500",
  },
  brand: {
    badge: "bg-brand-50 text-brand-700 border-brand-200/70",
    dot: "bg-brand-500",
  },
};

export function Badge({
  tone = "gray",
  children,
  withDot = true,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  withDot?: boolean;
  className?: string;
}) {
  const t = TONES[tone] || TONES.gray;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide",
        t.badge,
        className
      )}
    >
      {withDot && (
        <span className="relative flex h-1.5 w-1.5">
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              t.dot
            )}
          />
          <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", t.dot)} />
        </span>
      )}
      {children}
    </span>
  );
}

export function statusTone(status: string): Tone {
  switch (status) {
    case "SUCCESS":
      return "green";
    case "FAILED":
      return "red";
    case "BLOCKED":
      return "amber";
    default:
      return "gray";
  }
}
