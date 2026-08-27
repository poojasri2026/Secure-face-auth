import { useCallback, useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Play,
  Timer,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  Eye,
  RotateCw,
  Sparkles,
} from "lucide-react";
import { AuthCard, MFA_STEPS } from "../components/AuthCard";
import { CameraView, FaceGuide } from "../components/CameraView";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { ProgressBar } from "../components/ui/ProgressBar";
import { Spinner } from "../components/ui/Spinner";
import { useCamera } from "../hooks/useCamera";
import { useFaceLandmarker } from "../hooks/useFaceLandmarker";
import { useLivenessCapture } from "../hooks/useLivenessCapture";
import { livenessService } from "../services/livenessService";
import { useMfaFlow } from "../context/MfaFlowContext";
import { challengeHint, challengeLabel } from "../utils/format";
import { errorMessage } from "../utils/errors";
import { ChallengeSample } from "../types";

type Phase = "loading" | "ready" | "capturing" | "checking" | "transition" | "error";

interface Session {
  token: string;
  challenges: string[];
  timeout: number;
}

function checkChallengeSatisfied(challenge: string, samples: ChallengeSample[]): boolean {
  if (samples.length < 3) return false;

  if (challenge === "blink") {
    const ears = samples.map((s) => s.ear).filter((e): e is number => e !== null);
    if (ears.length < 3) return false;
    const minE = Math.min(...ears);
    const maxE = Math.max(...ears);
    const range = maxE - minE;
    return (minE <= 0.24 && range >= 0.025) || (minE <= maxE * 0.84 && range >= 0.022);
  }

  if (challenge === "turn_left") {
    const yaws = samples.map((s) => s.yaw).filter((y): y is number => y !== null);
    if (yaws.length < 2) return false;
    const lo = Math.min(...yaws);
    const hi = Math.max(...yaws);
    return lo <= -6.0 || (hi - lo) >= 8.4;
  }

  if (challenge === "turn_right") {
    const yaws = samples.map((s) => s.yaw).filter((y): y is number => y !== null);
    if (yaws.length < 2) return false;
    const lo = Math.min(...yaws);
    const hi = Math.max(...yaws);
    return hi >= 6.0 || (hi - lo) >= 8.4;
  }

  if (challenge === "tilt_head") {
    const rolls = samples.map((s) => s.roll).filter((r): r is number => r !== null);
    if (rolls.length < 2) return false;
    const lo = Math.min(...rolls);
    const hi = Math.max(...rolls);
    return Math.max(Math.abs(lo), Math.abs(hi)) >= 5.5 || (hi - lo) >= 7.8;
  }

  if (challenge === "look_up") {
    const pitches = samples.map((s) => s.pitch).filter((p): p is number => p !== null);
    if (pitches.length < 2) return false;
    const lo = Math.min(...pitches);
    const hi = Math.max(...pitches);
    return hi >= 5.5 || (hi - lo) >= 7.2;
  }

  if (challenge === "look_down") {
    const pitches = samples.map((s) => s.pitch).filter((p): p is number => p !== null);
    if (pitches.length < 2) return false;
    const lo = Math.min(...pitches);
    const hi = Math.max(...pitches);
    return lo <= -5.5 || (hi - lo) >= 7.2;
  }

  return false;
}

