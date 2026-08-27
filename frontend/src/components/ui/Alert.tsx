import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "../../utils/cn";

type Tone = "error" | "success" | "info" | "warning";

const TONES: Record<Tone, { wrap: string; icon: ReactNode; iconColor: string }> = {
  error: {
    wrap: "bg-rose-50/90 text-rose-900 border-rose-200/80 shadow-sm",
    icon: <XCircle className="h-5 w-5" />,
    iconColor: "text-rose-500",
  },
  success: {
    wrap: "bg-emerald-50/90 text-emerald-900 border-emerald-200/80 shadow-sm",
    icon: <CheckCircle2 className="h-5 w-5" />,
    iconColor: "text-emerald-500",
  },
  info: {
    wrap: "bg-brand-50/90 text-brand-950 border-brand-200/80 shadow-sm",
    icon: <Info className="h-5 w-5" />,
    iconColor: "text-brand-500",
  },
  warning: {
    wrap: "bg-amber-50/90 text-amber-950 border-amber-200/80 shadow-sm",
    icon: <AlertTriangle className="h-5 w-5" />,
    iconColor: "text-amber-500",
  },
};

export function Alert({
  tone = "info",
  title,
  children,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <div
      className={cn(
        "animate-fade-in flex items-start gap-3.5 rounded-xl border p-4 text-sm backdrop-blur-sm",
        t.wrap,
        className
      )}
    >
      <div className={cn("mt-0.5 shrink-0", t.iconColor)}>{t.icon}</div>
      <div className="min-w-0 flex-1">
        {title && <div className="font-semibold">{title}</div>}
        {children && <div className={cn(title && "mt-1", "leading-relaxed opacity-90")}>{children}</div>}
      </div>
    </div>
  );
}
