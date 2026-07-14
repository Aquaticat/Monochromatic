/**
 * Search execution logic for the search overlay.
 *
 * Handles debounced search scheduling, content-only filtering,
 * and generation-based stale result discarding.
 */

import type { SearchResult, } from '../../../protocol.ts';
import {
  createDebounced,
  type DebouncedHandle,
} from '../debounce.ts';
import {
  l as rootLogger,
  tagged,
} from '../log.ts';

/**
 * Tagged logger for the search subsystem.
 */
const l = tagged({
  tag: 'search-overlay-search',
  l: rootLogger,
},);

/**
 * Debounce delay for search input in milliseconds.
 */
const DEBOUNCE_MS = 150;

/**
 * Mutable search state shared between the overlay and this module.
 */
export type SearchState = {
  /**
   * Debounced search handle.
   */
  debouncedSearch: DebouncedHandle | null;
  /**
   * Monotonic counter for stale result detection.
   */
  searchGeneration: number;
};

/**
 * Creates a debounced search handle for use in a `SearchState`.
 *
 * @param execute - callback to execute the search
 *
 * @returns debounced handle
 *
 * @example
 * ```ts
 * const result = createSearchDebounce({ execute: function handleExecute() { l.info("done"); }, });
 * ```
 */
export function createSearchDebounce(
  { execute, }: { readonly execute: () => void; },
): DebouncedHandle {
  return createDebounced({
    fn: execute,
    delayMs: DEBOUNCE_MS,
  },);
}

/**
 * Schedules a debounced search after the user types.
 *
 * @param state - mutable search state
 *
 * @param execute - callback to execute the search
 *
 * @example
 * ```ts
 * scheduleSearch({ state: sessionState, execute: function handleExecute() { l.info("done"); }, });
 * ```
 */
export function scheduleSearch({
  state,
  execute,
}: {
  readonly state: SearchState;
  readonly execute: () => void;
},): void {
  state.debouncedSearch ??= createSearchDebounce({ execute, },);
  state.debouncedSearch
    .debounced();
}

/**
 * Performs a search with content-only filtering and generation tracking.
 *
 * @param raw - raw input value
 *
 * @param state - mutable search state for generation tracking
 *
 * @param onSearch - callback that performs the actual search
 *
 * @param onResults - callback to render results
 *
 * @example
 * ```ts
 * await performSearch({ raw: "TODO", state: sessionState, onSearch: function handleSearch(event) { l.info(event); }, onResults: function handleResults(event) { l.info(event); }, });
 * ```
 */
export async function performSearch({
  raw,
  state,
  onSearch,
  onResults,
}: {
  readonly raw: string;
  readonly state: SearchState;
  readonly onSearch: (query: string,) => Promise<readonly SearchResult[]>;
  readonly onResults: (opts: {
    readonly results: readonly SearchResult[];
    readonly query: string;
  },) => void;
},): Promise<void> {
  if (raw.trim()
    === '') {
    onResults({
      results: [],
      query: '',
    },);
    return;
  }
  /**
   * Leading `%` toggles content-only mode; stripped from {@link query}.
   */
  const isContentOnly = raw.startsWith('%',);
  /**
   * Trimmed pattern sent to the server; empty short-circuits to no-op.
   */
  const query = isContentOnly ? raw.slice(1,)
    .trim() : raw.trim();
  if (query === '') {
    onResults({
      results: [],
      query: '',
    },);
    return;
  }
  /**
   * Monotonic counter used to drop stale results from outdated requests.
   */
  const generation = ++state.searchGeneration;
  try {
    /**
     * Raw mixed-kind results before the content-only filter below.
     */
    const results = await onSearch(query,);
    if (generation !== state
      .searchGeneration)
      return;
    /**
     * Mode-gated subset surfaced to the consumer.
     */
    const filtered = isContentOnly
      ? results.filter(function isContent(r,) {
        return r.kind
          === 'content';
      },)
      : results;
    onResults({
      results: filtered,
      query,
    },);
  }
  catch (error) {
    if (generation !== state
      .searchGeneration)
      return;
    l.error(`search failed: ${String(error,)}`,);
    onResults({
      results: [],
      query,
    },);
  }
}
