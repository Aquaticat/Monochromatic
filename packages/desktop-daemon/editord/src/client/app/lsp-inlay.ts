/**
 * Inlay hint wiring for the editord client.
 *
 * Debounces inlay hint requests on content changes and provides
 * an immediate refresh function for use after file loads.
 */

import { createDebounced, } from '../debounce.ts';
import type { EditorPane, } from '../editor/editor-pane.ts';
import { fetchInlayHints, } from '../inlay/fetch.ts';
import { INLAY_HINT_DEBOUNCE_MS, } from '../timing.ts';
import type { EditorWsClient, } from '../ws/client.ts';

import type { GetCurrentFilePathFn, } from './types.ts';

/**
 * Wires inlay hint fetching on content changes with debouncing.
 * Returns a `refresh` function for triggering on file open.
 *
 * @param ws - WebSocket client
 *
 * @param editorPane - editor pane component
 *
 * @param getCurrentFilePath - returns the current file path
 *
 * @returns object with `refresh` for immediate hint fetching
 */
export function wireInlayHints({
  ws,
  editorPane,
  getCurrentFilePath,
}: {
  ws: EditorWsClient;
  editorPane: EditorPane;
  getCurrentFilePath: GetCurrentFilePathFn;
},): { refresh: () => void; } {
  editorPane.addEventListener(
    'contentchange',
    createDebounced({
      fn: function refreshInlayHints() {
        void fetchInlayHints({
          ws,
          editorPane,
          getCurrentFilePath,
        },);
      },
      delayMs: INLAY_HINT_DEBOUNCE_MS,
    },)
      .debounced,
  );

  return {
    refresh: function immediateRefresh(): void {
      void fetchInlayHints({
        ws,
        editorPane,
        getCurrentFilePath,
      },);
    },
  };
}
