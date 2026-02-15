import { css } from "../css.macro.ts" with { type: "macro" };

const STYLES = css(`
  :host {
    display: block;
    inline-size: 100%;
  }
  button {
    @apply --button-outlined;
    inline-size: 100%;
    text-align: start;
  }
  button:focus-visible {
    outline-width: 0.125rem;
    outline-style: solid;
    outline-color: var(--fg);
    outline-offset: 0.125rem;
  }
  .text {
    flex: 1;
    text-align: start;
  }
  .divider {
    inline-size: calc(1 / 16 * 1rem);
    block-size: 100%;
    background-color: var(--fg-weaker);
  }
`);

class FocusDropdown extends HTMLElement {
  #shadow: ShadowRoot;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
  }

  connectedCallback(): void {
    const text = this.getAttribute("value") ?? "Select focus...";

    this.#shadow.innerHTML = `
      <style>${STYLES}</style>
      <button>
        <span class="text">${text}</span>
        <span class="divider"></span>
        <span>\u25BC</span>
      </button>
    `;
  }
}

customElements.define("focus-dropdown", FocusDropdown);
