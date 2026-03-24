/**
 * Search overlay keyboard navigation and result selection.
 *
 * Handles arrow key movement, Enter confirmation, and
 * dispatching result-select events.
 */

import type { SearchResult, } from '../../../protocol.ts';

/** Detail payload for the `result-select` custom event. */
export type ResultSelectDetail = {
  /** Absolute file path to open. */
  path: string;
  /** 1-based line number to scroll to, present for content matches. */
  line: number | undefined;
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
 */
export function handleSearchKeydown({ event, moveSelection, confirmSelection, }: {
  event: KeyboardEvent;
  moveSelection: (delta: number,) => void;
  confirmSelection: () => void;
},): void {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    moveSelection(1,);
  }
  else if (event.key === 'ArrowUp') {
    event.preventDefault();
    moveSelection(-1,);
  }
  else if (event.key === 'Enter') {
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
 */
export function moveSearchSelection({ delta, results, selectedIndex, container, }: {
  delta: number;
  results: SearchResult[];
  selectedIndex: number;
  container: HTMLDivElement;
},): number {
  if (results.length === 0)
    return selectedIndex;

  const { children, } = container;
  const previous = children[selectedIndex];
  if (previous !== undefined) {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- HTMLCollection items are Element; only HTMLElement has dataset
    delete (previous as HTMLElement).dataset['selected'];
  }

  const newIndex = (selectedIndex + delta + results.length) % results.length;

  const current = children[newIndex];
  if (current !== undefined) {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- HTMLCollection items are Element; only HTMLElement has dataset
    (current as HTMLElement).dataset['selected'] = '';
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
 */
export function buildResultDetail({ index, results, }: {
  index: number;
  results: SearchResult[];
},): ResultSelectDetail | null {
  const result = results[index];
  if (result === undefined)
    return null;

  return {
    path: result.path,
    line: result.kind === 'content' ? result.line : undefined,
  };
}
