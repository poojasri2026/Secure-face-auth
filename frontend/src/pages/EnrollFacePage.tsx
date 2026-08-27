import { useMemo, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Camera, ShieldCheck, Sparkles } from "lucide-react";
import { AuthCard } from "../components/AuthCard";
import { REGISTER_STEPS } from "./RegisterPage";
import { CameraView, FaceGuide } from "../components/CameraView";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { ProgressBar } from "../components/ui/ProgressBar";
import { Spinner } from "../components/ui/Spinner";
import { useCamera } from "../hooks/useCamera";
import { useFaceLandmarker } from "../hooks/useFaceLandmarker";
import { useFaceCapture } from "../hooks/useFaceCapture";
import { faceService } from "../services/faceService";
import { useMfaFlow } from "../context/MfaFlowContext";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../utils/errors";

const SAMPLE_COUNT = 5;

export default function EnrollFacePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const flow = useMfaFlow();
  const { isAuthenticated, refreshUser } = useAuth();

  const { videoRef, ready: cameraReady, error: cameraError } = useCamera(true);
  const { ready: modelReady, loading: modelLoading, error: modelError, detect } =
    useFaceLandmarker();
  const { capturing, progress, hint, captureSequence } = useFaceCapture(videoRef, detect);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const reEnroll = isAuthenticated && !flow.enrollmentToken;
  const fromLogin = !!(location.state as { fromLogin?: boolean } | null)?.fromLogin;
  const showRegisterSteps = !reEnroll && !fromLogin;

  if (!flow.enrollmentToken && !isAuthenticated) {
    return <Navigate to="/register" replace />;
  }

  const canStart = cameraReady && modelReady && !capturing && !submitting;

  async function run() {
    setError(null);
    setSubmitting(true);
    try {
      const images = await captureSequence(SAMPLE_COUNT, { minBoxRatio: 0.1 });
      const res = await faceService.enroll(images, flow.enrollmentToken ?? undefined);
      if (!res.is_face_enrolled) {
        throw new Error(
          res.message || "We couldn't confirm your face was enrolled. Please try again."
        );
      }

      if (reEnroll) {
        await refreshUser();
        navigate("/security", {
          replace: true,
          state: { notice: "Your face template was updated." },
        });
      } else {
        flow.setEnrollmentToken(null);
        navigate("/login", {
          replace: true,
          state: { notice: "Face enrolled successfully. Sign in to continue." },
        });
      }
    } catch (e) {
      setError(errorMessage(e, "Enrollment failed. Ensure good lighting and try again."));
    } finally {
      setSubmitting(false);
    }
  }

  const guideTone = useMemo(() => (capturing ? "green" : "brand"), [capturing]);
  const hardError = cameraError || modelError;

  return (
    <AuthCard
      title={reEnroll ? "Update Biometric Profile" : "Enroll 3D Face Template"}
      subtitle="Capturing 5 high-fidelity frames to synthesize your encrypted face vector."
      steps={showRegisterSteps ? REGISTER_STEPS : undefined}
      currentStep={showRegisterSteps ? 2 : undefined}
      wide
    >
      <div className="space-y-5">
        {error && <Alert tone="error">{error}</Alert>}
        {hardError && <Alert tone="error">{hardError}</Alert>}

        <CameraView
          videoRef={videoRef}
          ready={cameraReady}
          error={cameraError}
          scanning={capturing || submitting}
          overlay={<FaceGuide tone={guideTone} />}
        />

        {modelLoading && (
          <div className="flex items-center justify-center gap-2 text-sm text-slate-500 py-2">
            <Spinner className="h-4 w-4 text-brand-600" />
            <span className="font-medium">Loading Neural Vision Mesh…</span>
          </div>
        )}

        {capturing && (
          <div className="animate-fade-in space-y-2 rounded-2xl bg-brand-50/60 p-4 border border-brand-100">
            <div className="flex justify-between text-xs font-semibold text-brand-900">
              <span className="flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-brand-600 animate-spin" />
                Extracting Face Coordinates…
              </span>
              <span>{Math.round(progress * 100)}%</span>
            </div>
            <ProgressBar value={progress} tone="green" />
            <p className="text-center text-xs font-medium text-slate-600 pt-1">{hint ?? "Hold still…"}</p>
          </div>
        )}

        <Alert tone="info" title="Optimal Enrollment Conditions">
          Position yourself in clear, balanced lighting and look straight into the camera.
        </Alert>

        <Button
          fullWidth
          size="lg"
          variant="gradient"
          onClick={run}
          disabled={!canStart}
          loading={submitting}
        >
          {capturing ? (
            <>Capturing Biometrics…</>
          ) : (
            <>
              <Camera className="h-4 w-4" /> {reEnroll ? "Re-capture Face" : "Begin Face Enrollment"}
            </>
          )}
        </Button>

        <p className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          Vectors are encrypted with Fernet encryption; raw video/images are never stored.
        </p>
      </div>
    </AuthCard>
  );
}
