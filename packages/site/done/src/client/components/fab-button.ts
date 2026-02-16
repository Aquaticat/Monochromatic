import { css } from "../css.ts";

const STYLES = css(`
  :host {
    position: fixed;
    inset-block-end: 1rem;
    inset-inline-end: calc(50% - calc(393 / 16 * 1rem) / 2 + 1rem);
    z-index: 50;
  }
  button {
    @apply --flex-center;
    @apply --min-touch-target;
    inline-size: 4rem;
    block-size: 4rem;
    @apply --border-radius-full;
    background-color: var(--fg);
    border-width: 0.25rem;
    border-style: solid;
    border-color: var(--bg);
    color: var(--bg);
    font-size: 2rem;
    cursor: pointer;
    line-height: 1.2;
  }
  button:hover { opacity: 0.85; }
  button:focus-visible {
    outline-width: 0.125rem;
    outline-style: solid;
    outline-color: var(--fg);
    outline-offset: 0.125rem;
  }
  @media (min-width: 48rem) {
    :host {
      inset-inline-end: 1rem;
      inset-block-end: 1rem;
    }
  }
`);

class FabButton extends HTMLElement {
  #shadow: ShadowRoot;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
  }

  connectedCallback(): void {
    this.#shadow.innerHTML = `
      <style>${STYLES}</style>
      <button part="button" aria-label="${this.getAttribute("label") ?? "Action"}">
        <slot>+</slot>
      </button>
    `;
  }
}

customElements.define("fab-button", FabButton);
