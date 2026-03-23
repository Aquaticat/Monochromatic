/**
 * `<search-overlay>` web component.
 *
 * Self-contained modal search dialog that detects double-Shift internally.
 * Shows file-path matches above content matches.
 * Prefix the query with `%` to search file contents only.
 *
 * Dispatches a `result-select` CustomEvent with `{ path, line? }` when
 * the user picks a result via Enter or click. Escape closes the overlay.
 *
 * The parent application only needs to set two callbacks:
 * - `onSearch` — performs the search and returns results
 * - `getRootDir` — returns the current search scope directory for display
 */

// oxlint-disable max-lines -- web component with dialog, double-shift detection, input handling, result rendering, and keyboard navigation; splitting fractures the component

import {
  $ as h,
} from '@monochromatic-dev/module-es/h-dom';

import type { SearchResult, } from '../protocol.ts';
import { l as rootLogger, tagged, } from './log.ts';
import { middleOut, } from './middle-out.ts';
import { STYLES, } from './search-overlay.styles.ts';

/** Tagged logger for the search overlay subsystem. */
const l = tagged({ tag: 'search-overlay', l: rootLogger, },);

/** Debounce delay for search input in milliseconds: 150 = 2 * 3 * 5 * 5. */
const DEBOUNCE_MS = 2 * (2 + 1) * (2 * 2 + 1) * (2 * 2 + 1);

/**
 * Maximum milliseconds between two Shift keyup events to count as a double-shift.
 * 400 = 16 * 25 = 2^4 * 5^2.
 */
const DOUBLE_SHIFT_THRESHOLD_MS = 2 * 2 * 2 * 2 * (2 * 2 + 1) * (2 * 2 + 1);

/** Detail payload for the `result-select` custom event. */
export type ResultSelectDetail = {
  /** Absolute file path to open. */
  path: string;
  /** 1-based line number to scroll to, present for content matches. */
  line: number | undefined;
};

/**
 * `<search-overlay>` — self-contained modal search dialog.
 *
 * Detects double-Shift internally and opens itself. Set `onSearch` and
 * `getRootDir` callbacks, then listen for `result-select` events.
 */
export class SearchOverlay extends HTMLElement {
  /** Shadow root for encapsulated rendering. */
  #shadow: ShadowRoot;

  /** The native `<dialog>` element. */
  #dialog: HTMLDialogElement | null = null;

  /** The search text input. */
  #input: HTMLInputElement | null = null;

  /** Container for search result items. */
  #resultsContainer: HTMLDivElement | null = null;

  /** Index of the currently keyboard-selected result, or -1 for none. */
  #selectedIndex = -1;

  /** Current search results for keyboard navigation. */
  #results: SearchResult[] = [];

  /** Root directory path snapshot, set when the overlay opens. */
  #rootDir = '';

  /** Debounce timer ID for search input. */
  #debounceTimer = 0;

  /** Monotonic counter incremented on each search; stale responses are discarded. */
  #searchGeneration = 0;

  /** Cached monospace character width in pixels, measured when the dialog opens. */
  #charWidthPx = 0;

  /** Timestamp of the last Shift keyup event, or 0 when reset. */
  #lastShiftUp = 0;

  /** Whether a non-Shift key was pressed between two Shift keyups. */
  #interveningKey = false;

  /** Callback that performs a search and returns results. Set by the parent application. */
  onSearch: ((query: string,) => Promise<SearchResult[]>) | null = null;

  /** Callback that returns the current search scope directory. Set by the parent application. */
  getRootDir: (() => string) | null = null;

  /** Initializes the shadow root. */
  constructor() {
    super();
    this.#shadow = this.attachShadow({ mode: 'open', },);
  }

  /** Renders the dialog and attaches document-level keyboard listeners for double-shift. */
  connectedCallback(): void {
    const overlay = this;

    this.#input = h({
      tag: 'input',
      class: 'search-input',
      attrs: {
        type: 'text',
        placeholder: 'Search files... (prefix with % for content only)',
        autocomplete: 'off',
      },
      on: {
        input: function handleInput() {
          overlay.#scheduleSearch();
        },
        keydown: function handleInputKeydown(event,) {
          overlay.#handleKeydown(event,);
        },
        blur: function handleInputBlur(event,) {
          const related = event.relatedTarget;
          if (related === null || !(related instanceof Node) || overlay.#dialog?.contains(related,) !== true)
            overlay.#close();
        },
      },
    },);

    this.#resultsContainer = h({ tag: 'div', class: 'results', },);

