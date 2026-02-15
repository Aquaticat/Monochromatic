class FocusDropdown extends HTMLElement {
  #shadow: ShadowRoot;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
  }

  connectedCallback(): void {
    const text = this.getAttribute("value") ?? "Select focus...";

    this.#shadow.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
        }
        button {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          border: 1px solid var(--gray-fg, #111);
          padding: 0.5rem;
          height: 48px;
          background: transparent;
          color: var(--gray-fg, #111);
          font: inherit;
          cursor: pointer;
          width: 100%;
          text-align: left;
        }
        .text {
          flex: 1;
          text-align: left;
        }
        .divider {
          width: 1px;
          height: 100%;
          background: var(--gray-fg-weaker, #444);
        }
      </style>
      <button>
        <span class="text">${text}</span>
        <span class="divider"></span>
        <span>\u25BC</span>
      </button>
    `;
  }
}

customElements.define("focus-dropdown", FocusDropdown);
