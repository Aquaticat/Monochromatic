import { css } from "../css.ts";

const STYLES = css(`
  :host {
    display: block;
    inline-size: 100%;
    position: relative;
  }
  .trigger {
    @apply --button-outlined;
    inline-size: 100%;
    text-align: start;

    &:focus-visible {
      outline-width: 0.125rem;
      outline-style: solid;
      outline-color: var(--fg);
      outline-offset: 0.125rem;
    }
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
  .menu {
    position: absolute;
    inset-block-start: 100%;
    inset-inline-start: 0;
    inline-size: 100%;
    border-width: calc(1 / 16 * 1rem);
    border-style: solid;
    border-color: var(--fg);
    background-color: var(--bg);
    padding-block: 0.25rem;
    padding-inline: 0;
    margin-block: 0;
    margin-inline: 0;
    list-style: none;
    z-index: 10;

    &:not(:popover-open) { display: none; }
  }
  .option {
    padding-block: 0.5rem;
    padding-inline: 0.5rem;
    cursor: pointer;

    &:hover {
      background-color: var(--hover-bg);
    }
  }
`);

const DEFAULT_PRESETS = [
  "Adulting tasks first",
  "Quick wins only",
  "Deep work focus",
];

class FocusDropdown extends HTMLElement {
  #shadow: ShadowRoot;
  #value: string;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
    this.#value = "";
  }

  connectedCallback(): void {
    this.#value = this.getAttribute("value") ?? "Select focus...";
    this.#render();
  }

  #render(): void {
    this.#shadow.innerHTML = `
      <style>${STYLES}</style>
      <button class="trigger">
        <span class="text">${this.#value}</span>
        <span class="divider"></span>
        <span>\u25BC</span>
      </button>
      <ul class="menu" popover="auto">
        ${DEFAULT_PRESETS.map((preset) => `<li class="option">${preset}</li>`).join("")}
      </ul>
    `;

    const trigger = this.#shadow.querySelector(".trigger") as HTMLButtonElement;
    const menu = this.#shadow.querySelector(".menu") as HTMLElement;

    trigger.addEventListener("click", () => {
      menu.togglePopover();
    });

    this.#shadow.querySelectorAll(".option").forEach((option) => {
      option.addEventListener("click", () => {
        const text = option.textContent ?? "";
        this.#value = text;
        const textSpan = this.#shadow.querySelector(".text") as HTMLSpanElement;
        textSpan.textContent = text;
        menu.hidePopover();
        this.dispatchEvent(new CustomEvent("change", { bubbles: true, detail: { value: text } }));
      });
    });
  }
}

customElements.define("focus-dropdown", FocusDropdown);