    this.#dialog = h({
      tag: 'dialog',
      children: [this.#input, this.#resultsContainer,],
      on: {
        close: function handleClose() {
          l.info('overlay closed',);
        },
      },
    },);

    this.#shadow.replaceChildren(
      h({ tag: 'style', text: STYLES, },),
      this.#dialog,
    );

    document.addEventListener('keydown', function handleGlobalKeydown(event,) {
      if (event.key !== 'Shift')
        overlay.#interveningKey = true;
    },);

    document.addEventListener('keyup', function handleGlobalKeyup(event,) {
      if (event.key !== 'Shift')
        return;

      const now = Date.now();

      if (!overlay.#interveningKey && overlay.#lastShiftUp > 0
        && now - overlay.#lastShiftUp < DOUBLE_SHIFT_THRESHOLD_MS) {
        overlay.#lastShiftUp = 0;
        overlay.#interveningKey = false;
        overlay.#show();
        return;
      }

      overlay.#lastShiftUp = now;
      overlay.#interveningKey = false;
    },);
  }

  /** Opens the overlay: snapshots rootDir, clears state, shows the modal, focuses input. */
  #show(): void {
    this.#rootDir = this.getRootDir?.() ?? '';

    if (this.#dialog === null || this.#input === null || this.#resultsContainer === null)
      return;

    this.#input.value = '';
    this.#resultsContainer.replaceChildren();
    this.#results = [];
    this.#selectedIndex = -1;
    this.#dialog.showModal();
    this.#measureCharWidth();
    this.#input.focus();
    l.info('overlay opened',);
  }

  /**
   * Closes the search overlay.
   * No need to clear `CSS.highlights` here: the dialog is hidden so
   * registered ranges are invisible, and `#highlightMatches` overwrites
   * the registration on the next render anyway.
   */
  #close(): void {
    if (this.#dialog === null)
      return;

    this.#dialog.close();
  }

  /**
   * Measures the width of a single monospace character using canvas text metrics.
   * Called when the dialog opens so the budget tracks the current size.
   */
  #measureCharWidth(): void {
    if (this.#dialog === null)
      return;

    const { font, } = getComputedStyle(this.#dialog,);
    const canvas = document.createElement('canvas',);
    const ctx = canvas.getContext('2d',);
    if (ctx === null)
      return;

    ctx.font = font;
    this.#charWidthPx = ctx.measureText('0',).width;
  }

  /**
   * Computes the character budget for middle-out path truncation
   * based on the actual pixel width of the results container.
   *
   * @returns number of monospace characters that fit in one result row
   */
  #charBudget(): number {
    if (this.#charWidthPx <= 0 || this.#resultsContainer === null)
      return 0;

    return Math.floor(this.#resultsContainer.clientWidth / this.#charWidthPx,);
  }

  /**
   * Schedules a debounced search after the user types.
   * Cancels any previously scheduled search to coalesce rapid keystrokes.
   */
  #scheduleSearch(): void {
    globalThis.clearTimeout(this.#debounceTimer,);
    const overlay = this;
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- globalThis.setTimeout returns NodeJS.Timeout when Node types are loaded; client-only code always receives a number
    this.#debounceTimer = globalThis.setTimeout(function executeSearch() {
      void overlay.#performSearch();
    }, DEBOUNCE_MS,) as unknown as number;
  }

  /**
   * Reads the input value, invokes `onSearch`, and filters results.
   * Increments a generation counter to discard results from superseded searches.
   * When the input starts with `%`, file-path results are excluded (content-only mode).
   */
  async #performSearch(): Promise<void> {
    if (this.onSearch === null || this.#input === null)
      return;

    const raw = this.#input.value;
    if (raw.trim() === '') {
      this.#renderResults({ results: [], query: '', },);
      return;
    }

    const isContentOnly = raw.startsWith('%',);
    const query = isContentOnly ? raw.slice(1,).trim() : raw.trim();

    if (query === '') {
      this.#renderResults({ results: [], query: '', },);
      return;
    }

    const generation = ++this.#searchGeneration;

    try {
      const results = await this.onSearch(query,);

      if (generation !== this.#searchGeneration)
        return;

      const filtered = isContentOnly
        ? results.filter(function isContent(r,) { return r.kind === 'content'; },)
        : results;
      this.#renderResults({ results: filtered, query, },);
    }
    catch (error) {
      if (generation !== this.#searchGeneration)
        return;

      l.error(`search failed: ${String(error,)}`,);
      this.#renderResults({ results: [], query, },);
    }
  }

  /**
   * Renders search results into the results container.
   * Paths are shortened via middle-out truncation to keep the search keyword visible.
   *
   * @param results - search results to render
   *
   * @param query - search query for middle-out path truncation
   */
  #renderResults({ results, query, }: { results: SearchResult[]; query: string }): void {
    if (this.#resultsContainer === null)
      return;

    this.#results = results;
    this.#selectedIndex = results.length > 0 ? 0 : -1;

    if (results.length === 0) {
      const hasInput = this.#input !== null && this.#input.value.trim() !== '';
      this.#resultsContainer.replaceChildren(
        hasInput
          ? h({ tag: 'div', class: 'empty', text: 'No results', },)
          : h({ tag: 'div', },),
      );
      return;
    }

    const overlay = this;
    const rootPrefix = this.#rootDir.endsWith('/') ? this.#rootDir : `${this.#rootDir}/`;

    const budget = overlay.#charBudget();
    const elements = results.map(function createResultElement(result, index,) {
      /**
       * Computes a display-friendly relative path from the root directory.
       *
       * @param absolutePath - absolute file path
       *
       * @returns path relative to rootDir
       */
      function relativePath(absolutePath: string,): string {
        return absolutePath.startsWith(rootPrefix,)
          ? absolutePath.slice(rootPrefix.length,)
          : absolutePath;
      }

      const displayPath = middleOut({
        text: relativePath(result.path,),
        query,
        budget,
      },);

      const children: (Node | string)[] = [
        h({ tag: 'span', class: 'result-path', text: displayPath, },),
      ];

      if (result.kind === 'content') {
        children.push(
          h({ tag: 'span', class: 'result-line', text: `:${String(result.line,)}`, },),
          h({ tag: 'span', class: 'result-text', text: result.text, },),
        );
      }

      const element = h({
        tag: 'div',
        class: 'result',
        attrs: index === 0 ? { 'data-selected': '', } : {},
        children,
        on: {
          click: function handleClick() {
            overlay.#selectResult({ index, },);
          },
        },
      },);

      return element;
    },);

    this.#resultsContainer.replaceChildren(...elements,);
    this.#highlightMatches({ query, },);
  }

  /**
   * Highlights all occurrences of the query in rendered result text nodes
   * using the CSS Custom Highlight API. Case-insensitive matching.
   *
   * @param query - search query to highlight
   */
  #highlightMatches({ query, }: { query: string }): void {
    if (query === '' || this.#resultsContainer === null) {
      CSS.highlights.delete('hl-search-match',);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const queryLength = query.length;
    const ranges: Range[] = [];

    const walker = document.createTreeWalker(
      this.#resultsContainer,
      NodeFilter.SHOW_TEXT,
    );

    let node = walker.nextNode();
    while (node !== null) {
      const text = node.textContent ?? '';
      const lowerText = text.toLowerCase();
      let searchFrom = 0;

      // oxlint-disable-next-line -- indexOf returns -1 when not found; loop terminates correctly
      for (;;) {
        const index = lowerText.indexOf(lowerQuery, searchFrom,);
        if (index === -1)
          break;

        const range = new Range();
        range.setStart(node, index,);
        range.setEnd(node, index + queryLength,);
        ranges.push(range,);
        searchFrom = index + queryLength;
      }

      node = walker.nextNode();
    }

    if (ranges.length > 0)
      CSS.highlights.set('hl-search-match', new Highlight(...ranges,),);
    else
      CSS.highlights.delete('hl-search-match',);
  }

  /**
   * Handles keyboard navigation within the overlay.
   * - ArrowDown/ArrowUp: move selection
   * - Enter: confirm selection
   *
   * Escape is handled via input blur (browser blurs the input on first
   * Escape before dispatching keydown to JS) and native dialog cancel.
   *
   * @param event - keyboard event from the input element
   */
  #handleKeydown(event: KeyboardEvent,): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.#moveSelection({ delta: 1, },);
    }
    else if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.#moveSelection({ delta: -1, },);
    }
    else if (event.key === 'Enter') {
      event.preventDefault();
      this.#confirmSelection();
    }
  }

  /**
   * Moves the keyboard selection by the given delta and updates visual state.
   *
   * @param delta - direction to move: 1 for down, -1 for up
   */
  #moveSelection({ delta, }: { delta: number }): void {
    if (this.#results.length === 0 || this.#resultsContainer === null)
      return;

    const { children, } = this.#resultsContainer;
    const previous = children[this.#selectedIndex];
    if (previous !== undefined)
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- HTMLCollection items are Element; only HTMLElement has dataset
      delete (previous as HTMLElement).dataset['selected'];

    this.#selectedIndex = (this.#selectedIndex + delta + this.#results.length) % this.#results.length;

    const current = children[this.#selectedIndex];
    if (current !== undefined) {
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- HTMLCollection items are Element; only HTMLElement has dataset
      (current as HTMLElement).dataset['selected'] = '';
      current.scrollIntoView({ block: 'nearest', },);
    }
  }

  /**
   * Confirms the current selection and dispatches a `result-select` event.
   * Closes the overlay after dispatching.
   */
  #confirmSelection(): void {
    this.#selectResult({ index: this.#selectedIndex, },);
  }

  /**
   * Dispatches a `result-select` event for the result at the given index
   * and closes the overlay.
   *
   * @param index - index of the result to select
   */
  #selectResult({ index, }: { index: number }): void {
    const result = this.#results[index];
    if (result === undefined)
      return;

    const detail: ResultSelectDetail = {
      path: result.path,
      line: result.kind === 'content' ? result.line : undefined,
    };

    this.dispatchEvent(new CustomEvent('result-select', {
      detail,
      bubbles: true,
    },),);

    this.#close();
  }
}

customElements.define('search-overlay', SearchOverlay,);
