import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock,
  Fingerprint,
  KeyRound,
  Lock,
  Mail,
  ScanFace,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Users,
} from "lucide-react";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Badge, statusTone } from "../components/ui/Badge";
import { Alert } from "../components/ui/Alert";
import { Spinner } from "../components/ui/Spinner";
import { Button } from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import { useAsync } from "../hooks/useAsync";
import { userService } from "../services/userService";
import { formatDateTime, humanizeMethod, humanizeReason, relativeTime } from "../utils/format";
import { cn } from "../utils/cn";

function StatusPill({ ok, label, icon }: { ok: boolean; label: string; icon: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-xl border px-4 py-3.5 transition-all duration-200",
        ok
          ? "border-emerald-200/70 bg-emerald-50/40 text-slate-800"
          : "border-amber-200/70 bg-amber-50/40 text-slate-800"
      )}
    >
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg text-sm",
            ok ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
          )}
        >
          {icon}
        </span>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <Badge tone={ok ? "green" : "amber"}>{ok ? "Protected" : "Action Needed"}</Badge>
    </div>
  );
}

function methodIcon(method: string) {
  switch (method) {
    case "FACE":
      return <ScanFace className="h-4 w-4 text-purple-600" />;
    case "EMAIL_OTP":
      return <Mail className="h-4 w-4 text-blue-600" />;
    case "MFA":
      return <ShieldCheck className="h-4 w-4 text-emerald-600" />;
    case "PASSWORD":
      return <Lock className="h-4 w-4 text-slate-600" />;
    default:
      return <Fingerprint className="h-4 w-4 text-indigo-600" />;
  }
}

