/**
 * Hover tooltip wiring for the editord client.
 *
 * Debounces mouse movement, sends hover requests to the server,
 * and shows/hides the hover popup.
 */

import { createDebounced, } from '../debounce.ts';
import { doRequestHover, } from '../hover/request.ts';
import {
  l,
  tagged,
} from '../log.ts';
import { HOVER_DEBOUNCE_MS, } from '../timing.ts';

import type {
  CompletionPopupHandle,
  EditorPaneHandle,
  EditorWsClientHandle,
  GetCurrentFilePathFn,
  HoverPopupHandle,
  ReferencesPopupHandle,
} from './types.ts';

/**
 * Tagged logger for hover.
 */
const hoverLog = tagged({
  tag: 'hover',
  l,
},);

/**
 * Wires hover tooltips onto the editor pane.
 *
 * @param ws - WebSocket client
 *
 * @param editorPane - editor pane component for event listening and hit-testing
 *
 * @param hoverPopup - hover popup element to show/hide
 *
 * @param completionPopup - completion popup; hover is suppressed while it is visible
 *
 * @param referencesPopup - references popup; hover is suppressed while it is visible
 *
 * @param getCurrentFilePath - returns the currently open file path
 *
 * @example
 * ```ts
 * wireHover({ ws, editorPane, hoverPopup, completionPopup, referencesPopup, getCurrentFilePath, });
 * ```
 */
export function wireHover(
  {
    ws,
    editorPane,
    hoverPopup,
    completionPopup,
    referencesPopup,
    getCurrentFilePath,
  }: {
    readonly ws: EditorWsClientHandle;
    readonly editorPane: EditorPaneHandle;
    readonly hoverPopup: HoverPopupHandle;
    readonly completionPopup: CompletionPopupHandle;
    readonly referencesPopup: ReferencesPopupHandle;
    readonly getCurrentFilePath: GetCurrentFilePathFn;
  },
): void {
  /**
   * Mutable hover state shared across mousemove, debounce, and reset callbacks.
   * Wrapped in a const ref-object so each field can be reassigned without
   * a function-root let.
   */
  const hoverState: {
    lastLine: number;
    lastChar: number;
    latestMouseEvent: MouseEvent | null;
  } = {
    lastLine: -1,
    lastChar: -1,
    latestMouseEvent: null,
  };

  /**
   * Hides the popup and resets position tracking.
   */
  function resetHover(): void {
    hoverPopup.hide();
    hoverState.lastLine = -1;
    hoverState.lastChar = -1;
  }

  /**
   * Debounced hover trigger plus its cancel handle, both wired to mouse events below.
   */
  const {
    debounced: scheduleHover,
    cancel: cancelHover,
  } = createDebounced({
    fn: function doHover() {
      /**
       * Latest mousemove captured by the listener; null means the cursor left the pane.
       */
      const me = hoverState.latestMouseEvent;
      if (me === null)
        return;
      if (completionPopup.visible
        || referencesPopup
        .visible)
        return;
      /**
       * Skip when no file is open; LSP needs a target.
       */
      const path = getCurrentFilePath();
      if (path === null)
        return;
      /**
       * Resolved cursor coords; null means the point was outside any text node.
       */
      const pos = editorPane.getPositionFromPoint({
        x: me.clientX,
        y: me.clientY,
      },);
      if (pos === null)
        return;
      if ((pos.line
        === hoverState
        .lastLine) && (pos.character
          === hoverState
          .lastChar))
        return;
      hoverState.lastLine = pos.line;
      hoverState.lastChar = pos.character;
      void doRequestHover({
        ws,
        hoverPopup,
        path,
        line: pos.line,
        character: pos.character,
        x: me.clientX,
        y: me.clientY,
      },);
    },
    delayMs: HOVER_DEBOUNCE_MS,
  },);

  editorPane.addEventListener(
    'mousemove',
    function handleMouseMove(event,) {
      if (!(event instanceof MouseEvent))
        return;
      hoverState.latestMouseEvent = event;
      scheduleHover();
    },
  );

  editorPane.addEventListener(
    'mouseleave',
    function handleMouseLeave(event,) {
      cancelHover();
      if (!(event instanceof MouseEvent)) {
        resetHover();
        return;
      }
      if ((event.relatedTarget
        instanceof Node) && hoverPopup
        .contains(event.relatedTarget,))
        return;
      resetHover();
    },
  );

  hoverPopup.addEventListener(
    'mouseleave',
    function handlePopupLeave() {
      resetHover();
    },
  );
}
