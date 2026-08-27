import { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../utils/cn";

export function Card({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white/90 shadow-glass backdrop-blur-sm transition-all duration-300",
        "hover:shadow-glass-hover hover:border-slate-300/80",
        className
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100/80 px-6 py-5">
      <div className="flex items-start gap-3.5">
        {icon && (
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50/80 text-brand-600 ring-1 ring-brand-100">
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function CardBody({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-6", className)} {...rest}>
      {children}
    </div>
  );
}
