/**
 * Undo/redo handler setup for the doodle widget.
 *
 * Wires up undo/redo buttons, Ctrl+Z / Ctrl+Shift+Z keyboard
 * shortcuts, and provides a `pushSnapshot` function for other
 * modules to record state after completing actions.
 */

import {
  getStrokes,
  redraw,
  setStrokes,
} from './drawing.ts';
import { getCurrentPageIndex, } from './pages.ts';
import {
  replaceTextEntries,
  serializeTextEntries,
} from './text-page.ts';
import { clearTextEntries, } from './text.ts';
import {
  canRedo,
  canUndo,
  pushSnapshot as pushHistorySnapshot,
  redo,
  type Snapshot,
  undo,
} from './undo-history.ts';

/**
 * Dependencies for undo/redo handler setup.
 */
export type UndoHandlerDeps = {
  /** Undo button */
  undoBtn: HTMLButtonElement;
  /** Redo button */
  redoBtn: HTMLButtonElement;
  /** Canvas 2D rendering context for redraw after restore */
  ctx: CanvasRenderingContext2D;
  /** Returns current canvas dimensions */
  getCanvasSize: () => { cw: number; ch: number; };
  /** Text layer element for serializing and restoring text entries */
  textLayer: HTMLDivElement;
};

/**
 * Sets up undo/redo button handlers, keyboard shortcuts, and returns
 * functions for other modules to push snapshots and update button state.
 *
 * @param deps - DOM elements and shared state accessors
 *
 * @returns `pushSnapshot` to call after state-changing actions,
 *   `updateUndoButtons` to refresh button disabled state
 */
export function setupUndoHandlers(deps: UndoHandlerDeps,): {
  pushSnapshot: () => void;
  updateUndoButtons: () => void;
} {
  const { undoBtn, redoBtn, ctx, getCanvasSize, textLayer, } = deps;

  /**
   * Refreshes the disabled state of undo/redo buttons based on
   * history availability for the current page.
   */
  function updateUndoButtons(): void {
    const pageIndex = getCurrentPageIndex();
    undoBtn.disabled = !canUndo(pageIndex,);
    redoBtn.disabled = !canRedo(pageIndex,);
  }

  /**
   * Captures the current state and pushes it to the undo history.
   *
   * Call after any state-changing action completes (stroke, erase,
   * text finalization, clear).
   */
  function pushSnapshot(): void {
    pushHistorySnapshot({
      pageIndex: getCurrentPageIndex(),
      snapshot: {
        strokes: [...getStrokes(),],
        textEntries: serializeTextEntries(textLayer,),
      },
    },);
    updateUndoButtons();
  }

  /**
   * Restores a snapshot from the undo history.
   *
   * @param snapshot - state to restore
   */
  function restoreSnapshot(snapshot: Snapshot,): void {
    setStrokes([...snapshot.strokes,],);
    replaceTextEntries({ entries: snapshot.textEntries, layer: textLayer,
      clearFn: clearTextEntries, },);
    const { cw, ch, } = getCanvasSize();
    redraw({ ctx, cw, ch, },);
    updateUndoButtons();
  }

  undoBtn.addEventListener('click', function handleUndo(): void {
    const snapshot = undo(getCurrentPageIndex(),);
    if (snapshot !== null)
      restoreSnapshot(snapshot,);
  },);

  redoBtn.addEventListener('click', function handleRedo(): void {
    const snapshot = redo(getCurrentPageIndex(),);
    if (snapshot !== null)
      restoreSnapshot(snapshot,);
  },);

  document.addEventListener('keydown',
    function handleUndoRedoKey(event: KeyboardEvent,): void {
      /** Skip when focus is inside a text input to preserve native text undo */
      if (event.target instanceof HTMLInputElement)
        return;

      const hasModifier = event.ctrlKey || event.metaKey;
      if (!hasModifier)
        return;

      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        const snapshot = event.shiftKey
          ? redo(getCurrentPageIndex(),)
          : undo(getCurrentPageIndex(),);
        if (snapshot !== null)
          restoreSnapshot(snapshot,);
      }
      else if (key === 'y') {
        event.preventDefault();
        const snapshot = redo(getCurrentPageIndex(),);
        if (snapshot !== null)
          restoreSnapshot(snapshot,);
      }
    },);

  updateUndoButtons();

  return { pushSnapshot, updateUndoButtons, };
}
