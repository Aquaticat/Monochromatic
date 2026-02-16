import { css } from "../css.ts";

const STYLES = css(`
  :host {
    display: inline-flex;
    cursor: pointer;
    inline-size: 3rem;
    block-size: 2rem;
  }
  .track {
    inline-size: 100%;
    block-size: 100%;
    border-width: calc(1 / 16 * 1rem);
    border-style: solid;
    border-color: var(--fg);
    @apply --border-radius-full;
    background-color: var(--bg);
    position: relative;
    overflow: hidden;
  }
  .thumb {
    position: absolute;
    inset-block-start: 50%;
    transform: translateY(-50%);
    inline-size: 2rem;
    block-size: 2rem;
    @apply --border-radius-full;
    border-width: calc(1 / 16 * 1rem);
    border-style: solid;
    border-color: var(--fg);
    background-color: var(--bg-stronger);
    @apply --flex-center;
    font-size: 1rem;
    transition: inset-inline-start 0.15s, inset-inline-end 0.15s;
  }
  .thumb.on {
    inset-inline-end: calc(-1 / 16 * 1rem);
    inset-inline-start: auto;
  }
  .thumb.off {
    inset-inline-start: calc(-1 / 16 * 1rem);
    inset-inline-end: auto;
  }
`);

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
      <style>${STYLES}</style>
      <div class="track">
        <span class="thumb ${isOn ? "on" : "off"}">${isOn ? "\u2713" : "\u2717"}</span>
      </div>
    `;
  }
}

customElements.define("toggle-switch", ToggleSwitch);
