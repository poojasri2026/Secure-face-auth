import { ChallengeType } from "../types";

export function parseDate(iso?: string | null | Date): Date | null {
  if (!iso) return null;
  if (iso instanceof Date) return Number.isNaN(iso.getTime()) ? null : iso;
  let s = String(iso).trim();
  if (!s) return null;
  // If there's a space separating date and time (e.g. "2026-08-27 08:44:25"), replace with 'T'
  s = s.replace(" ", "T");
  // If no timezone offset or Z suffix is present, backend timestamps are UTC, so append 'Z'
  if (!s.endsWith("Z") && !/[+-]\d{2}(?::?\d{2})?$/.test(s)) {
    s += "Z";
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateTime(iso?: string | null | Date): string {
  const d = parseDate(iso);
  if (!d) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function relativeTime(iso?: string | null | Date): string {
  const d = parseDate(iso);
  if (!d) return "—";
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return "just now";
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDateTime(d);
}

export function humanizeMethod(m: string): string {
  const map: Record<string, string> = {
    PASSWORD: "Password",
    EMAIL_OTP: "Email OTP",
    FACE: "Face match",
    LIVENESS: "Liveness",
    MFA: "Full MFA",
  };
  return map[m] || m;
}

export function humanizeReason(reason?: string | null): string {
  if (!reason) return "";
  return reason.replace(/_/g, " ");
}

const CHALLENGE_LABELS: Record<ChallengeType, string> = {
  blink: "Blink your eyes",
  turn_left: "Turn your head LEFT",
  turn_right: "Turn your head RIGHT",
  tilt_head: "Tilt your head to one side",
  look_up: "Look UP",
  look_down: "Look DOWN",
};

export function challengeLabel(c: string): string {
  return CHALLENGE_LABELS[c as ChallengeType] || c;
}

const CHALLENGE_HINTS: Record<ChallengeType, string> = {
  blink: "Look at the camera and blink naturally.",
  turn_left: "Slowly rotate your head to your left, then back to centre.",
  turn_right: "Slowly rotate your head to your right, then back to centre.",
  tilt_head: "Tip your head toward one shoulder, then straighten up.",
  look_up: "Raise your chin to look up, then return to centre.",
  look_down: "Lower your chin to look down, then return to centre.",
};

export function challengeHint(c: string): string {
  return CHALLENGE_HINTS[c as ChallengeType] || "";
}
