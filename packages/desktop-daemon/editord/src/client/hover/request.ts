/**
 * Sends hover requests to the LSP server and shows results.
 *
 * Separated from hover wiring to keep files under max-lines.
 */

import {
  l,
  tagged,
} from '../log.ts';
import type { EditorWsClient, } from '../ws/client.ts';
import type { HoverPopup, } from './hover-popup.ts';

/** Tagged logger for hover requests. */
const hoverLog = tagged({
  tag: 'hover-request',
  l,
},);

/**
 * Sends a hover request and shows the popup.
 *
 * @param ws - WebSocket client
 *
 * @param hoverPopup - hover popup element to show/hide
 *
 * @param path - file path for the hover request
 *
 * @param line - 0-based line number
 *
 * @param character - 0-based character offset
 *
 * @param x - mouse X coordinate for popup positioning
 *
 * @param y - mouse Y coordinate for popup positioning
 *
 * @example
 * ```ts
 * await doRequestHover({ ws: ws, hoverPopup: hoverPopup, path: '/home/user/project/src/main.ts', line: 10, character: 5, x: 120, y: 240, });
 * ```
 */
export async function doRequestHover({
  ws,
  hoverPopup,
  path,
  line,
  character,
  x,
  y,
}: {
  ws: EditorWsClient;
  hoverPopup: HoverPopup;
  path: string;
  line: number;
  character: number;
  x: number;
  y: number;
},): Promise<void> {
  try {
    /** Hover text from the language server; empty string means "nothing to show". */
    const { contents, } = await ws.request({
      type: 'hover',
      path,
      line,
      character,
    },);
    if (contents !== '') {
      hoverLog.info(`showing hover at ${x},${y}`,);
      hoverPopup.show({
        text: contents,
        x,
        y,
      },);
    }
  }
  catch (error) {
    hoverLog.error(`hover request failed: ${String(error,)}`,);
  }
}
