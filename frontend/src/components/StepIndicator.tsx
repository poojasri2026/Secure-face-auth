import { Check } from "lucide-react";
import { cn } from "../utils/cn";

export interface Step {
  key: string;
  label: string;
}

// Horizontal progress stepper for the MFA flow with animations.
export function StepIndicator({ steps, current }: { steps: Step[]; current: number }) {
  return (
    <ol className="flex items-center w-full">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex items-center gap-2 group">
              <span
                className={cn(
                  "relative flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all duration-300",
                  done && "bg-gradient-to-tr from-brand-600 to-indigo-600 text-white shadow-sm shadow-brand-500/30 scale-100",
                  active && "bg-white border-2 border-brand-600 text-brand-700 shadow-glow ring-4 ring-brand-500/15 scale-105",
                  !done && !active && "border-2 border-slate-200 bg-slate-50 text-slate-400"
                )}
              >
                {done ? <Check className="h-4 w-4 stroke-[2.5]" /> : i + 1}
              </span>
              <span
                className={cn(
                  "hidden text-xs font-semibold tracking-wide transition-colors sm:inline",
                  active ? "text-brand-700 font-bold" : done ? "text-slate-700" : "text-slate-400"
                )}
              >
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="relative mx-3 h-1 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn(
                    "h-full transition-all duration-500 rounded-full",
                    i < current ? "w-full bg-gradient-to-r from-brand-500 to-indigo-600" : "w-0"
                  )}
                />
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
