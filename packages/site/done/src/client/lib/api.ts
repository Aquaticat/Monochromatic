/**
 * Thin wrapper around `fetch` for calling the JSON API endpoints defined
 * in `server/api/tasks.ts` and `server/api/timer.ts`.
 *
 * Automatically sets `Content-Type: application/json` and shows a toast on error.
 */
import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";

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

export function showToast(message: string): void {
  document.querySelector(".toast")?.remove();

  const toastElement = h({ tag: "div", class: "toast", text: message });
  document.body.append(toastElement);
  setTimeout(() => {
    toastElement.remove();
  }, 3000);
}
