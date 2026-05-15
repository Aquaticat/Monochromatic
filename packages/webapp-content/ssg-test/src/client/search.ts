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

import { escapeHtml, } from '@monochromatic-dev/module-hyperscript/ts';

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

/**
 * Lazily loads the Pagefind JS API from the generated bundle.
 *
 * Called on first focus of the search input. Subsequent calls return
 * the cached promise (single-flight). If loading fails (e.g. index not
 * built yet), logs a warning and the cached promise resolves to `undefined`,
 * so subsequent calls short-circuit without retrying the failed import.
 *
 * @returns Pagefind API instance or `undefined` on failure
 */
const loadPagefind: () => Promise<PagefindApi | undefined> = (function initLoader() {
  /** Single-flight cached promise; the IIFE wrapping is required by no-module-root-let. */
  let cached: Promise<PagefindApi | undefined> | undefined = undefined;
  return function loadPagefindCached(): Promise<PagefindApi | undefined> {
    cached ??= (async function importPagefind(): Promise<PagefindApi | undefined> {
      try {
        // Dynamic import from the build-generated Pagefind bundle.
        // This path is created by `pagefind --site dist` and cannot be
        // resolved at bundle time; it must be a runtime import.
        /* oxlint-disable no-unsafe-type-assertion -- Pagefind JS API shape is untyped */
        /** Resolved Pagefind API module imported lazily on first interaction. */
        const api = await import(
          /* webpackIgnore: true */
          // @ts-expect-error; Pagefind bundle is generated at build time by `pagefind --site dist`; no type declarations exist
          '/pagefind/pagefind.js'
        ) as PagefindApi;
        /* oxlint-enable no-unsafe-type-assertion */
        api.init();
        return api;
      }
      catch (error) {
        console.warn(
          'Pagefind search index not available:',
          error,
        );
        return undefined;
      }
    })();
    return cached;
  };
})();

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

  /** Pagefind API handle reused across queries once first loaded. */
  const api = await loadPagefind();
  if (api === undefined) {
    hideResults();
    return;
  }

  /** Debounced response that may be `null` when a newer query supersedes this one. */
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

  /** Capped slice of best matches; over-large result sets get truncated to MAX_RESULTS. */
  const topResults = response.results.slice(
    0,
    MAX_RESULTS,
  );
  /** Per-result metadata fetched in parallel before rendering. */
  const loaded = await Promise.all(
    topResults.map(function loadResultData(result,) {
      return result.data();
    },),
  );

  renderResults(loaded,);
}

//endregion Search execution

//region Keyboard navigation state

/** Mutable holder for the index of the currently highlighted result; `-1` means none. Wrapped in a const object to satisfy no-module-root-let while keeping read+write spread across handlers. */
const navState: { activeIndex: number; } = { activeIndex: -1, };

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
  if ((resultsList === null) || (input === null))
    return;

  /** Snapshot of option elements used for index-based active-descendant updates. */
  const options = resultsList.querySelectorAll<HTMLElement>('[role="option"]',);

  /** Previously active option whose data attribute is cleared before the new one is set. */
  const previous = options[navState.activeIndex];
  if (previous !== undefined)
    delete previous.dataset.active;

  navState.activeIndex = index;

  /** Newly active option marked with `data-active` and scrolled into view. */
  const option = options[navState.activeIndex];
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
  if ((resultsList === null) || (input === null))
    return;

  navState.activeIndex = -1;

  resultsList.innerHTML = results
    .map(function resultToListItem(
      result,
      index,
    ) {
      /** Escaped result title; falls back to the URL when the page has no `<title>`. */
      const title = escapeHtml(result.meta.title ?? result.url,);
      /** Escaped href used both on the link element and on the option's `data-url`. */
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

  navState.activeIndex = -1;
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

if ((input !== null) && (resultsList !== null)) {
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
      /* oxlint-disable no-unsafe-type-assertion -- EventTarget is the input element */
      /** Narrowed event target for the input event; the listener is bound to the input only. */
      const target = event.target as HTMLInputElement;
      /* oxlint-enable no-unsafe-type-assertion */
      void executeSearch(target.value,);
    },
  );

  // Close results when clicking outside the search widget
  document.addEventListener(
    'click',
    function onDocumentClick(event,) {
      /* oxlint-disable no-unsafe-type-assertion -- EventTarget is always a Node in click handlers */
      /** Click target narrowed to Node so containment can be checked against the search root. */
      const target = event.target as Node;
      /* oxlint-enable no-unsafe-type-assertion */
      /** Enclosing search widget element; clicks outside this container dismiss results. */
      const searchContainer = input.closest<HTMLElement>('site-search',);
      if ((searchContainer !== null) && (!searchContainer.contains(target,)))
        hideResults();
    },
  );

  input.addEventListener(
    'keydown',
    function onSearchKeydown(event,) {
      /** Snapshot of option elements used for arrow-key navigation. */
      const options = resultsList.querySelectorAll<HTMLElement>('[role="option"]',);
      /** Cached length used by every navigation branch. */
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
        setActiveOption(
          navState.activeIndex < (count - 1) ? navState.activeIndex + 1 : 0,
        );
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveOption(navState.activeIndex > 0 ? navState.activeIndex - 1 : count - 1,);
        return;
      }

      if ((event.key === 'Enter')
        && (navState.activeIndex >= 0)
        && (navState.activeIndex < count))
      {
        event.preventDefault();
        /** Currently active option whose URL is navigated to on Enter. */
        const option = options[navState.activeIndex];
        if (option !== undefined) {
          /** Destructured `data-url` attribute storing the result href. */
          const { url, } = option.dataset;
          if (url !== undefined)
            globalThis.location.href = url;
        }
      }
    },
  );
}

//endregion Event binding
