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
  const currentToast = document.querySelector(".toast");
  currentToast?.remove();

  const toastElement = document.createElement("div");
  toastElement.className = "toast";
  toastElement.textContent = message;
  document.body.append(toastElement);
  setTimeout(() => {
    toastElement.remove();
  }, 3000);
}
