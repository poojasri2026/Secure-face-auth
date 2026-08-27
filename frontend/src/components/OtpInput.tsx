import { useMemo, useRef } from "react";
import { cn } from "../utils/cn";

// A segmented numeric OTP entry. Value is the raw digit string; onChange emits
// the concatenated digits. Handles paste, backspace and arrow navigation.
export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled,
  autoFocus = true,
  onComplete,
}: {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  disabled?: boolean;
  autoFocus?: boolean;
  onComplete?: (v: string) => void;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = useMemo(() => {
    const arr = value.split("").slice(0, length);
    while (arr.length < length) arr.push("");
    return arr;
  }, [value, length]);

  const setDigit = (idx: number, d: string) => {
    const next = digits.slice();
    next[idx] = d;
    const joined = next.join("");
    onChange(joined);
    if (d && idx < length - 1) refs.current[idx + 1]?.focus();
    if (joined.length === length && !joined.includes("") && onComplete) onComplete(joined);
  };

  return (
    <div className="flex justify-between gap-2 sm:gap-3" role="group" aria-label="One-time code">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          value={d}
          onChange={(e) => {
            const only = e.target.value.replace(/\D/g, "");
            if (!only) {
              setDigit(i, "");
              return;
            }
            // Support typing/pasting multiple digits at once.
            if (only.length > 1) {
              const chars = only.split("");
              const next = digits.slice();
              let idx = i;
              for (const c of chars) {
                if (idx >= length) break;
                next[idx] = c;
                idx += 1;
              }
              const joined = next.join("");
              onChange(joined);
              refs.current[Math.min(idx, length - 1)]?.focus();
              if (joined.length === length && !joined.includes("") && onComplete) onComplete(joined);
              return;
            }
            setDigit(i, only);
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[i] && i > 0) {
              refs.current[i - 1]?.focus();
            } else if (e.key === "ArrowLeft" && i > 0) {
              refs.current[i - 1]?.focus();
            } else if (e.key === "ArrowRight" && i < length - 1) {
              refs.current[i + 1]?.focus();
            }
          }}
          className={cn(
            "h-14 w-12 rounded-xl border-2 text-center font-mono text-xl font-bold transition-all duration-200",
            "shadow-sm focus:outline-none focus:ring-4",
            d
              ? "border-brand-500 bg-brand-50/40 text-brand-900 ring-2 ring-brand-500/20 scale-[1.02]"
              : "border-slate-200 bg-white/90 text-slate-800 focus:border-brand-500 focus:ring-brand-500/15 hover:border-slate-300",
            "disabled:bg-slate-100 disabled:text-slate-400"
          )}
        />
      ))}
    </div>
  );
}
