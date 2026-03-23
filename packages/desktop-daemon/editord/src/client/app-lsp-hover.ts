/**
 * Hover tooltip wiring for the editord client.
 *
 * Debounces mouse movement, sends hover requests to the server,
 * and shows/hides the hover popup.
 */

import type { CompletionPopup, } from './completion-popup.ts';
import type { HoverPopup, } from './hover-popup.ts';
import { doRequestHover, } from './hover-request.ts';
import { l, tagged, } from './log.ts';
import { getPositionFromPoint, } from './position-from-point.ts';
import type { ReferencesPopup, } from './references-popup.ts';
import type { EditorWsClient, } from './ws-client.ts';

/** Tagged logger for hover. */
const hoverLog = tagged({ tag: 'hover', l, },);

/** Debounce delay for hover requests (milliseconds). */
const HOVER_DEBOUNCE_MS = 350;

/**
 * Wires hover tooltips onto the editor pane.
 *
 * @param ws - WebSocket client
 *
 * @param editorPane - editor pane element to listen for mouse events
 *
 * @param hoverPopup - hover popup element to show/hide
 *
 * @param getEditorElement - returns the contenteditable container
 *
 * @param completionPopup - completion popup; hover is suppressed while it is visible
 *
 * @param referencesPopup - references popup; hover is suppressed while it is visible
 *
 * @param getCurrentFilePath - returns the currently open file path
 */
export function wireHover({ ws, editorPane, hoverPopup, getEditorElement, completionPopup, referencesPopup, getCurrentFilePath, }: {
  ws: EditorWsClient;
  editorPane: HTMLElement;
  hoverPopup: HoverPopup;
  getEditorElement: () => HTMLElement | null;
  completionPopup: CompletionPopup;
  referencesPopup: ReferencesPopup;
  getCurrentFilePath: () => string | null;
}): void {
  let timer = 0;
  let lastLine = -1;
  let lastChar = -1;

  editorPane.addEventListener('mousemove', function handleMouseMove(event,) {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- mousemove is always a MouseEvent
    const me = event as MouseEvent;
    clearTimeout(timer,);
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- globalThis.setTimeout returns NodeJS.Timeout when Node types are loaded
    timer = globalThis.setTimeout(function doHover() {
      if (completionPopup.visible || referencesPopup.visible) return;
      const path = getCurrentFilePath();
      if (path === null) { hoverLog.info('hover: no file open',); return; }
      const el = getEditorElement();
      if (el === null) { hoverLog.info('hover: no editor element',); return; }
      hoverLog.info(`hover: point ${me.clientX},${me.clientY} over editor with ${el.children.length} lines`,);
      const pos = getPositionFromPoint({ editor: el, x: me.clientX, y: me.clientY, },);
      if (pos === null) {
        hoverLog.info('hover: position from point returned null',);
        return;
      }
      hoverLog.info(`hover: resolved position line=${pos.line} char=${pos.character}`,);
      if (pos.line === lastLine && pos.character === lastChar) return;
      lastLine = pos.line;
      lastChar = pos.character;
      void doRequestHover({ ws, hoverPopup, path, line: pos.line, character: pos.character, x: me.clientX, y: me.clientY, },);
    }, HOVER_DEBOUNCE_MS,) as unknown as number;
  },);

  editorPane.addEventListener('mouseleave', function handleMouseLeave(event,) {
    clearTimeout(timer,);
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- mouseleave is always a MouseEvent
    const me = event as MouseEvent;
    if (me.relatedTarget === hoverPopup || (me.relatedTarget instanceof Node && hoverPopup.contains(me.relatedTarget,))) return;
    hoverPopup.hide();
    lastLine = -1;
    lastChar = -1;
  },);

  hoverPopup.addEventListener('mouseleave', function handlePopupLeave() {
    hoverPopup.hide();
    lastLine = -1;
    lastChar = -1;
  },);
}