export default function LivenessPage() {
  const navigate = useNavigate();
  const flow = useMfaFlow();

  const [phase, setPhase] = useState<Phase>("loading");
  const [session, setSession] = useState<Session | null>(null);
  const [index, setIndex] = useState(0);
  const [completed, setCompleted] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);
  const [actionDetected, setActionDetected] = useState(false);
  const [nextCountdown, setNextCountdown] = useState<number | null>(null);

  const startedRef = useRef(false);
  const submittingRef = useRef(false);
  const submitRef = useRef<() => void>(() => undefined);
  const currentChallengeRef = useRef<string | undefined>(undefined);
  const phaseRef = useRef<Phase>(phase);

  phaseRef.current = phase;

  const total = session?.challenges.length ?? flow.challenges.length ?? 0;
  const currentChallenge = session?.challenges[index];
  currentChallengeRef.current = currentChallenge;

  const onSample = useCallback((samples: ChallengeSample[]) => {
    if (phaseRef.current !== "capturing" || submittingRef.current) return;
    const ch = currentChallengeRef.current;
    if (!ch) return;

    if (checkChallengeSatisfied(ch, samples)) {
      submittingRef.current = true;
      setActionDetected(true);
      setTimeout(() => {
        submitRef.current();
      }, 160);
    }
  }, []);

  const { videoRef, ready: cameraReady, error: cameraError } = useCamera(true);
  const { ready: modelReady, loading: modelLoading, error: modelError, detect } =
    useFaceLandmarker();
  const { metrics, begin, end, cancel } = useLivenessCapture(videoRef, detect, onSample);

  useEffect(() => () => cancel(), [cancel]);

  useEffect(() => {
    if (startedRef.current || !flow.mfaToken) return;
    startedRef.current = true;
    (async () => {
      try {
        const res = await livenessService.start(flow.mfaToken as string);
        const s: Session = {
          token: res.liveness_token,
          challenges: res.challenges as string[],
          timeout: res.per_challenge_timeout_seconds,
        };
        setSession(s);
        flow.setLiveness(s.token, s.challenges, s.timeout);
        setPhase("ready");
      } catch (e) {
        setFatal(errorMessage(e, "Could not start the liveness check."));
        setPhase("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = useCallback(async () => {
    if (phaseRef.current !== "capturing" || !session || !currentChallenge) return;
    const samples = end();
    submittingRef.current = false;
    setActionDetected(false);

    if (samples.length === 0) {
      setPhase("ready");
      setMessage("No camera signal was captured. Make sure your face is visible and try again.");
      return;
    }
    setPhase("checking");
    setMessage(null);
    try {
      const res = await livenessService.submitChallenge(session.token, currentChallenge, samples);
      setCompleted(res.completed_count);
      if (res.passed && res.finished) {
        await livenessService.complete(flow.mfaToken as string, session.token);
        navigate("/face-verify", { replace: true });
        return;
      }
      if (res.passed) {
        setIndex((i) => i + 1);
        setPhase("transition");
        setMessage("Awesome — challenge verified!");
        setNextCountdown(2);
      } else {
        setPhase("ready");
        setMessage(res.message || "Action not clearly detected. Please try again with a steady, natural movement.");
      }
    } catch (e) {
      setFatal(errorMessage(e, "The liveness check failed. Please sign in and try again."));
      setPhase("error");
    }
  }, [session, currentChallenge, end, flow.mfaToken, navigate]);

  useEffect(() => {
    submitRef.current = submit;
  }, [submit]);

  const startChallenge = useCallback(() => {
    if (!session) return;
    setMessage(null);
    setActionDetected(false);
    submittingRef.current = false;
    setNextCountdown(null);
    begin();
    setSecondsLeft(session.timeout);
    setPhase("capturing");
  }, [session, begin]);

  useEffect(() => {
    if (phase !== "transition" || nextCountdown === null) return;
    if (nextCountdown <= 0) {
      startChallenge();
      return;
    }
    const timer = setTimeout(() => {
      setNextCountdown((c) => (c !== null ? c - 1 : null));
    }, 900);
    return () => clearTimeout(timer);
  }, [phase, nextCountdown, startChallenge]);

  useEffect(() => {
    if (phase !== "capturing") return;
    if (secondsLeft <= 0) {
      submitRef.current();
      return;
    }
    const id = setInterval(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [phase, secondsLeft]);

  if (!flow.mfaToken) return <Navigate to="/login" replace />;

  if (phase === "error") {
    return (
      <AuthCard title="Liveness Check" subtitle="Verify live physical presence." steps={MFA_STEPS} currentStep={2}>
        <div className="space-y-4">
          <Alert tone="error">{fatal}</Alert>
          <Button
            fullWidth
            size="lg"
            onClick={() =>
              navigate("/login", {
                replace: true,
                state: { notice: "Please sign in again to restart verification." },
              })
            }
          >
            Back to sign in
          </Button>
        </div>
      </AuthCard>
    );
  }

  const hardError = cameraError || modelError;
  const faceVisible = (metrics?.faceCount ?? 0) === 1;

  const renderChallengeIcon = (ch?: string) => {
    switch (ch) {
      case "turn_left":
        return <ArrowLeft className="h-6 w-6 text-brand-600 animate-pulse" />;
      case "turn_right":
        return <ArrowRight className="h-6 w-6 text-brand-600 animate-pulse" />;
      case "look_up":
        return <ArrowUp className="h-6 w-6 text-brand-600 animate-pulse" />;
      case "look_down":
        return <ArrowDown className="h-6 w-6 text-brand-600 animate-pulse" />;
      case "tilt_head":
        return <RotateCw className="h-6 w-6 text-brand-600 animate-spin" />;
      case "blink":
        return <Eye className="h-6 w-6 text-brand-600 animate-bounce" />;
      default:
        return <Sparkles className="h-6 w-6 text-brand-600" />;
    }
  };

  return (
    <AuthCard
      title="Anti-Spoof Liveness Check"
      subtitle="Follow the real-time biometric instructions on screen."
      steps={MFA_STEPS}
      currentStep={2}
      wide
    >
      <div className="space-y-5">
        {hardError && <Alert tone="error">{hardError}</Alert>}
        {message && <Alert tone="info">{message}</Alert>}

        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-600">
          <span>
            Challenge {Math.min(index + 1, total)} of {total}
          </span>
          <span className="text-brand-600">{completed} of {total} completed</span>
        </div>
        <ProgressBar value={total ? completed / total : 0} tone="green" />

        <div className="relative">
          <CameraView
            videoRef={videoRef}
            ready={cameraReady}
            error={cameraError}
            scanning={phase === "capturing"}
            overlay={
              <FaceGuide
                tone={
                  actionDetected
                    ? "green"
                    : phase === "capturing"
                    ? (faceVisible ? "green" : "red")
                    : "brand"
                }
              />
            }
          />

          {/* Real-time status pill overlay over video */}
          {phase === "capturing" && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20">
              {actionDetected ? (
                <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-600 text-white text-xs font-bold shadow-glow-green backdrop-blur-md animate-bounce">
                  <CheckCircle2 className="h-4 w-4 stroke-[2.5]" />
                  Movement Verified! Processing...
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-950/80 text-slate-100 text-xs font-mono font-medium backdrop-blur-md border border-slate-700/60 shadow-lg">
                  <Timer className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
                  <span>{secondsLeft}s remaining</span>
                </div>
              )}
            </div>
          )}
        </div>

        {(phase === "loading" || modelLoading) && (
          <div className="flex items-center justify-center gap-2.5 text-sm text-slate-500 py-3 rounded-2xl bg-slate-50 border border-slate-100">
            <Spinner className="h-4 w-4 text-brand-600" />
            <span className="font-medium">{phase === "loading" ? "Initializing challenges…" : "Calibrating Neural Vision Model…"}</span>
          </div>
        )}

        {currentChallenge && phase !== "loading" && phase !== "transition" && (
          <div
            className={`rounded-2xl border p-5 text-center transition-all duration-300 ${
              actionDetected
                ? "border-emerald-300 bg-emerald-50/70 shadow-glow-green"
                : "border-slate-200/80 bg-gradient-to-b from-slate-50/80 to-white shadow-sm"
            }`}
          >
            <div className="flex items-center justify-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 shadow-sm ring-1 ring-brand-100">
                {renderChallengeIcon(currentChallenge)}
              </div>
              <p className="text-lg font-bold text-slate-900">{challengeLabel(currentChallenge)}</p>
            </div>
            <p className="mt-1.5 text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              {challengeHint(currentChallenge)}
            </p>
          </div>
        )}

        {phase === "transition" && (
          <div className="animate-fade-in rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50/90 to-emerald-100/40 p-5 text-center shadow-sm">
            <div className="flex items-center justify-center gap-2 text-emerald-800 font-bold text-base">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              <span>Challenge Passed!</span>
            </div>
            <p className="mt-1 text-xs text-emerald-700 font-medium">
              Next challenge begins in {nextCountdown ?? 1}s…
            </p>
            <div className="mt-3">
              <Button size="sm" onClick={startChallenge}>
                Continue Now
              </Button>
            </div>
          </div>
        )}

        {phase === "capturing" ? (
          <div className="space-y-3 pt-1">
            {!faceVisible && (
              <p className="text-center text-xs font-semibold text-amber-600 animate-pulse">
                Align your face inside the targeting guide oval.
              </p>
            )}
            <p className="text-center text-xs text-slate-400">
              Movement is auto-detected, or confirm manually:
            </p>
            <Button
              fullWidth
              size="lg"
              variant="secondary"
              loading={actionDetected}
              onClick={() => submitRef.current()}
            >
              <CheckCircle2 className="h-4 w-4" />
              {actionDetected ? "Verifying..." : "Action Completed"}
            </Button>
          </div>
        ) : phase !== "transition" ? (
          <Button
            fullWidth
            size="lg"
            variant="gradient"
            onClick={startChallenge}
            loading={phase === "checking"}
            disabled={!cameraReady || !modelReady || phase === "checking"}
          >
            <Play className="h-4 w-4 fill-white" />
            {completed === 0 ? "Start Liveness Check" : "Start Next Challenge"}
          </Button>
        ) : null}
      </div>
    </AuthCard>
  );
}
