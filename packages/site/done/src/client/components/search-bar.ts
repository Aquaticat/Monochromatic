import { css } from "../css.ts";

const STYLES = css(`
  :host {
    @apply --sticky-bar;
  }
  .back {
    @apply --appearance-none;
    @apply --flex-center;
    @apply --min-touch-target;
    font-size: 1.5rem;
    color: var(--fg);
  }
  .back:focus-visible {
    outline-width: 0.125rem;
    outline-style: solid;
    outline-color: var(--fg);
    outline-offset: -0.125rem;
  }
  input {
    flex: 1;
    border-style: none;
    background-color: transparent;
    font-size: 1rem;
    font-family: inherit;
    color: var(--fg);
    outline: none;
    block-size: 100%;
  }
  @apply --shadow-dom-globals;
  @media (min-width: 48rem) {
    :host {
      border-block-end-width: calc(1 / 16 * 1rem);
      border-block-end-style: solid;
      border-block-end-color: var(--bg-weaker);
    }
    .back { display: none; }
    input { font-size: 1.5rem; }
  }
`);

class SearchBar extends HTMLElement {
  #shadow: ShadowRoot;

  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
  }

  get value(): string {
    const input = this.#shadow.querySelector("input");
    return input?.value ?? "";
  }

  set value(text: string) {
    const input = this.#shadow.querySelector("input");
    if (input !== null) {
      input.value = text;
    }
  }

  connectedCallback(): void {
    const query = this.getAttribute("value") ?? "";

    this.#shadow.innerHTML = `
      <style>${STYLES}</style>
      <button class="back" aria-label="Go back">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="3">
          <polyline points="20,6 10,16 20,26"/>
        </svg>
      </button>
      <input type="search" placeholder="Search titles, tags, ..." value="${query.replaceAll('"', '&quot;')}" autofocus>
    `;

    this.#shadow.querySelector(".back")?.addEventListener("click", () => {
      history.back();
    });

    const input = this.#shadow.querySelector("input");
    let timeout: ReturnType<typeof setTimeout>;
    input?.addEventListener("input", () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        this.dispatchEvent(new CustomEvent("search", { detail: { query: input.value.trim() }, bubbles: true }));
      }, 300);
    });
  }
}

customElements.define("search-bar", SearchBar);
