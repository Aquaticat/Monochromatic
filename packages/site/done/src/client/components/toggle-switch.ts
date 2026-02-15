class ToggleSwitch extends HTMLElement {
  static observedAttributes = ["on"];

  #shadow: ShadowRoot;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
  }

  get on(): boolean {
    return this.hasAttribute("on");
  }

  set on(value: boolean) {
    if (value) {
      this.setAttribute("on", "");
    } else {
      this.removeAttribute("on");
    }
  }

  connectedCallback(): void {
    this.#render();
    this.addEventListener("click", this.#handleClick);
  }

  disconnectedCallback(): void {
    this.removeEventListener("click", this.#handleClick);
  }

  attributeChangedCallback(): void {
    this.#render();
  }

  #handleClick = (): void => {
    this.on = !this.on;
    this.dispatchEvent(new CustomEvent("change", { detail: { on: this.on }, bubbles: true }));
  };

  #render(): void {
    const isOn = this.on;
    this.#shadow.innerHTML = `
      <style>
        :host {
          display: inline-flex;
          cursor: pointer;
          width: 48px;
          height: 32px;
          flex-shrink: 0;
        }
        .track {
          width: 100%;
          height: 100%;
          border: 1px solid var(--gray-fg, #111);
          border-radius: 999px;
          background: var(--gray-bg, #eee);
          position: relative;
          overflow: hidden;
        }
        .thumb {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 32px;
          height: 32px;
          border-radius: 999px;
          border: 1px solid var(--gray-fg, #111);
          background: var(--gray-bg-stronger, #fff);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1rem;
          transition: left 0.15s, right 0.15s;
          ${isOn ? "right: -1px; left: auto;" : "left: -1px; right: auto;"}
        }
      </style>
      <div class="track">
        <span class="thumb">${isOn ? "\u2713" : "\u2717"}</span>
      </div>
    `;
  }
}

customElements.define("toggle-switch", ToggleSwitch);
