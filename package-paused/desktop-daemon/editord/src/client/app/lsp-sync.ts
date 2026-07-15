/**
 * LSP content sync and diagnostics wiring.
 *
 * Debounces editor content changes and forwards them to the server.
 * Receives diagnostic pushes and renders them on the editor pane.
 */

import { createDebounced, } from '../debounce.ts';
import { CONTENT_SYNC_DEBOUNCE_MS, } from '../timing.ts';

import type {
  EditorPaneHandle,
  EditorWsClientHandle,
  GetCurrentFilePathFn,
} from './types.ts';

/**
 * Wires debounced content sync to the server.
 *
 * @param ws - WebSocket client
 *
 * @param editorPane - editor pane component
 *
 * @param getCurrentFilePath - returns the current file path
 *
 * @example
 * ```ts
 * wireContentSync({ ws: ws, editorPane: editorPane, getCurrentFilePath: '/home/user/project/src/main.ts', });
 * ```
 */
export function wireContentSync({
  ws,
  editorPane,
  getCurrentFilePath,
}: {
  readonly ws: EditorWsClientHandle;
  readonly editorPane: EditorPaneHandle;
  readonly getCurrentFilePath: GetCurrentFilePathFn;
},): void {
  editorPane.addEventListener(
    'contentchange',
    createDebounced({
      fn: function syncContent() {
        /**
         * Path of the currently open file; `null` means no file is open, so the change is dropped.
         */
        const path = getCurrentFilePath();
        if (path === null)
          return;
        void ws.notify({
          type: 'didChange',
          path,
          content: editorPane.getText(),
        },);
      },
      delayMs: CONTENT_SYNC_DEBOUNCE_MS,
    },)
      .debounced,
  );
}

/**
 * Wires diagnostic push handling from the server to the editor pane.
 *
 * @param ws - WebSocket client
 *
 * @param editorPane - editor pane component to render diagnostics on
 *
 * @param getCurrentFilePath - returns the current file path
 *
 * @example
 * ```ts
 * wireDiagnostics({ ws: ws, editorPane: editorPane, getCurrentFilePath: '/home/user/project/src/main.ts', });
 * ```
 */
export function wireDiagnostics({
  ws,
  editorPane,
  getCurrentFilePath,
}: {
  readonly ws: EditorWsClientHandle;
  readonly editorPane: EditorPaneHandle;
  readonly getCurrentFilePath: GetCurrentFilePathFn;
},): void {
  ws.setDiagnosticsHandler(function handleDiagnostics({
    path,
    diagnostics,
  },): void {
    if (path === getCurrentFilePath())
      editorPane.setDiagnostics(diagnostics,);
  },);
}
