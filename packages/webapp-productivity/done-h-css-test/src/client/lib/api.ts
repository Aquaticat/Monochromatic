/**
 * Thin wrapper around `fetch` for calling the JSON API endpoints defined
 * in `server/api/tasks.ts` and `server/api/timer.ts`.
 *
 * Automatically sets `Content-Type: application/json` and shows a toast on error.
 */
import { showToast } from "../components/toast-message.ts";

export { showToast };

/** HTTP status code indicating no content in response body. */
const HTTP_NO_CONTENT = 204;

/**
 * Sends a fetch request to a JSON API endpoint with standard headers and error handling.
 *
 * @param path - API endpoint path
 *
 * @param options - Optional fetch request configuration
 *
 * @returns Parsed JSON response body, or undefined for 204 responses
 */
export async function api<TResponse = unknown>(path: string, options?: RequestInit): Promise<TResponse> {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (options?.headers !== undefined) {
    new Headers(options.headers).forEach(function applyHeader(value, key) {
      headers.set(key, value);
    });
  }
  const response = await fetch(path, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let error: unknown;
    try {
      error = await response.json();
    }
    catch {
      error = { error: "Request failed" };
    }
    const message =
      typeof error === "object" && error !== null && "error" in error && typeof error.error === "string"
        ? error.error
        : "Request failed";
    showToast(message);
    throw new Error(message);
  }

  if (response.status === HTTP_NO_CONTENT) {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- 204 responses have no body; caller expects TResponse
    return undefined as TResponse;
  }

  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- response JSON matches the TResponse shape by API contract
  return (await response.json()) as TResponse;
}
