import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, Lock, Mail } from "lucide-react";
import { AuthCard, MFA_STEPS } from "../components/AuthCard";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Alert } from "../components/ui/Alert";
import { LoginForm, loginSchema } from "../utils/validation";
import { authService } from "../services/authService";
import { useMfaFlow } from "../context/MfaFlowContext";
import { errorMessage, errorCode } from "../utils/errors";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const flow = useMfaFlow();
  const incomingNotice = (location.state as { notice?: string } | null)?.notice ?? null;
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    const email = values.email.trim().toLowerCase();
    try {
      const res = await authService.login(email, values.password);
      flow.reset();
      flow.setEmail(email);

      if (res.next_step === "enroll_face" || res.state === "ENROLL_REQUIRED") {
        if (res.enrollment_token) flow.setEnrollmentToken(res.enrollment_token);
        navigate("/enroll-face", { replace: true, state: { fromLogin: true } });
        return;
      }

      if (res.mfa_token) flow.setMfaToken(res.mfa_token);
      navigate("/verify-otp", { replace: true });
    } catch (e) {
      if (errorCode(e) === "EMAIL_NOT_VERIFIED") {
        flow.reset();
        flow.setEmail(email);
        navigate("/verify-email", {
          replace: true,
          state: {
            notice: "Your email isn't verified yet. Enter the code we sent you, or resend it.",
          },
        });
        return;
      }
      setServerError(errorMessage(e, "Could not sign you in."));
    }
  });

  return (
    <AuthCard
      title="Sign In to Your Account"
      subtitle="Protected by adaptive multi-factor and neural biometric liveness."
      steps={MFA_STEPS}
      currentStep={0}
      footer={
        <span>
          Don't have an account?{" "}
          <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700 underline">
            Create account
          </Link>
        </span>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {incomingNotice && <Alert tone="success">{incomingNotice}</Alert>}
        {serverError && <Alert tone="error">{serverError}</Alert>}

        <Input
          label="Email Address"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          icon={<Mail className="h-4 w-4" />}
          error={errors.email?.message}
          {...register("email")}
        />

        <Input
          label="Password"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          placeholder="••••••••••••"
          icon={<Lock className="h-4 w-4" />}
          error={errors.password?.message}
          rightSlot={
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="rounded p-1 text-slate-400 hover:text-slate-600 transition-colors"
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
          {...register("password")}
        />

        <div className="pt-1">
          <Button type="submit" variant="gradient" fullWidth loading={isSubmitting} size="lg">
            <span>Continue to Verification</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </AuthCard>
  );
}
