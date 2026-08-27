import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../../utils/cn";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gradient";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand-600 text-white shadow-sm hover:bg-brand-700 hover:shadow-glow active:scale-[0.99] focus-visible:ring-brand-500 disabled:bg-brand-300 disabled:shadow-none",
  gradient:
    "bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 text-white shadow-sm hover:opacity-95 hover:shadow-glow active:scale-[0.99] focus-visible:ring-brand-500 disabled:opacity-50 disabled:shadow-none",
  secondary:
    "bg-white/90 text-slate-700 border border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 active:scale-[0.99] focus-visible:ring-brand-500",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 focus-visible:ring-brand-500",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700 active:scale-[0.99] focus-visible:ring-red-500 disabled:bg-red-300",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs font-medium rounded-lg",
  md: "h-10 px-4 text-sm font-semibold rounded-xl",
  lg: "h-12 px-6 text-base font-semibold rounded-xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, fullWidth, className, children, disabled, ...rest },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 transition-all duration-200 cursor-pointer select-none",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed disabled:opacity-70 disabled:transform-none",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className
      )}
      {...rest}
    >
      {loading && <Spinner className="h-4 w-4 shrink-0" />}
      {children}
    </button>
  );
});
