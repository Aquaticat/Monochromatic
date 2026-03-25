/**
 * Hover tooltip wiring for the editord client.
 *
 * Debounces mouse movement, sends hover requests to the server,
 * and shows/hides the hover popup.
 */

import type { CompletionPopup, } from '../completion/completion-popup.ts';
import type { EditorPane, } from '../editor/editor-pane.ts';
import type { HoverPopup, } from '../hover/hover-popup.ts';
import { doRequestHover, } from '../hover/request.ts';
import {
  l,
  tagged,
} from '../log.ts';
import type { ReferencesPopup, } from '../references/references-popup.ts';
import { HOVER_DEBOUNCE_MS, } from '../timing.ts';
import type { EditorWsClient, } from '../ws/client.ts';

/** Tagged logger for hover. */
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
    ws: EditorWsClient;
    editorPane: EditorPane;
    hoverPopup: HoverPopup;
    completionPopup: CompletionPopup;
    referencesPopup: ReferencesPopup;
    getCurrentFilePath: () => string | null;
  },
): void {
  let timer = 0;
  let lastLine = -1;
  let lastChar = -1;

  editorPane.addEventListener(
    'mousemove',
    function handleMouseMove(event,) {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- mousemove is always a MouseEvent
    const me = event as MouseEvent;
    clearTimeout(timer,);
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- globalThis.setTimeout returns NodeJS.Timeout when Node types are loaded
    timer = globalThis.setTimeout(function doHover() {
      if (completionPopup.visible || referencesPopup.visible)
        return;
      const path = getCurrentFilePath();
      if (path === null)
        return;
      const pos = editorPane.getPositionFromPoint({ x: me.clientX, y: me.clientY, },);
      if (pos === null)
        return;
      if (pos.line === lastLine && pos.character === lastChar)
        return;
      lastLine = pos.line;
      lastChar = pos.character;
      void doRequestHover({ ws, hoverPopup, path, line: pos.line,
        character: pos.character, x: me.clientX, y: me.clientY, },);
    }, HOVER_DEBOUNCE_MS,) as unknown as number;
  },
  );

  editorPane.addEventListener(
    'mouseleave',
    function handleMouseLeave(event,) {
    clearTimeout(timer,);
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- mouseleave is always a MouseEvent
    const me = event as MouseEvent;
    if (me.relatedTarget === hoverPopup
      || (me.relatedTarget instanceof Node && hoverPopup.contains(me.relatedTarget,)))
    {
      return;
    }
    hoverPopup.hide();
    lastLine = -1;
    lastChar = -1;
  },
  );

  hoverPopup.addEventListener(
    'mouseleave',
    function handlePopupLeave() {
    hoverPopup.hide();
    lastLine = -1;
    lastChar = -1;
  },
  );
}
