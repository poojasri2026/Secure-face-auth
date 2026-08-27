import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, KeyRound, Mail, RefreshCw } from "lucide-react";
import { AuthCard, MFA_STEPS } from "../components/AuthCard";
import { OtpInput } from "../components/OtpInput";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { authService } from "../services/authService";
import { useMfaFlow } from "../context/MfaFlowContext";
import { errorMessage } from "../utils/errors";

const RESEND_COOLDOWN_SECONDS = 30;

export default function VerifyOtpPage() {
  const navigate = useNavigate();
  const flow = useMfaFlow();
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  if (!flow.mfaToken) return <Navigate to="/login" replace />;

  async function submit(value: string) {
    if (submitting) return;
    setError(null);
    setNotice(null);
    setSubmitting(true);
    try {
      const res = await authService.verifyOtp(flow.mfaToken as string, value);
      if (res.mfa_token) flow.setMfaToken(res.mfa_token);
      navigate("/liveness", { replace: true });
    } catch (e) {
      setError(errorMessage(e, "That code didn't match. Please try again."));
      setCode("");
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    if (cooldown > 0) return;
    setError(null);
    setNotice(null);
    try {
      await authService.resendOtpByMfaToken(flow.mfaToken as string);
      setNotice("A new code is on its way. Check your inbox.");
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (e) {
      setError(errorMessage(e, "Could not resend the code just yet."));
      setCooldown(RESEND_COOLDOWN_SECONDS);
    }
  }

  return (
    <AuthCard
      title="Enter Verification Code"
      subtitle={
        <span className="flex items-center gap-1.5 justify-center sm:justify-start">
          <Mail className="h-3.5 w-3.5 text-brand-600 shrink-0" />
          <span>
            Sent 6-digit MFA code to <strong className="text-slate-700">{flow.email ?? "your email"}</strong>
          </span>
        </span>
      }
      steps={MFA_STEPS}
      currentStep={1}
    >
      <div className="space-y-6">
        {error && <Alert tone="error">{error}</Alert>}
        {notice && <Alert tone="success">{notice}</Alert>}

        <div className="py-2 flex justify-center">
          <OtpInput
            value={code}
            onChange={setCode}
            length={6}
            disabled={submitting}
            onComplete={submit}
          />
        </div>

        <Button
          fullWidth
          size="lg"
          variant="gradient"
          loading={submitting}
          disabled={code.length !== 6}
          onClick={() => submit(code)}
        >
          <KeyRound className="h-4 w-4" />
          <span>Verify OTP Code</span>
          <ArrowRight className="h-4 w-4" />
        </Button>

        <div className="text-center text-xs text-slate-500 pt-1">
          Didn't receive code?{" "}
          <button
            type="button"
            onClick={resend}
            disabled={cooldown > 0}
            className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:text-brand-700 disabled:text-slate-400 cursor-pointer disabled:cursor-not-allowed ml-1"
          >
            <RefreshCw className={`h-3 w-3 ${cooldown > 0 ? "animate-spin" : ""}`} />
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend Code"}
          </button>
        </div>
      </div>
    </AuthCard>
  );
}
