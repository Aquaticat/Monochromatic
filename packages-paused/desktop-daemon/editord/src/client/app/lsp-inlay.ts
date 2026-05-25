/**
 * Inlay hint wiring for the editord client.
 *
 * Debounces inlay hint requests on content changes and provides
 * an immediate refresh function for use after file loads.
 */

import { createDebounced, } from '../debounce.ts';
import { fetchInlayHints, } from '../inlay/fetch.ts';
import { INLAY_HINT_DEBOUNCE_MS, } from '../timing.ts';

import type {
  EditorPaneHandle,
  EditorWsClientHandle,
  GetCurrentFilePathFn,
} from './types.ts';

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
 *
 * @example
 * ```ts
 * const result = wireInlayHints({ ws: ws, editorPane: editorPane, getCurrentFilePath: '/home/user/project/src/main.ts', });
 * ```
 */
export function wireInlayHints({
  ws,
  editorPane,
  getCurrentFilePath,
}: {
  readonly ws: EditorWsClientHandle;
  readonly editorPane: EditorPaneHandle;
  readonly getCurrentFilePath: GetCurrentFilePathFn;
},): { readonly refresh: () => void; } {
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
