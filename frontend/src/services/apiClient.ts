import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  InternalAxiosRequestConfig,
} from "axios";
import { API_ROOT } from "../config";
import { ApiError, ApiErrorShape, TokenResponse } from "../types";

// ---------------------------------------------------------------------------
// In-memory access token. Deliberately NOT persisted to localStorage: the
// refresh token lives in an HttpOnly cookie (invisible to JS) and the access
// token is short-lived and held only in memory. On a full page reload we
// silently re-mint an access token via the refresh cookie (see AuthContext).
// ---------------------------------------------------------------------------
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}
export function getAccessToken(): string | null {
  return accessToken;
}

// AuthContext registers a handler so the app can react (redirect to /login,
// clear user) when the session can no longer be refreshed.
type LogoutHandler = () => void;
let onForcedLogout: LogoutHandler | null = null;
export function registerForcedLogoutHandler(fn: LogoutHandler | null): void {
  onForcedLogout = fn;
}

export const api: AxiosInstance = axios.create({
  baseURL: API_ROOT,
  withCredentials: true, // send/receive the HttpOnly refresh cookie
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((cfg: InternalAxiosRequestConfig) => {
  if (accessToken) {
    cfg.headers.set("Authorization", `Bearer ${accessToken}`);
  }
  return cfg;
});

// ---- Single-flight refresh so a burst of 401s triggers only one refresh ----
let refreshPromise: Promise<string> | null = null;

async function doRefresh(): Promise<string> {
  // Bare axios call (no interceptors) to avoid recursion.
  const resp = await axios.post<TokenResponse>(
    `${API_ROOT}/auth/refresh`,
    {},
    { withCredentials: true }
  );
  const token = resp.data.access_token;
  setAccessToken(token);
  return token;
}

export function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = doRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

interface RetriableConfig extends AxiosRequestConfig {
  _retried?: boolean;
  _skipAuthRefresh?: boolean;
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError<ApiErrorShape>) => {
    const original = error.config as (RetriableConfig & InternalAxiosRequestConfig) | undefined;
    const status = error.response?.status;

    const isAuthEndpoint =
      typeof original?.url === "string" &&
      (original.url.includes("/auth/refresh") ||
        original.url.includes("/auth/login") ||
        original.url.includes("/auth/logout"));

    // Attempt exactly one transparent refresh on an expired/again-unauthorized
    // access token, then retry the original request.
    if (
      status === 401 &&
      original &&
      !original._retried &&
      !original._skipAuthRefresh &&
      !isAuthEndpoint
    ) {
      original._retried = true;
      try {
        const token = await refreshAccessToken();
        original.headers?.set?.("Authorization", `Bearer ${token}`);
        return api(original);
      } catch {
        setAccessToken(null);
        if (onForcedLogout) onForcedLogout();
      }
    }

    return Promise.reject(normalizeError(error));
  }
);

export function normalizeError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const ax = error as AxiosError<ApiErrorShape>;
    const status = ax.response?.status ?? 0;
    const data = ax.response?.data;
    const message =
      (data && typeof data === "object" && "message" in data && (data as ApiErrorShape).message) ||
      ax.message ||
      "Network error. Please try again.";
    const code =
      (data && typeof data === "object" && "error_code" in data && (data as ApiErrorShape).error_code) ||
      (status === 0 ? "NETWORK_ERROR" : "APP_ERROR");
    return new ApiError(String(message), String(code), status);
  }
  if (error instanceof ApiError) return error;
  return new ApiError("Unexpected error.", "UNKNOWN", 0);
}
