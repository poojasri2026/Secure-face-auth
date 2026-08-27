import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ScanFace, ShieldCheck, Sparkles } from "lucide-react";
import { AuthCard, MFA_STEPS } from "../components/AuthCard";
import { CameraView, FaceGuide } from "../components/CameraView";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { Spinner } from "../components/ui/Spinner";
import { useCamera } from "../hooks/useCamera";
import { useFaceLandmarker } from "../hooks/useFaceLandmarker";
import { useFaceCapture } from "../hooks/useFaceCapture";
import { faceService } from "../services/faceService";
import { useMfaFlow } from "../context/MfaFlowContext";
import { useAuth } from "../context/AuthContext";
import { errorMessage } from "../utils/errors";

export default function FaceVerifyPage() {
  const navigate = useNavigate();
  const flow = useMfaFlow();
  const { finalizeLogin } = useAuth();

  const { videoRef, ready: cameraReady, error: cameraError } = useCamera(true);
  const { ready: modelReady, loading: modelLoading, error: modelError, detect } =
    useFaceLandmarker();
  const { capturing, hint, captureSequence } = useFaceCapture(videoRef, detect);

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!flow.mfaToken) return <Navigate to="/login" replace />;

  const canVerify = cameraReady && modelReady && !capturing && !submitting;

  async function verify() {
    setError(null);
    setSubmitting(true);
    try {
      const images = await captureSequence(1, { minBoxRatio: 0.1 });
      const res = await faceService.verify(flow.mfaToken as string, images[0]);
      if (!res.access_token) {
        throw new Error(res.message || "Verification did not complete. Please try again.");
      }
      await finalizeLogin(res.access_token);
      flow.reset();
      navigate("/", { replace: true });
    } catch (e) {
      setError(errorMessage(e, "Face verification failed. Please try again."));
    } finally {
      setSubmitting(false);
    }
  }

  const hardError = cameraError || modelError;

  return (
    <AuthCard
      title="Biometric Face Verification"
      subtitle="Final step: secure 3D face vector matching against your encrypted profile."
      steps={MFA_STEPS}
      currentStep={3}
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
          overlay={<FaceGuide tone={capturing ? "green" : "brand"} />}
        />

        {modelLoading && (
          <div className="flex items-center justify-center gap-2 text-sm text-slate-500 py-2">
            <Spinner className="h-4 w-4 text-brand-600" />
            <span>Calibrating Neural Vision Model…</span>
          </div>
        )}

        {capturing && (
          <div className="animate-fade-in flex items-center justify-center gap-2 rounded-xl bg-brand-50/80 p-3 text-xs font-semibold text-brand-700">
            <Sparkles className="h-4 w-4 animate-spin" />
            <span>{hint ?? "Hold still while high-precision vector is extracted…"}</span>
          </div>
        )}

        <Button
          fullWidth
          size="lg"
          variant="gradient"
          onClick={verify}
          disabled={!canVerify}
          loading={submitting}
        >
          <ScanFace className="h-5 w-5" /> Verify & Authorize Session
        </Button>

        <div className="flex items-center justify-center gap-2 text-center text-xs text-slate-400">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>Server-authoritative cosine similarity computation. Embeddings are never exposed.</span>
        </div>
      </div>
    </AuthCard>
  );
}
