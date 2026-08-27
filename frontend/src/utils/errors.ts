import { ApiError } from "../types";

// Extracts a user-facing message from a thrown API error. The API layer
// normalizes everything to ApiError, but we defensively handle anything else.
export function errorMessage(e: unknown, fallback = "Something went wrong. Please try again."): string {
  if (e instanceof ApiError) return e.message || fallback;
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

export function errorCode(e: unknown): string | null {
  if (e instanceof ApiError) return e.errorCode || null;
  return null;
}
