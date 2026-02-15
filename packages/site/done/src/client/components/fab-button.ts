class FabButton extends HTMLElement {
  #shadow: ShadowRoot;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
  }

  connectedCallback(): void {
    this.#shadow.innerHTML = `
      <style>
        :host {
          position: fixed;
          bottom: 1rem;
          right: calc(50% - 196px + 1rem);
          z-index: 50;
        }
        button {
          width: 64px;
          height: 64px;
          border-radius: 999px;
          background: var(--gray-fg, #111);
          border: 4px solid var(--gray-bg, #eee);
          color: var(--gray-bg, #eee);
          font-size: 2rem;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          line-height: 1;
        }
        button:hover { opacity: 0.85; }
        @media (min-width: 768px) {
          :host {
            right: 1rem;
            bottom: 1rem;
          }
        }
      </style>
      <button part="button" aria-label="${this.getAttribute("label") ?? "Action"}">
        <slot>+</slot>
      </button>
    `;
  }
}

customElements.define("fab-button", FabButton);
