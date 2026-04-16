/**
 * Client-side search powered by Pagefind.
 *
 * Lazy-loads the Pagefind JS API on first focus of the search input,
 * performs debounced searches as the user types, and renders results
 * into a dropdown list below the input.
 *
 * Degrades gracefully: if the Pagefind index is missing (e.g. during
 * local development without running `build:search`), the search input
 * remains functional but shows no results.
 *
 * @example
 * ```html
 * <script type="module" src="/client/search.js"></script>
 * ```
 */

export {}; // eslint module boundary marker

//region Types

/**
 * Pagefind search result metadata returned by `result.data()`.
 *
 * Only the fields used by the search UI are declared here.
 */
type PagefindResultData = {
  readonly url: string;
  readonly excerpt: string;
  readonly meta: {
    readonly title?: string;
  };
};

/**
 * Single result entry from `pagefind.search()`.
 *
 * Each result lazily loads its full data via the `data()` method.
 */
type PagefindResult = {
  readonly id: string;
  data(): Promise<PagefindResultData>;
};

/**
 * Response from `pagefind.search()`.
 */
type PagefindSearchResponse = {
  readonly results: readonly PagefindResult[];
};

/**
 * Pagefind JS API surface used by this module.
 *
 * Loaded dynamically from `/pagefind/pagefind.js` at runtime.
 */
type PagefindApi = {
  init(): void;
  search(query: string,): Promise<PagefindSearchResponse>;
  debouncedSearch(
    query: string,
    options: Record<string, unknown>,
    debounceMs: number,
  ): Promise<PagefindSearchResponse | null>;
};

//endregion Types

//region Configuration

/** Maximum number of search results to display. */
const MAX_RESULTS = 8;

/** Debounce delay in milliseconds before executing a search. */
const DEBOUNCE_MS = 200;

//endregion Configuration

//region DOM references

/** Search text input element. */
const input = document.querySelector<HTMLInputElement>('#search-input',);

/** Results dropdown list element. */
const resultsList = document.querySelector<HTMLUListElement>('#search-results',);

//endregion DOM references

//region Pagefind lifecycle

/** Cached Pagefind API instance, loaded once on first focus. */
let pagefindApi: PagefindApi | undefined = undefined;

/** Whether a Pagefind load attempt has already been made. */
let loadAttempted = false;

/**
 * Lazily loads the Pagefind JS API from the generated bundle.
 *
 * Called on first focus of the search input. Subsequent calls return
 * the cached instance. If loading fails (e.g. index not built yet),
 * logs a warning and returns `undefined`.
 *
 * @returns Pagefind API instance or `undefined` on failure
 */
async function loadPagefind(): Promise<PagefindApi | undefined> {
  if (pagefindApi !== undefined)
    return pagefindApi;

  if (loadAttempted)
    return undefined;

  loadAttempted = true;

  try {
    // Dynamic import from the build-generated Pagefind bundle.
    // This path is created by `pagefind --site dist` and cannot be
    // resolved at bundle time -- it must be a runtime import.
    // oxlint-disable-next-line no-unsafe-type-assertion -- Pagefind JS API shape is untyped
    const api = await import(
      /* webpackIgnore: true */
      // @ts-expect-error -- Pagefind bundle is generated at build time by `pagefind --site dist`; no type declarations exist
      '/pagefind/pagefind.js'
    ) as PagefindApi;
    api.init();
    pagefindApi = api;
    return api;
  }
  catch (error) {
    console.warn(
      'Pagefind search index not available:',
      error,
    );
    return undefined;
  }
}

//endregion Pagefind lifecycle

//region Search execution

/**
 * Performs a search and renders results into the dropdown.
 *
 * Uses Pagefind's `debouncedSearch` to coalesce rapid keystrokes.
 * When the query is empty, hides the results dropdown.
 *
 * @param query - search query string from the input
 */
async function executeSearch(query: string,): Promise<void> {
  if (resultsList === null)
    return;

  if (query.trim().length === 0) {
    hideResults();
    return;
  }

  const api = await loadPagefind();
  if (api === undefined) {
    hideResults();
    return;
  }

  const response = await api.debouncedSearch(
    query,
    {},
    DEBOUNCE_MS,
  );

  // `null` means this search was superseded by a newer query
  if (response === null)
    return;

  if (response.results.length === 0) {
    hideResults();
    return;
  }

  const topResults = response.results.slice(
    0,
    MAX_RESULTS,
  );
  const loaded = await Promise.all(
    topResults.map(function loadResultData(result,) {
      return result.data();
    },),
  );

  renderResults(loaded,);
}

//endregion Search execution

//region Keyboard navigation state

/** Index of the currently highlighted result, or -1 when none is active. */
let activeIndex = -1;

