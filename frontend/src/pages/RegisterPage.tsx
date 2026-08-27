import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, Lock, Mail, User } from "lucide-react";
import { AuthCard } from "../components/AuthCard";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Alert } from "../components/ui/Alert";
import { Step } from "../components/StepIndicator";
import { RegisterForm, registerSchema } from "../utils/validation";
import { authService } from "../services/authService";
import { useMfaFlow } from "../context/MfaFlowContext";
import { errorMessage } from "../utils/errors";

export const REGISTER_STEPS: Step[] = [
  { key: "account", label: "Account" },
  { key: "verify", label: "Verify Email" },
  { key: "face", label: "Enroll Face" },
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const flow = useMfaFlow();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { full_name: "", email: "", password: "", confirm_password: "" },
  });

  const onSubmit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      const res = await authService.register({
        full_name: values.full_name.trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password,
        confirm_password: values.confirm_password,
      });
      flow.reset();
      flow.setEmail(res.email);
      navigate("/verify-email", { replace: true });
    } catch (e) {
      setServerError(errorMessage(e, "Could not create your account."));
    }
  });

  return (
    <AuthCard
      title="Create Your Account"
      subtitle="Register now to enable multi-factor biometric protection."
      steps={REGISTER_STEPS}
      currentStep={0}
      footer={
        <span>
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700 underline">
            Sign in
          </Link>
        </span>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {serverError && <Alert tone="error">{serverError}</Alert>}

        <Input
          label="Full Name"
          autoComplete="name"
          placeholder="Ada Lovelace"
          icon={<User className="h-4 w-4" />}
          error={errors.full_name?.message}
          {...register("full_name")}
        />

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
          autoComplete="new-password"
          placeholder="At least 8 characters"
          icon={<Lock className="h-4 w-4" />}
          error={errors.password?.message}
          hint="Use upper- and lower-case letters, a number and a symbol."
          rightSlot={
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="rounded p-1 text-slate-400 hover:text-slate-600"
              aria-label={showPassword ? "Hide password" : "Show password"}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
          {...register("password")}
        />

        <Input
          label="Confirm Password"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          placeholder="Re-enter your password"
          icon={<Lock className="h-4 w-4" />}
          error={errors.confirm_password?.message}
          {...register("confirm_password")}
        />

        <div className="pt-1">
          <Button type="submit" variant="gradient" fullWidth loading={isSubmitting} size="lg">
            <span>Create Account & Continue</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </AuthCard>
  );
}
