import { css } from "../css.ts";

const STYLES = css(`
  :host {
    @apply --flex-column;
    gap: 0.5rem;
  }
  .heading {
    @apply --flex-row;
    gap: 1rem;
    font-size: 1.25rem;
    font-weight: 400;
    cursor: pointer;
  }
  .icon {
    @apply --flex-center;
    @apply --min-touch-target;
    font-size: 2rem;
  }
  .toggle {
    inline-size: 1.25rem;
    block-size: 1.25rem;
  }
  .content {
    @apply --flex-column;
    gap: var(--gap);
  }
`);

class SectionHeading extends HTMLElement {
  #shadow: ShadowRoot;
  #open = true;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
  }

  get open(): boolean {
    return this.#open;
  }

  connectedCallback(): void {
    this.#render();
    this.#shadow.querySelector(".heading")?.addEventListener("click", this.#toggle);
  }

  #toggle = (): void => {
    this.#open = !this.#open;
    this.#updateToggle();
    this.dispatchEvent(new CustomEvent("toggle", { detail: { open: this.#open }, bubbles: true }));
  };

  #updateToggle(): void {
    const toggle = this.#shadow.querySelector(".toggle");
    if (toggle instanceof HTMLElement) {
      toggle.textContent = this.#open ? "\u25B2" : "\u25BC";
    }
    const content = this.#shadow.querySelector(".content") as HTMLElement | null;
    if (content !== null) {
      content.style.display = this.#open ? "flex" : "none";
    }
  }

  #render(): void {
    const icon = this.getAttribute("icon") ?? "";
    const label = this.getAttribute("label") ?? "";

    this.#shadow.innerHTML = `
      <style>${STYLES}</style>
      <div class="heading">
        <span class="icon">${icon}</span>
        <span>${label}</span>
        <span class="toggle">${this.#open ? "\u25B2" : "\u25BC"}</span>
      </div>
      <div class="content">
        <slot></slot>
      </div>
    `;
  }
}

customElements.define("section-heading", SectionHeading);