/**
 * Updates the visual and ARIA active descendant state.
 *
 * Removes `data-active` from the previously active option, applies it
 * to the new one, and sets `aria-activedescendant` on the input so
 * screen readers announce the focused option.
 *
 * @param index - index of the option to activate, or -1 to clear
 */
function setActiveOption(index: number,): void {
  if (resultsList === null || input === null)
    return;

  const options = resultsList.querySelectorAll<HTMLElement>('[role="option"]',);

  const previous = options[activeIndex];
  if (previous !== undefined)
    delete previous.dataset.active;

  activeIndex = index;

  const option = options[activeIndex];
  if (option !== undefined) {
    option.dataset.active = '';
    option.scrollIntoView({ block: 'nearest', },);
    input.setAttribute(
      'aria-activedescendant',
      option.id,
    );
  }
  else {
    input.removeAttribute('aria-activedescendant',);
  }
}

//endregion Keyboard navigation state

//region Result rendering

/**
 * Escapes HTML special characters to prevent injection when
 * interpolating text into `innerHTML`.
 *
 * @param text - raw text to escape
 *
 * @returns HTML-safe string
 */
function escapeHtml(text: string,): string {
  return text
    .replaceAll(
      '&',
      '&amp;',
    )
    .replaceAll(
      '<',
      '&lt;',
    )
    .replaceAll(
      '>',
      '&gt;',
    )
    .replaceAll(
      '"',
      '&quot;',
    );
}

/**
 * Renders loaded search results into the dropdown list.
 *
 * Replaces all existing list items and shows the dropdown.
 * Each option gets a unique `id` for `aria-activedescendant` referencing.
 * Title and URL are escaped; excerpt is trusted HTML from Pagefind
 * (contains `<mark>` tags for match highlighting).
 *
 * @param results - loaded Pagefind result data entries
 */
function renderResults(results: readonly PagefindResultData[],): void {
  if (resultsList === null || input === null)
    return;

  activeIndex = -1;

  resultsList.innerHTML = results
    .map(function resultToListItem(
      result,
      index,
    ) {
      const title = escapeHtml(result.meta.title ?? result.url,);
      const url = escapeHtml(result.url,);
      return [
        `<li id="search-option-${index}" role="option" data-url="${url}">`,
        `<a href="${url}" tabindex="-1">`,
        `<div class="search-title">${title}</div>`,
        `<div class="search-excerpt">${result.excerpt}</div>`,
        '</a>',
        '</li>',
      ]
        .join('',);
    },)
    .join('',);

  input.setAttribute(
    'aria-expanded',
    'true',
  );
  input.removeAttribute('aria-activedescendant',);
}

/**
 * Hides the results dropdown and clears its content.
 */
function hideResults(): void {
  if (resultsList === null)
    return;

  activeIndex = -1;
  resultsList.innerHTML = '';

  if (input !== null) {
    input.setAttribute(
      'aria-expanded',
      'false',
    );
    input.removeAttribute('aria-activedescendant',);
  }
}

//endregion Result rendering

//region Event binding

if (input !== null && resultsList !== null) {
  input.addEventListener(
    'focus',
    function onSearchFocus() {
      void loadPagefind();
    },
    { once: true, },
  );

  input.addEventListener(
    'input',
    function onSearchInput(event,) {
      // oxlint-disable-next-line no-unsafe-type-assertion -- EventTarget is the input element
      const target = event.target as HTMLInputElement;
      void executeSearch(target.value,);
    },
  );

  // Close results when clicking outside the search widget
  document.addEventListener(
    'click',
    function onDocumentClick(event,) {
      // oxlint-disable-next-line no-unsafe-type-assertion -- EventTarget is always a Node in click handlers
      const target = event.target as Node;
      const searchContainer = input.closest<HTMLElement>('site-search',);
      if (searchContainer !== null && !searchContainer.contains(target,))
        hideResults();
    },
  );

  input.addEventListener(
    'keydown',
    function onSearchKeydown(event,) {
      const options = resultsList.querySelectorAll<HTMLElement>('[role="option"]',);
      const count = options.length;

      if (event.key === 'Escape') {
        hideResults();
        input.blur();
        return;
      }

      if (count === 0)
        return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveOption(activeIndex < count - 1 ? activeIndex + 1 : 0,);
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveOption(activeIndex > 0 ? activeIndex - 1 : count - 1,);
        return;
      }

      if (event.key === 'Enter' && activeIndex >= 0 && activeIndex < count) {
        event.preventDefault();
        const option = options[activeIndex];
        if (option !== undefined) {
          const { url, } = option.dataset;
          if (url !== undefined)
            globalThis.location.href = url;
        }
      }
    },
  );
}

//endregion Event binding
