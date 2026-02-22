/**
 * Thin wrapper around `fetch` for calling the JSON API endpoints defined
 * in `server/api/tasks.ts` and `server/api/timer.ts`.
 *
 * Automatically sets `Content-Type: application/json` and shows a toast on error.
 */
import { showToast } from "../components/toast-message.ts";

export { showToast };

export async function api<TResponse = unknown>(path: string, options?: RequestInit): Promise<TResponse> {
  const response = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    const message =
      typeof error === "object" && error !== null && "error" in error && typeof error.error === "string"
        ? error.error
        : "Request failed";
    showToast(message);
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}
