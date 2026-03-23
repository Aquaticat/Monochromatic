/**
 * LSP content sync and diagnostics wiring.
 *
 * Debounces editor content changes and forwards them to the server.
 * Receives diagnostic pushes and renders them on the editor pane.
 */

import type { EditorPane, } from '../editor/editor-pane.ts';
import type { EditorWsClient, } from '../ws/client.ts';

/** Debounce delay for content sync to LSP servers (milliseconds). */
const CONTENT_SYNC_DEBOUNCE_MS = 500;

/**
 * Wires debounced content sync to the server.
 *
 * @param ws - WebSocket client
 *
 * @param editorPane - editor pane component
 *
 * @param getCurrentFilePath - returns the current file path
 */
export function wireContentSync({ ws, editorPane, getCurrentFilePath, }: {
  ws: EditorWsClient; editorPane: EditorPane; getCurrentFilePath: () => string | null;
}): void {
  let timer = 0;
  editorPane.addEventListener('contentchange', function handleContentChange() {
    clearTimeout(timer,);
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- globalThis.setTimeout returns NodeJS.Timeout when Node types loaded
    timer = globalThis.setTimeout(function syncContent() {
      const path = getCurrentFilePath();
      if (path === null) return;
      void ws.notify({ type: 'didChange', path, content: editorPane.getText(), },);
    }, CONTENT_SYNC_DEBOUNCE_MS,) as unknown as number;
  },);
}

/**
 * Wires diagnostic push handling from the server to the editor pane.
 *
 * @param ws - WebSocket client
 *
 * @param editorPane - editor pane component to render diagnostics on
 *
 * @param getCurrentFilePath - returns the current file path
 */
export function wireDiagnostics({ ws, editorPane, getCurrentFilePath, }: {
  ws: EditorWsClient; editorPane: EditorPane; getCurrentFilePath: () => string | null;
}): void {
  ws.onDiagnostics = function handleDiagnostics({ path, diagnostics, },): void {
    if (path === getCurrentFilePath()) editorPane.setDiagnostics(diagnostics,);
  };
}
