/**
 * `<search-bar>` -- sticky bar with a back button and debounced search input.
 * Dispatches a `search` event with `{ query }` after the debounce delay.
 */
import {
  $ as h,
} from '@monochromatic-dev/module-es/ts/types/t object/t htmlElement/f/t string jsx/r s/p n/index.ts';
import { SEARCH_BAR_STYLES, } from './search-bar-styles.ts';

/** Debounce delay for search input in milliseconds */
const SEARCH_DEBOUNCE_MS = 300;

/** Navigates one step back in the browser history. */
function handleBack(): void {
  history.back();
}

/** Sticky search bar with a back button and debounced search input. */
class SearchBar extends HTMLElement {
  /** Shadow root for encapsulated rendering. */
  #shadow: ShadowRoot;

  /** Initializes the shadow root. */
  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open', },);
  }

  /**
   * Current search input value, or empty string when not yet rendered.
   *
   * @returns Search input value
   */
  get value(): string {
    const input = this.#shadow.querySelector<HTMLInputElement>('input',);
    return input?.value ?? '';
  }

  /**
   * Sets the search input value.
   *
   * @param text - New value to display
   */
  set value(text: string,) {
    const input = this.#shadow.querySelector<HTMLInputElement>('input',);
    if (input !== null)
      input.value = text;
  }

  /** Renders the back button and search input, wires up debounced search dispatch. */
  connectedCallback(): void {
    const query = this.getAttribute('value',) ?? '';

    // SVG back arrow built via innerHTML on a container because h() targets
    // HTMLElement creation -- SVG elements require the SVG namespace.
    const backButton = h({
      tag: 'button',
      class: 'back',
      attrs: { 'aria-label': 'Go back', },
      on: { click: handleBack, },
    },);
    backButton.innerHTML =
      `<svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20,6 10,16 20,26"/></svg>`;

    const input = h({
      tag: 'input',
      attrs: { type: 'search', placeholder: 'Search titles, tags, ...', value: query,
        autofocus: '', },
    },);

    // Debounced search dispatch
    const dispatchFn = this.dispatchEvent.bind(this,);
    let timeout: ReturnType<typeof setTimeout> | undefined = undefined;
    input.addEventListener('input', function handleInput(): void {
      clearTimeout(timeout,);
      timeout = setTimeout(function emitSearch(): void {
        dispatchFn(
          new CustomEvent('search', { detail: { query: input.value.trim(), },
            bubbles: true, },),
        );
      }, SEARCH_DEBOUNCE_MS,);
    },);

    this.#shadow.replaceChildren(
      h({ tag: 'style', text: SEARCH_BAR_STYLES, },),
      backButton,
      input,
    );
  }
}

customElements.define('search-bar', SearchBar,);
