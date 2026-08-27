import { InputHTMLAttributes, forwardRef, ReactNode } from "react";
import { cn } from "../../utils/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  rightSlot?: ReactNode;
  icon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, rightSlot, icon, className, id, ...rest },
  ref
) {
  const inputId = id || rest.name;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">
          {label}
        </label>
      )}
      <div className="relative group">
        {icon && (
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400 group-focus-within:text-brand-500 transition-colors">
            {icon}
          </div>
        )}
        <input
          id={inputId}
          ref={ref}
          className={cn(
            "w-full rounded-xl border bg-white/90 px-3.5 py-2.5 text-sm text-slate-900 shadow-sm transition-all duration-200",
            "placeholder:text-slate-400 focus:outline-none focus:ring-4",
            error
              ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500/10"
              : "border-slate-200/90 focus:border-brand-500 focus:ring-brand-500/15 hover:border-slate-300",
            icon && "pl-10",
            rightSlot && "pr-10",
            className
          )}
          aria-invalid={!!error}
          {...rest}
        />
        {rightSlot && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">{rightSlot}</div>
        )}
      </div>
      {error ? (
        <p className="animate-fade-in mt-1.5 text-xs font-medium text-rose-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
});
