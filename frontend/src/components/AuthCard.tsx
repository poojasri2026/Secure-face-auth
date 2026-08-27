import { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { config } from "../config";
import { StepIndicator, Step } from "./StepIndicator";

// Centered branded shell shared by every auth-flow page.
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
  steps,
  currentStep,
  wide,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  steps?: Step[];
  currentStep?: number;
  wide?: boolean;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-12">
      {/* Dynamic ambient gradient background orbs */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-brand-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-purple-400/20 blur-3xl" />
      <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-80 w-80 rounded-full bg-indigo-300/10 blur-3xl" />

      <div className={wide ? "relative z-10 w-full max-w-xl" : "relative z-10 w-full max-w-md"}>
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="relative mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-lg shadow-brand-500/25 ring-4 ring-brand-500/10 transition-transform duration-300 hover:scale-105">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">{config.appName}</h1>
          <p className="text-xs text-slate-500 font-medium mt-0.5">Biometric & Multi-Factor Intelligence</p>
        </div>

        <div className="animate-fade-in relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 p-7 shadow-glass backdrop-blur-xl sm:p-9">
          {/* Top subtle gradient accent line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-500 via-indigo-500 to-purple-500" />

          {steps && typeof currentStep === "number" && (
            <div className="mb-7 pb-2">
              <StepIndicator steps={steps} current={currentStep} />
            </div>
          )}
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h2>
            {subtitle && <p className="mt-1.5 text-sm text-slate-500 leading-relaxed">{subtitle}</p>}
          </div>
          {children}
        </div>

        {footer && <div className="mt-6 text-center text-sm text-slate-500">{footer}</div>}
      </div>
    </div>
  );
}

// The ordered MFA steps, reused across the flow pages.
export const MFA_STEPS: Step[] = [
  { key: "password", label: "Password" },
  { key: "otp", label: "Email OTP" },
  { key: "liveness", label: "Liveness" },
  { key: "face", label: "Face Match" },
];
