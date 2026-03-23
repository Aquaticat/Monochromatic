/**
 * Inlay hint wiring for the editord client.
 *
 * Debounces inlay hint requests on content changes and provides
 * an immediate refresh function for use after file loads.
 */

import type { EditorPane, } from '../editor/editor-pane.ts';
import { fetchInlayHints, } from '../inlay/fetch.ts';
import type { EditorWsClient, } from '../ws/client.ts';

/** Debounce delay for inlay hint refresh after content changes (milliseconds). */
const INLAY_HINT_DEBOUNCE_MS = 750;

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
export function wireInlayHints({ ws, editorPane, getCurrentFilePath, }: {
  ws: EditorWsClient;
  editorPane: EditorPane;
  getCurrentFilePath: () => string | null;
}): { refresh: () => void } {
  let timer = 0;

  /** Schedules a debounced inlay hint refresh. */
  function scheduleRefresh(): void {
    clearTimeout(timer,);
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- globalThis.setTimeout returns NodeJS.Timeout when Node types loaded
    timer = globalThis.setTimeout(function refreshInlayHints() {
      void fetchInlayHints({ ws, editorPane, getCurrentFilePath, },);
    }, INLAY_HINT_DEBOUNCE_MS,) as unknown as number;
  }

  editorPane.addEventListener('contentchange', scheduleRefresh,);

  return {
    refresh: function immediateRefresh(): void {
      void fetchInlayHints({ ws, editorPane, getCurrentFilePath, },);
    },
  };
}
