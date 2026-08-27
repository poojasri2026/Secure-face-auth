import { ReactNode, RefObject } from "react";
import { CameraOff, Scan } from "lucide-react";
import { cn } from "../utils/cn";
import { Spinner } from "./ui/Spinner";

// Presentational wrapper around the webcam <video> with Biometric HUD.
export function CameraView({
  videoRef,
  ready,
  error,
  overlay,
  className,
  scanning = true,
}: {
  videoRef: RefObject<HTMLVideoElement>;
  ready: boolean;
  error?: string | null;
  overlay?: ReactNode;
  className?: string;
  scanning?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-slate-950 shadow-inner ring-1 ring-slate-800",
        className
      )}
    >
      <video
        ref={videoRef}
        playsInline
        muted
        autoPlay
        className="mirror h-full w-full object-cover"
      />

      {/* Cyber/Biometric HUD Corner Brackets */}
      {ready && !error && (
        <>
          <div className="hud-corner hud-corner-tl" />
          <div className="hud-corner hud-corner-tr" />
          <div className="hud-corner hud-corner-bl" />
          <div className="hud-corner hud-corner-br" />

          {/* Animated Biometric Scanning Laser Beam */}
          {scanning && (
            <div className="pointer-events-none absolute left-3 right-3 h-0.5 animate-scan-laser bg-gradient-to-r from-transparent via-brand-400 to-transparent shadow-[0_0_12px_2px_rgba(99,102,241,0.7)]" />
          )}

          {/* Status Indicator Badge on HUD */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-slate-950/70 px-2.5 py-1 text-[10px] font-mono font-medium text-emerald-400 backdrop-blur-md border border-emerald-500/30">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            LIVE FEED
          </div>
        </>
      )}

      {!ready && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/90 text-slate-300">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-500/10 text-brand-400 ring-1 ring-brand-500/30">
            <Scan className="h-6 w-6 animate-pulse" />
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
            <Spinner className="h-3.5 w-3.5 text-brand-400" />
            <span>Initializing Camera Stream…</span>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-950/95 p-6 text-center text-slate-200">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/30">
            <CameraOff className="h-6 w-6" />
          </div>
          <p className="max-w-xs text-xs font-medium text-rose-300">{error}</p>
        </div>
      )}

      {ready && overlay && <div className="pointer-events-none absolute inset-0">{overlay}</div>}
    </div>
  );
}

// A face-positioning oval guide overlay with animated glowing border.
export function FaceGuide({ tone = "brand" }: { tone?: "brand" | "green" | "red" }) {
  const strokeColor =
    tone === "green" ? "#22c55e" : tone === "red" ? "#ef4444" : "#818cf8";
  const glowColor =
    tone === "green"
      ? "rgba(34, 197, 94, 0.4)"
      : tone === "red"
      ? "rgba(239, 68, 68, 0.4)"
      : "rgba(129, 140, 248, 0.4)";

  return (
    <div className="relative h-full w-full">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
        <ellipse
          cx="50"
          cy="48"
          rx="27"
          ry="36"
          fill="none"
          stroke={strokeColor}
          strokeWidth="1.5"
          strokeDasharray="4 2"
          style={{ filter: `drop-shadow(0 0 4px ${glowColor})` }}
          className="transition-colors duration-300 animate-pulse-slow"
        />
      </svg>
    </div>
  );
}