export default function DashboardPage() {
  const { user } = useAuth();
  const security = useAsync(() => userService.security(), []);
  const history = useAsync(() => userService.loginHistory(5), []);

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const firstName = user?.full_name?.split(" ")[0] || "User";

  return (
    <div className="space-y-7 animate-fade-in pb-8">
      {/* Modern Greeting Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-r from-white via-indigo-50/30 to-purple-50/30 p-6 shadow-sm sm:p-8">
        <div className="pointer-events-none absolute -right-12 -top-12 h-64 w-64 rounded-full bg-brand-400/10 blur-2xl" />

        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-200/60 bg-brand-50/80 px-3 py-1 text-xs font-semibold text-brand-700">
              <Sparkles className="h-3.5 w-3.5 text-brand-600 animate-spin" style={{ animationDuration: "8s" }} />
              AI-Guarded Session Active
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Welcome back, {firstName}
            </h1>
            <p className="text-sm text-slate-500 max-w-xl">
              Your biometric and multi-factor authentication factors are actively guarding your account.
            </p>
          </div>

          {/* Live Clock & Time Widget */}
          <div className="flex shrink-0 items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-glass backdrop-blur-md">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span className="text-xs font-bold font-mono text-slate-900">
                  {currentTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-400">
                {currentTime.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Stat Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Metric 1: MFA Status */}
        <Card className="hover:scale-[1.01] transition-all">
          <CardBody className="flex items-center gap-4 p-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-md shadow-emerald-500/20">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">MFA Protection</p>
              <p className="text-base font-bold text-slate-900 truncate">
                {security.data?.mfa_enabled ? "Fully Secured" : "Incomplete"}
              </p>
            </div>
          </CardBody>
        </Card>

        {/* Metric 2: Face Template */}
        <Card className="hover:scale-[1.01] transition-all">
          <CardBody className="flex items-center gap-4 p-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 text-white shadow-md shadow-purple-500/20">
              <ScanFace className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">Face Vector</p>
              <p className="text-base font-bold text-slate-900 truncate">
                {security.data?.face_enrolled ? "Enrolled (3D)" : "Not Enrolled"}
              </p>
            </div>
          </CardBody>
        </Card>

        {/* Metric 3: Active Sessions */}
        <Card className="hover:scale-[1.01] transition-all">
          <CardBody className="flex items-center gap-4 p-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-500 to-cyan-400 text-white shadow-md shadow-blue-500/20">
              <Users className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">Active Sessions</p>
              <p className="text-base font-bold text-slate-900">
                {security.data?.active_sessions ?? "—"}
              </p>
            </div>
          </CardBody>
        </Card>

        {/* Metric 4: Last Sign-in */}
        <Card className="hover:scale-[1.01] transition-all">
          <CardBody className="flex items-center gap-4 p-5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-md shadow-brand-500/20">
              <Clock className="h-6 w-6" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500">Last Sign-in</p>
              <p
                className="text-base font-bold text-slate-900 truncate"
                title={formatDateTime(security.data?.last_login_at)}
              >
                {relativeTime(security.data?.last_login_at)}
              </p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Main 2-Column Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Security Checklist Card */}
        <Card>
          <CardHeader
            title="Security Factors"
            subtitle="Server-authoritative multi-factor status"
            icon={<ShieldCheck className="h-5 w-5" />}
            action={
              <Link to="/security">
                <Button variant="ghost" size="sm">
                  Manage <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            }
          />
          <CardBody className="space-y-3 p-6">
            {security.loading ? (
              <div className="flex justify-center py-8">
                <Spinner className="h-6 w-6 text-brand-600" />
              </div>
            ) : security.error ? (
              <Alert tone="error">{security.error}</Alert>
            ) : (
              <div className="flex flex-col gap-2.5">
                <StatusPill
                  ok={!!security.data?.email_verified}
                  label="Email Authentication"
                  icon={<Mail className="h-4 w-4" />}
                />
                <StatusPill
                  ok={!!security.data?.face_enrolled}
                  label="Face Vector Profile"
                  icon={<ScanFace className="h-4 w-4" />}
                />
                <StatusPill
                  ok={!!security.data?.liveness_protection}
                  label="Anti-Spoof Liveness Protection"
                  icon={<CheckCircle2 className="h-4 w-4" />}
                />
                <StatusPill
                  ok={!!security.data?.mfa_enabled}
                  label="Zero-Trust MFA Enforcement"
                  icon={<ShieldCheck className="h-4 w-4" />}
                />
              </div>
            )}
          </CardBody>
        </Card>

        {/* Recent Activity Card */}
        <Card>
          <CardHeader
            title="Recent Activity"
            subtitle="Real-time authentication event log"
            icon={<Activity className="h-5 w-5" />}
            action={
              <Link to="/history">
                <Button variant="ghost" size="sm">
                  Full History <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            }
          />
          <CardBody className="p-0">
            {history.loading ? (
              <div className="flex justify-center py-8">
                <Spinner className="h-6 w-6 text-brand-600" />
              </div>
            ) : history.error ? (
              <div className="p-6">
                <Alert tone="error">{history.error}</Alert>
              </div>
            ) : history.data && history.data.items.length > 0 ? (
              <ul className="divide-y divide-slate-100/80">
                {history.data.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50/60 transition-colors"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 ring-1 ring-slate-200/60">
                        {methodIcon(item.authentication_method)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {humanizeMethod(item.authentication_method)}
                          {item.failure_reason ? (
                            <span className="text-xs font-normal text-rose-500">
                              {" "}
                              · {humanizeReason(item.failure_reason)}
                            </span>
                          ) : null}
                        </p>
                        <p className="text-xs text-slate-400 font-mono">
                          {formatDateTime(item.created_at)} ({relativeTime(item.created_at)})
                        </p>
                      </div>
                    </div>
                    <Badge tone={statusTone(item.status)}>{item.status}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-slate-500">
                <ShieldAlert className="h-8 w-8 text-slate-300" />
                No authentication events recorded yet.
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Warning Banner if Face Not Enrolled */}
      {security.data && !security.data.face_enrolled && (
        <Alert tone="warning" title="Complete Your Biometric Setup">
          You haven't enrolled a face template yet.{" "}
          <Link to="/enroll-face" className="font-semibold underline text-amber-900 hover:text-amber-950">
            Enroll your face now
          </Link>{" "}
          to enable full multi-factor protection.
          <span className="ml-1.5 inline-flex items-center gap-1 text-amber-700">
            <KeyRound className="h-3.5 w-3.5" />
          </span>
        </Alert>
      )}
    </div>
  );
}
