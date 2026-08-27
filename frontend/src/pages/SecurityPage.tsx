import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Lock, LogOut, ScanFace, ShieldCheck } from "lucide-react";
import { Card, CardBody, CardHeader } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Alert } from "../components/ui/Alert";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Spinner } from "../components/ui/Spinner";
import { useAsync } from "../hooks/useAsync";
import { useAuth } from "../context/AuthContext";
import { userService } from "../services/userService";
import { ChangePasswordForm, changePasswordSchema } from "../utils/validation";
import { errorMessage } from "../utils/errors";
import { formatDateTime } from "../utils/format";
import { cn } from "../utils/cn";

export default function SecurityPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const incomingNotice = (location.state as { notice?: string } | null)?.notice ?? null;

  const security = useAsync(() => userService.security(), []);
  const [pwNotice, setPwNotice] = useState<string | null>(null);
  const [pwError, setPwError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { current_password: "", new_password: "", confirm_new_password: "" },
  });

  const onChangePassword = handleSubmit(async (values) => {
    setPwError(null);
    setPwNotice(null);
    try {
      await userService.changePassword(
        values.current_password,
        values.new_password,
        values.confirm_new_password
      );
      setPwNotice("Your password has been updated successfully.");
      reset();
    } catch (e) {
      setPwError(errorMessage(e, "Could not change your password."));
    }
  });

  async function signOutEverywhere() {
    setSigningOut(true);
    try {
      await userService.logoutAll();
    } catch {
      // Fall through to a local logout regardless.
    }
    await logout();
    navigate("/login", {
      replace: true,
      state: { notice: "You've been signed out of all active sessions." },
    });
  }

  return (
    <div className="space-y-7 animate-fade-in pb-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Security & Credentials</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage your biometric profile, encryption keys, password and active hardware sessions.
        </p>
      </div>

      {incomingNotice && <Alert tone="success">{incomingNotice}</Alert>}

      <Card>
        <CardHeader
          title="Account Protection Matrix"
          subtitle="Real-time multi-factor security status verified server-side."
          icon={<ShieldCheck className="h-5 w-5" />}
        />
        <CardBody className="p-6">
          {security.loading ? (
            <div className="flex justify-center py-8">
              <Spinner className="h-6 w-6 text-brand-600" />
            </div>
          ) : security.error ? (
            <Alert tone="error">{security.error}</Alert>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <FactorRow label="Email Verification" ok={!!security.data?.email_verified} />
              <FactorRow label="Biometric Face Vector" ok={!!security.data?.face_enrolled} />
              <FactorRow label="Anti-Spoof Liveness Model" ok={!!security.data?.liveness_protection} />
              <FactorRow label="Zero-Trust MFA Policy" ok={!!security.data?.mfa_enabled} />
              <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 text-xs text-slate-600">
                <span className="font-medium">Active Concurrent Sessions</span>
                <span className="font-bold text-slate-900 font-mono text-sm">
                  {security.data?.active_sessions ?? "—"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 text-xs text-slate-600">
                <span className="font-medium">Last Login Timestamp</span>
                <span className="font-semibold text-slate-900 font-mono">
                  {formatDateTime(security.data?.last_login_at)}
                </span>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Change Password" subtitle="Update your primary password credential" icon={<Lock className="h-5 w-5" />} />
          <CardBody className="p-6">
            <form onSubmit={onChangePassword} className="space-y-4" noValidate>
              {pwError && <Alert tone="error">{pwError}</Alert>}
              {pwNotice && <Alert tone="success">{pwNotice}</Alert>}

              <Input
                label="Current Password"
                type={showPw ? "text" : "password"}
                autoComplete="current-password"
                placeholder="••••••••••••"
                icon={<Lock className="h-4 w-4" />}
                error={errors.current_password?.message}
                {...register("current_password")}
              />

              <Input
                label="New Password"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••••••"
                icon={<Lock className="h-4 w-4" />}
                error={errors.new_password?.message}
                hint="At least 8 characters with upper/lowercase, number and symbol."
                rightSlot={
                  <button
                    type="button"
                    onClick={() => setShowPw((s) => !s)}
                    className="rounded p-1 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={showPw ? "Hide passwords" : "Show passwords"}
                    tabIndex={-1}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
                {...register("new_password")}
              />

              <Input
                label="Confirm New Password"
                type={showPw ? "text" : "password"}
                autoComplete="new-password"
                placeholder="••••••••••••"
                icon={<Lock className="h-4 w-4" />}
                error={errors.confirm_new_password?.message}
                {...register("confirm_new_password")}
              />

              <div className="pt-2">
                <Button type="submit" variant="primary" loading={isSubmitting}>
                  Update Password
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Biometric Face Profile" subtitle="Re-calibrate 3D face model" icon={<ScanFace className="h-5 w-5" />} />
            <CardBody className="space-y-4 p-6">
              <p className="text-xs text-slate-500 leading-relaxed">
                Re-capture your face embeddings if your camera, environment or facial appearance has changed. The server securely re-encrypts the new vectors.
              </p>
              <Link to="/enroll-face" className="inline-block">
                <Button variant="secondary">
                  <ScanFace className="h-4 w-4" /> Re-enroll Face Template
                </Button>
              </Link>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Session Revocation" subtitle="Zero-trust security killswitch" icon={<LogOut className="h-5 w-5 text-rose-500" />} />
            <CardBody className="space-y-4 p-6">
              <p className="text-xs text-slate-500 leading-relaxed">
                Instantly revoke all refresh tokens across every device. All active browser and mobile sessions will be required to re-authenticate with full MFA.
              </p>
              <Button variant="danger" onClick={signOutEverywhere} loading={signingOut}>
                <LogOut className="h-4 w-4" /> Sign Out Everywhere
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FactorRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between rounded-xl border px-4 py-3 transition-all",
        ok ? "border-emerald-200/70 bg-emerald-50/40" : "border-amber-200/70 bg-amber-50/40"
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("flex h-2 w-2 rounded-full", ok ? "bg-emerald-500" : "bg-amber-500")} />
        <span className="text-xs font-semibold text-slate-700">{label}</span>
      </div>
      <Badge tone={ok ? "green" : "amber"}>{ok ? "Active" : "Action Needed"}</Badge>
    </div>
  );
}
