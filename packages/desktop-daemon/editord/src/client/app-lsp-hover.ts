/**
 * Hover tooltip wiring for the editord client.
 *
 * Debounces mouse movement, sends hover requests to the server,
 * and shows/hides the hover popup.
 */

import type { HoverPopup, } from './hover-popup.ts';
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
 * @param referencesPopup - references popup; hover is suppressed while it is visible
 *
 * @param getCurrentFilePath - returns the currently open file path
 */
export function wireHover({ ws, editorPane, hoverPopup, getEditorElement, referencesPopup, getCurrentFilePath, }: {
  ws: EditorWsClient;
  editorPane: HTMLElement;
  hoverPopup: HoverPopup;
  getEditorElement: () => HTMLElement | null;
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
      if (referencesPopup.visible) return;
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

  editorPane.addEventListener('mouseleave', function handleMouseLeave() {
    clearTimeout(timer,);
    hoverPopup.hide();
    lastLine = -1;
    lastChar = -1;
  },);
}

/** Sends a hover request and shows the popup. */
async function doRequestHover({ ws, hoverPopup, path, line, character, x, y, }: {
  ws: EditorWsClient; hoverPopup: HoverPopup;
  path: string; line: number; character: number; x: number; y: number;
}): Promise<void> {
  try {
    const response = await ws.request({ type: 'hover', path, line, character, },);
    if ('contents' in response) {
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- response narrowed by 'contents' check
      const { contents, } = response as { contents: string };
      if (contents !== '') {
        hoverLog.info(`showing hover at ${x},${y}`,);
        hoverPopup.show({ text: contents, x, y, },);
      }
    }
  }
  catch (error) {
    hoverLog.error(`hover request failed: ${String(error,)}`,);
  }
}
