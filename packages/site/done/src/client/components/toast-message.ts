import { css } from "../css.ts";

const STYLES = css(`
  :host {
    position: fixed;
    inset-block-end: 1rem;
    inset-inline-start: 50%;
    transform: translateX(-50%);
    z-index: 1000;
  }
  .content {
    background-color: var(--red-bg);
    color: var(--bg-stronger);
    padding-block: 0.55rem;
    padding-inline: 0.85rem;
  }
`);

/** Auto-dismiss duration in milliseconds */
const DISMISS_MS = 3000;

class ToastMessage extends HTMLElement {
  #shadow: ShadowRoot;
  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
  }

  connectedCallback(): void {
    this.#render();
    this.#timer = setTimeout(() => {
      this.remove();
    }, DISMISS_MS);
  }

  disconnectedCallback(): void {
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
  }

  #render(): void {
    const message = this.getAttribute("message") ?? "";
    this.#shadow.innerHTML = `
      <style>${STYLES}</style>
      <div class="content">${message}</div>
    `;
  }
}

customElements.define("toast-message", ToastMessage);

/**
 * Shows a toast notification that auto-dismisses after 3 seconds.
 * Removes any existing toast before showing the new one.
 * @param message - Text to display in the toast
 */
export function showToast(message: string): void {
  document.querySelector("toast-message")?.remove();

  const toast = document.createElement("toast-message");
  toast.setAttribute("message", message);
  document.body.append(toast);
}
