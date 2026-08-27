// Minimal className combiner (avoids a clsx dependency).
export function cn(...parts: Array<unknown>): string {
  return parts.filter(Boolean).join(" ");
}

