import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";
import { $ as css } from "../css.ts";

const STYLES = [
  css({
    rule: ':host',
    decls: {
      position: 'fixed',
      'inset-block-end': '1rem',
      'inset-inline-start': '50%',
      transform: 'translateX(-50%)',
      'z-index': '1000',
    },
  }),
  css({
    rule: '.content',
    decls: {
      'background-color': 'var(--red-bg)',
      color: 'var(--bg-stronger)',
      'padding-block': '0.55rem',
      'padding-inline': '0.85rem',
    },
  }),
].join('');

/** Auto-dismiss duration in milliseconds */
const DISMISS_MS = 3000;

/**
 * `<toast-message>` -- ephemeral notification that auto-dismisses.
 * Reads the `message` attribute for display text.
 */
class ToastMessage extends HTMLElement {
  #shadow: ShadowRoot;
  #timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
  }

  /** Renders content and schedules auto-removal after `DISMISS_MS`. */
  connectedCallback(): void {
    this.#render();
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
 * @param message - Text to display in the toast
 */
export function showToast(message: string): void {
  document.querySelector("toast-message")?.remove();

  const toast = document.createElement("toast-message");
  toast.setAttribute("message", message);
  document.body.append(toast);
}
