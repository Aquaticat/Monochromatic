/** Auto-dismiss duration for toast notifications in milliseconds. */
const DISMISS_MS = 3_000;

/**
 * Fetch wrapper with error toast -- validates the pattern from PLAN.md.
 *
 * @param path - API endpoint path
 *
 * @param options - Optional fetch request configuration
 *
 * @returns Parsed JSON response body
 */
export async function api<T = unknown>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    let err: { error?: string } = { error: "Request failed" };
    try {
      err = await res.json() as { error?: string };
    } catch {
      // Ignore JSON parse failure
    }
    showToast(err.error ?? "Something went wrong");
    throw new Error(err.error);
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- response JSON matches the T shape by API contract
  return res.json() as Promise<T>;
}

/**
 * Shows a toast notification that auto-dismisses after 3 seconds.
 * Removes any existing toast before showing the new one.
 *
 * @param message - Text to display in the toast
 */
export function showToast(message: string): void {
  const existing = document.querySelector(".toast");
  if (existing !== null) existing.remove();

  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.append(el);
  setTimeout(function dismissToast() { el.remove(); }, DISMISS_MS);
}
