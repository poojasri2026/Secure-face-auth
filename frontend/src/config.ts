function resolveApiRoot(): string {
  let base = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || "";
  if (!base) {
    return "/api";
  }
  // Strip any trailing slashes
  base = base.replace(/\/+$/, "");
  // If the user already included '/api' at the end, do not duplicate it
  if (base.endsWith("/api")) {
    return base;
  }
  return `${base}/api`;
}

export const API_ROOT = resolveApiRoot();

export const config = {
  apiBaseUrl: (import.meta.env.VITE_API_URL as string | undefined)?.trim() || "",
  appName: (import.meta.env.VITE_APP_NAME as string | undefined)?.trim() || "Secure Face Auth",
  apiPrefix: "/api",
} as const;

