import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";
import { css } from "../css.ts";

/** Z-index for toast positioning above page content. */
const TOAST_Z_INDEX = 1_000;

/** Shadow DOM styles for the `\<toast-message\>` component. */
const STYLES = css(`
  :host {
    position: fixed;
    inset-block-end: 1rem;
    inset-inline-start: 50%;
    transform: translateX(-50%);
    z-index: ${String(TOAST_Z_INDEX)};
  }
  .content {
    background-color: var(--red-bg);
    color: var(--bg-stronger);
    padding-block: 0.55rem;
    padding-inline: 0.85rem;
  }
`);

/** Auto-dismiss duration in milliseconds. */
const DISMISS_MS = 3_000;

/**
 * `\<toast-message\>` -- ephemeral notification that auto-dismisses.
 * Reads the `message` attribute for display text.
 */
class ToastMessage extends HTMLElement {
  /** Shadow root for encapsulated rendering. */
  #shadow: ShadowRoot;

  /** Handle for the auto-dismiss timer, or null when not scheduled. */
  #timer: ReturnType<typeof setTimeout> | null = null;

  /** Initializes the shadow root. */
  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
  }

  /** Renders content and schedules auto-removal after `DISMISS_MS`. */
  connectedCallback(): void {
    this.#render();
    // oxlint-disable-next-line no-restricted-syntax/no-arrow-function -- arrow needed: setTimeout callback must reference `this` for self-removal
    this.#timer = setTimeout(() => {
      this.remove();
    }, DISMISS_MS);
  }

  /** Cancels the auto-dismiss timer when the element is removed early. */
  disconnectedCallback(): void {
    if (this.#timer !== null) {
      clearTimeout(this.#timer);
      this.#timer = null;
    }
  }

  /** Renders the toast content into the shadow root. */
  #render(): void {
    const message = this.getAttribute("message") ?? "";
    this.#shadow.replaceChildren(
      h({ tag: "style", text: STYLES }),
      h({ tag: "div", class: "content", text: message }),
    );
  }
}

customElements.define("toast-message", ToastMessage);

/**
 * Shows a toast notification that auto-dismisses after 3 seconds.
 * Removes any existing toast before showing the new one.
 *
 * @param message - Text to display in the toast
 */
export function showToast(message: string): void {
  document.querySelector("toast-message")?.remove();

  const toast = document.createElement("toast-message");
  toast.setAttribute("message", message);
  document.body.append(toast);
}
