import { $ as h } from "@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts";
import { cssCalc, cssPercent, cssRem, cssVar } from "@monochromatic-dev/module-es/h-css";
import { $ as css } from "../css.ts";
import { appearanceNone, flexCenter, focusOutline, minTouchTarget, shadowDomGlobals, stickyBar } from "../mixins.ts";

const STYLES = [
  css({
    rule: ':host',
    decls: stickyBar(),
  }),
  css({
    rule: '.back',
    decls: {
      ...appearanceNone(),
      ...flexCenter(),
      ...minTouchTarget(),
      'font-size': cssRem(1.5),
      color: cssVar('fg'),
    },
    children: [
      css({ rule: '&:focus-visible', decls: focusOutline({ offset: cssRem(-0.125) }) }),
    ],
  }),
  css({
    rule: 'input',
    decls: {
      'flex-grow': 1,
      'border-style': 'none',
      'background-color': 'transparent',
      'font-size': cssRem(1),
      'font-family': 'inherit',
      color: cssVar('fg'),
      'outline-style': 'none',
      'block-size': cssPercent(100),
    },
  }),
  ...shadowDomGlobals(),
  css({
    at: 'media',
    params: '(min-width: 48rem)',
    children: [
      css({
        rule: ':host',
        decls: {
          'border-block-end-width': cssCalc(`${cssRem(1)} / 16`),
          'border-block-end-style': 'solid',
          'border-block-end-color': cssVar('bg-weaker'),
        },
      }),
      css({ rule: '.back', decls: { display: 'none' } }),
      css({ rule: 'input', decls: { 'font-size': cssRem(1.5) } }),
    ],
  }),
].join('');

/** Debounce delay for search input in milliseconds */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * `<search-bar>` -- sticky bar with a back button and debounced search input.
 * Dispatches a `search` event with `{ query }` after the debounce delay.
 */
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

    // SVG back arrow built via innerHTML on a container because h() targets
    // HTMLElement creation -- SVG elements require the SVG namespace.
    const backButton = h({
      tag: "button",
      class: "back",
      attrs: { "aria-label": "Go back" },
      on: { click: () => { history.back(); } },
    });
    backButton.innerHTML = `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20,6 10,16 20,26"/></svg>`;

    const input = h({
      tag: "input",
      attrs: { type: "search", placeholder: "Search titles, tags, ...", value: query, autofocus: "" },
    });

    // Debounced search dispatch
    let timeout: ReturnType<typeof setTimeout>;
    input.addEventListener("input", () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        this.dispatchEvent(new CustomEvent("search", { detail: { query: input.value.trim() }, bubbles: true }));
      }, SEARCH_DEBOUNCE_MS);
    });

    this.#shadow.replaceChildren(
      h({ tag: "style", text: STYLES }),
      backButton,
      input,
    );
  }
}

customElements.define("search-bar", SearchBar);
