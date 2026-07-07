import type { Band } from "./types";

export function bandForScore(score: number): Band {
  if (score >= 80) return "good";
  if (score >= 60) return "warning";
  return "critical";
}

export const bandColorVar: Record<Band, string> = {
  good: "var(--status-good)",
  warning: "var(--status-warning)",
  critical: "var(--status-critical)",
};

export const bandLabel: Record<Band, string> = {
  good: "Good",
  warning: "Needs work",
  critical: "Off target",
};

export function formatErrorType(errorType: string): string | null {
  if (!errorType || errorType.toLowerCase() === "none") return null;
  const spaced = errorType.replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced;
}
