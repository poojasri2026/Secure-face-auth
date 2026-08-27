// Types mirroring the backend API contract (see backend/app/schemas/*).
// Kept in sync by hand; the backend remains the single source of truth for
// every authentication decision.

export type NextStep =
  | "verify_email"
  | "enroll_face"
  | "verify_otp"
  | "liveness"
  | "face_verify";

export type ChallengeType =
  | "blink"
  | "turn_left"
  | "turn_right"
  | "tilt_head"
  | "look_up"
  | "look_down";

export type AuthMethod = "PASSWORD" | "EMAIL_OTP" | "FACE" | "LIVENESS" | "MFA";
export type AuthStatus = "SUCCESS" | "FAILED" | "BLOCKED";

// ---- Users ----
export interface UserSummary {
  id: string;
  full_name: string;
  email: string;
  is_admin: boolean;
}

export interface User {
  id: string;
  full_name: string;
  email: string;
  is_email_verified: boolean;
  is_face_enrolled: boolean;
  is_active: boolean;
  is_admin: boolean;
  created_at: string;
  last_login_at?: string | null;
}

export interface SecurityStatus {
  email_verified: boolean;
  face_enrolled: boolean;
  liveness_protection: boolean;
  mfa_enabled: boolean;
  active_sessions: number;
  last_login_at?: string | null;
}

export interface LoginHistoryItem {
  id: string;
  authentication_method: AuthMethod | string;
  status: AuthStatus | string;
  ip_address?: string | null;
  user_agent?: string | null;
  failure_reason?: string | null;
  created_at: string;
}

export interface LoginHistoryResponse {
  success: boolean;
  items: LoginHistoryItem[];
  total: number;
}

// ---- Generic envelopes ----
export interface SuccessResponse {
  success: boolean;
  message: string;
  data?: unknown;
}

export interface ApiErrorShape {
  success: false;
  message: string;
  error_code?: string;
}

// A normalized error thrown by the API layer.
export class ApiError extends Error {
  errorCode: string;
  status: number;
  constructor(message: string, errorCode: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.errorCode = errorCode;
    this.status = status;
  }
}

// ---- Auth flow ----
export interface RegisterResponse {
  success: boolean;
  message: string;
  email: string;
  next_step: NextStep;
}

export interface EmailVerifiedResponse {
  success: boolean;
  message: string;
  enrollment_token: string;
  next_step: NextStep;
}

export interface MfaStepResponse {
  success: boolean;
  message: string;
  mfa_token?: string | null;
  enrollment_token?: string | null;
  state?: string | null;
  next_step?: NextStep | string | null;
}

export interface TokenResponse {
  success: boolean;
  message: string;
  access_token: string;
  token_type: string;
  expires_in: number;
  user: UserSummary;
}

// ---- Liveness ----
export interface ChallengeSample {
  t: number; // ms timestamp
  ear?: number | null;
  yaw?: number | null;
  pitch?: number | null;
  roll?: number | null;
  face_count: number;
  confidence: number;
  box_ratio: number;
}

export interface LivenessStartResponse {
  success: boolean;
  message: string;
  liveness_token: string;
  challenges: ChallengeType[] | string[];
  total_challenges: number;
  per_challenge_timeout_seconds: number;
  expires_at: string;
}

export interface LivenessChallengeResponse {
  success: boolean;
  message: string;
  challenge: string;
  passed: boolean;
  completed_count: number;
  total_challenges: number;
  next_challenge?: string | null;
  finished: boolean;
  score?: number | null;
}

export interface LivenessCompleteResponse {
  success: boolean;
  message: string;
  state?: string | null;
  next_step?: NextStep | string | null;
}

// ---- Face ----
export interface FaceEnrollResponse {
  success: boolean;
  message: string;
  samples_accepted: number;
  is_face_enrolled: boolean;
}

export interface FaceVerifyResponse {
  success: boolean;
  message: string;
  access_token?: string | null;
  token_type?: string | null;
  expires_in?: number | null;
  state?: string | null;
}

// ---- Admin ----
export interface AdminStats {
  total_users: number;
  verified_users: number;
  face_enrolled_users: number;
  failed_logins: number;
  successful_mfa: number;
  blocked_attempts: number;
  active_sessions: number;
}

export interface DailyActivity {
  date: string;
  success: number;
  failed: number;
  blocked: number;
}

export interface AuthLog {
  id: string;
  user_id?: string | null;
  email?: string | null;
  authentication_method: AuthMethod | string;
  status: AuthStatus | string;
  ip_address?: string | null;
  user_agent?: string | null;
  failure_reason?: string | null;
  created_at: string;
}

export interface AdminDashboardResponse {
  success: boolean;
  stats: AdminStats;
  login_activity: DailyActivity[];
  mfa_success: number;
  mfa_failed: number;
  recent_events: AuthLog[];
}

export interface AdminUser {
  id: string;
  full_name: string;
  email: string;
  is_active: boolean;
  is_email_verified: boolean;
  is_face_enrolled: boolean;
  is_admin: boolean;
  mfa_enabled: boolean;
  last_login_at?: string | null;
  created_at: string;
}

export interface AdminUsersResponse {
  success: boolean;
  items: AdminUser[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminLogsResponse {
  success: boolean;
  items: AuthLog[];
  total: number;
  page: number;
  page_size: number;
}
