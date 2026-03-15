import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";
import { css } from "../css.ts";

/** Shadow DOM styles for the `\<search-bar\>` component. */
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

/** Debounce delay for search input in milliseconds. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * `\<search-bar\>` -- sticky bar with a back button and debounced search input.
 * Dispatches a `search` event with `\{ query \}` after the debounce delay.
 */
class SearchBar extends HTMLElement {
  /** Shadow root for encapsulated rendering. */
  #shadow: ShadowRoot;

  /** Initializes the shadow root. */
  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: "open" });
  }

  /**
   * Current search input value.
   *
   * @returns Text content of the input, or empty string if not rendered
   */
  get value(): string {
    const input = this.#shadow.querySelector<HTMLInputElement>("input");
    return input?.value ?? "";
  }

  /**
   * Sets the search input value programmatically.
   *
   * @param text - New input value
   */
  set value(text: string) {
    const input = this.#shadow.querySelector<HTMLInputElement>("input");
    if (input !== null) {
      input.value = text;
    }
  }

  /** Renders the search bar with back button and debounced input. */
  connectedCallback(): void {
    const query = this.getAttribute("value") ?? "";

    // SVG back arrow built via innerHTML on a container because h() targets
    // HTMLElement creation -- SVG elements require the SVG namespace.
    const backButton = h({
      tag: "button",
      class: "back",
      attrs: { "aria-label": "Go back" },
      on: { click: function onBackClick() { history.back(); } },
    });
    backButton.innerHTML = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20,6 10,16 20,26"/></svg>`;

    const input = h({
      tag: "input",
      attrs: { type: "search", placeholder: "Search titles, tags, ...", value: query, autofocus: "" },
    });

    // Debounced search dispatch
    let timeout: ReturnType<typeof setTimeout> = setTimeout(function noop() { /* initial */ }, 0);
    input.addEventListener("input", function onInput(): void {
      clearTimeout(timeout);
      timeout = setTimeout(function dispatchSearch(): void {
        this.dispatchEvent(new CustomEvent("search", { detail: { query: input.value.trim() }, bubbles: true }));
      }.bind(this), SEARCH_DEBOUNCE_MS);
    }.bind(this));

    this.#shadow.replaceChildren(
      h({ tag: "style", text: STYLES }),
      backButton,
      input,
    );
  }
}

customElements.define("search-bar", SearchBar);
