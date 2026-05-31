/**
 * Search overlay keyboard navigation and result selection.
 *
 * Handles arrow key movement, Enter confirmation, and
 * dispatching result-select events.
 */

import type { SearchResult, } from '../../../protocol.ts';

/**
 * Detail payload for the `result-select` custom event.
 */
export type ResultSelectDetail = {
  /**
   * Absolute file path to open.
   */
  readonly path: string;
  /**
   * 1-based line number to scroll to, present for content matches.
   */
  readonly line: number | undefined;
};

/**
 * Handles keyboard navigation within the overlay.
 * ArrowDown/ArrowUp move selection; Enter confirms.
 *
 * @param event - keyboard event from the input element
 *
 * @param moveSelection - moves the selection by the given delta
 *
 * @param confirmSelection - confirms the current selection
 *
 * @example
 * ```ts
 * handleSearchKeydown({ event: keyboardEvent, moveSelection: moveSelection, confirmSelection: confirmSelection, });
 * ```
 */
export function handleSearchKeydown({
  event,
  moveSelection,
  confirmSelection,
}: {
  readonly event: KeyboardEvent;
  readonly moveSelection: (delta: number,) => void;
  readonly confirmSelection: () => void;
},): void {
  if (event.key
    === 'ArrowDown') {
    event.preventDefault();
    moveSelection(1,);
  }
  else if (event.key
    === 'ArrowUp') {
    event.preventDefault();
    moveSelection(-1,);
  }
  else if (event.key
    === 'Enter') {
    event.preventDefault();
    confirmSelection();
  }
}

/**
 * Moves the keyboard selection by the given delta and updates visual state.
 *
 * @param delta - direction to move: 1 for down, -1 for up
 *
 * @param results - current search results array
 *
 * @param selectedIndex - current selected index
 *
 * @param container - results container element
 *
 * @returns new selected index
 *
 * @example
 * ```ts
 * const result = moveSearchSelection({ delta: 1, results: [], selectedIndex: 0, container: resultsContainer, });
 * ```
 */
export function moveSearchSelection({
  delta,
  results,
  selectedIndex,
  container,
}: {
  readonly delta: number;
  readonly results: readonly SearchResult[];
  readonly selectedIndex: number;
  readonly container: HTMLDivElement;
},): number {
  if (results.length
    === 0)
    return selectedIndex;

  /**
   * Live collection of rendered result rows.
   */
  const { children, } = container;
  /**
   * Currently-selected row whose dataset flag must be cleared before reassignment.
   */
  const previous = children[selectedIndex];
  if (previous !== undefined) {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- HTMLCollection items are Element; only HTMLElement has dataset
    delete (previous as HTMLElement).dataset
      .selected;
  }

  /**
   * Wraps the new index modulo length so navigation cycles.
   */
  const newIndex = (selectedIndex + delta
    + results
    .length) % results
    .length;

  /**
   * Newly-selected row receiving the `data-selected` flag and viewport scroll.
   */
  const current = children[newIndex];
  if (current !== undefined) {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- HTMLCollection items are Element; only HTMLElement has dataset
    (current as HTMLElement).dataset
      .selected = '';
    current.scrollIntoView({ block: 'nearest', },);
  }

  return newIndex;
}

/**
 * Dispatches a `result-select` event for the result at the given index
 * and returns the detail payload.
 *
 * @param index - index of the result to select
 *
 * @param results - current search results array
 *
 * @returns result detail, or null if index is out of range
 *
 * @example
 * ```ts
 * const result = buildResultDetail({ index: 0, results: [], });
 * ```
 */
export function buildResultDetail({
  index,
  results,
}: {
  readonly index: number;
  readonly results: readonly SearchResult[];
},): ResultSelectDetail | null {
  /**
   * Out-of-range index returns null instead of throwing.
   */
  const result = results[index];
  if (result === undefined)
    return null;

  return {
    path: result.path,
    line: result.kind
      === 'content' ? result.line : undefined,
  };
}
