import type { ApiError, AssessResponse } from "./types";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");

export class ApiRequestError extends Error {}

export function pingHealth(): void {
  if (!API_BASE) return;
  // Fire-and-forget warm-up ping so a cold start (if any) happens while the
  // evaluator is still reading the page, not when they click "Assess".
  fetch(`${API_BASE}/health`, { cache: "no-store" }).catch(() => {});
}

export async function assessRecording(file: Blob, consent: boolean): Promise<AssessResponse> {
  if (!API_BASE) {
    throw new ApiRequestError(
      "The API URL is not configured. Set NEXT_PUBLIC_API_URL in your environment."
    );
  }

  const form = new FormData();
  form.append("file", file, "recording.wav");
  form.append("consent", consent ? "true" : "false");

  let response: Response;
  try {
    response = await fetch(`${API_BASE}/assess`, {
      method: "POST",
      body: form,
    });
  } catch {
    throw new ApiRequestError(
      "Could not reach the server. Check your connection and try again."
    );
  }

  if (!response.ok) {
    let detail = `Request failed (${response.status}).`;
    try {
      const body = (await response.json()) as ApiError;
      if (body?.detail) detail = body.detail;
    } catch {
      // ignore parse failure, use default detail
    }
    throw new ApiRequestError(detail);
  }

  return (await response.json()) as AssessResponse;
}
