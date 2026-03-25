/**
 * Per-page undo/redo history stack for the doodle widget.
 *
 * Maintains an array of state snapshots per page with a pointer
 * to the current position. Supports configurable depth limit.
 */

import type { StrokeData, } from './drawing.ts';
import type { TextEntryData, } from './text-page.ts';

/** Maximum undo states retained per page */
const MAX_HISTORY_DEPTH = 50;

/**
 * Complete state snapshot for a single page.
 *
 * @example
 * ```ts
 * const snap: Snapshot = { strokes: [...getStrokes()], textEntries: serializeTextEntries(layer) };
 * ```
 */
export type Snapshot = {
  /** Deep-enough copy of strokes (stroke objects are immutable after creation) */
  readonly strokes: StrokeData[];
  /** Serialized text input entries */
  readonly textEntries: TextEntryData[];
};

/** Undo/redo state for a single page */
type PageHistory = {
  /** Ordered states from oldest to newest */
  states: Snapshot[];
  /** Index of the current state within `states` */
  index: number;
};

/** History stacks indexed by page number */
let histories: PageHistory[] = [];

/**
 * Initializes empty history stacks for all pages.
 *
 * Each page starts with a single empty snapshot at index 0.
 *
 * @param pageCount - number of pages to create history for
 */
export function initHistory(pageCount: number,): void {
  /** Shared initial empty snapshot */
  const empty: Snapshot = {
    strokes: [],
    textEntries: [],
  };
  histories = Array.from(
    { length: pageCount, },
    function createPageHistory(): PageHistory {
      return {
        states: [empty,],
        index: 0,
      };
    },
  );
}

/**
 * Pushes a new state snapshot, truncating any redo history.
 *
 * @param pageIndex - page to push state for
 *
 * @param snapshot - captured state after the completed action
 */
export function pushSnapshot({
  pageIndex,
  snapshot,
}: {
  pageIndex: number;
  snapshot: Snapshot;
},): void {
  const history = histories[pageIndex];
  if (history === undefined)
    return;

  history.states = history.states.slice(
    0,
    history.index + 1,
  );
  history.states.push(snapshot,);
  history.index = history.states.length - 1;

  if (history.states.length > MAX_HISTORY_DEPTH) {
    const excess = history.states.length - MAX_HISTORY_DEPTH;
    history.states = history.states.slice(excess,);
    history.index -= excess;
  }
}

/**
 * Moves back one step and returns the snapshot to restore.
 *
 * @param pageIndex - page to undo on
 *
 * @returns snapshot to restore, or null if at the beginning
 */
export function undo(pageIndex: number,): Snapshot | null {
  const history = histories[pageIndex];
  if (history === undefined || history.index <= 0)
    return null;
  history.index -= 1;
  return history.states[history.index] ?? null;
}

/**
 * Moves forward one step and returns the snapshot to restore.
 *
 * @param pageIndex - page to redo on
 *
 * @returns snapshot to restore, or null if at the end
 */
export function redo(pageIndex: number,): Snapshot | null {
  const history = histories[pageIndex];
  if (history === undefined || history.index >= history.states.length - 1)
    return null;
  history.index += 1;
  return history.states[history.index] ?? null;
}

/**
 * Checks whether undo is available for the given page.
 *
 * @param pageIndex - page to check
 *
 * @returns `true` if there is at least one prior state
 */
export function canUndo(pageIndex: number,): boolean {
  const history = histories[pageIndex];
  return history !== undefined && history.index > 0;
}

/**
 * Checks whether redo is available for the given page.
 *
 * @param pageIndex - page to check
 *
 * @returns `true` if there is at least one forward state
 */
export function canRedo(pageIndex: number,): boolean {
  const history = histories[pageIndex];
  return history !== undefined && history.index < history.states.length - 1;
}
