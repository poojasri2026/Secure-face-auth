// Centralised runtime configuration. Only VITE_-prefixed vars reach the browser.
// No secrets are ever placed here.
export const config = {
  // In dev, Vite proxies /api to the backend, so a relative base works and the
  // HttpOnly refresh cookie is same-origin. In production the app is served by
  // nginx which also proxies /api to the backend.
  apiBaseUrl: (import.meta.env.VITE_API_URL as string | undefined)?.trim() || "",
  appName: (import.meta.env.VITE_APP_NAME as string | undefined)?.trim() || "Secure Face Auth",
  apiPrefix: "/api",
} as const;

// Full API root, e.g. "" + "/api" -> "/api" (same-origin via proxy) or
// "http://localhost:8000" + "/api".
export const API_ROOT = `${config.apiBaseUrl}${config.apiPrefix}`;
