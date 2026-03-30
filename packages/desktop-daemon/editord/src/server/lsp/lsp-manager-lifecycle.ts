/**
 * Document lifecycle and notification routing for the LSP manager.
 *
 * Forwards didOpen/didChange/didSave/didClose to the
 * document sync module after resolving server slots.
 * Routes incoming LSP notifications to the diagnostic store.
 */

import type { DiagnosticStore, } from './diagnostic-store.ts';
import {
  didChange as syncChange,
  didClose as syncClose,
  didOpen as syncOpen,
  didSave as syncSave,
  type DocumentState,
} from './document-sync.ts';
import type { LspPool, } from './lsp-pool.ts';
import type { LspDiagnostic, } from './types.ts';
import { pathToUri, } from './uri.ts';

/**
 * Checks whether a document is currently tracked by the LSP sync layer.
 *
 * @param path - absolute file path
 *
 * @param documents - open document state map
 *
 * @returns true when the document has been registered via didOpen
 */
function isTracked({
  path,
  documents,
}: {
  path: string;
  documents: Map<string, DocumentState>;
},): boolean {
  return documents.has(pathToUri({ path, },),);
}

/**
 * Notifies servers that a file was opened.
 *
 * @param pool - LSP server pool
 *
 * @param documents - open document state map
 *
 * @param path - absolute file path
 *
 * @param text - initial file content
 */
export async function managerDidOpen({
  pool,
  documents,
  path,
  text,
}: {
  pool: LspPool;
  documents: Map<string, DocumentState>;
  path: string;
  text: string;
},): Promise<void> {
  syncOpen({
    path,
    text,
    documents,
    servers: await pool.resolveAll({ path, },),
  },);
}

/**
 * Notifies servers that a file's content changed.
 *
 * @param pool - LSP server pool
 *
 * @param documents - open document state map
 *
 * @param path - absolute file path
 *
 * @param text - updated file content
 */
export async function managerDidChange({
  pool,
  documents,
  path,
  text,
}: {
  pool: LspPool;
  documents: Map<string, DocumentState>;
  path: string;
  text: string;
},): Promise<void> {
  if (!isTracked({ path, documents, },))
    return;
  syncChange({
    path,
    text,
    documents,
    servers: await pool.resolveAll({ path, },),
  },);
}

/**
 * Notifies servers that a file was saved.
 *
 * @param pool - LSP server pool
 *
 * @param documents - open document state map
 *
 * @param path - absolute file path
 */
export async function managerDidSave({
  pool,
  documents,
  path,
}: {
  pool: LspPool;
  documents: Map<string, DocumentState>;
  path: string;
},): Promise<void> {
  if (!isTracked({ path, documents, },))
    return;
  syncSave({
    path,
    documents,
    servers: await pool.resolveAll({ path, },),
  },);
}

/**
 * Notifies servers that a file was closed and clears its diagnostics.
 *
 * @param pool - LSP server pool
 *
 * @param documents - open document state map
 *
 * @param diagnostics - diagnostic store to clear
 *
 * @param path - absolute file path
 */
export async function managerDidClose({
  pool,
  documents,
  diagnostics,
  path,
}: {
  pool: LspPool;
  documents: Map<string, DocumentState>;
  diagnostics: DiagnosticStore;
  path: string;
},): Promise<void> {
  diagnostics.delete({ uri: pathToUri({ path, },), },);
  syncClose({
    path,
    documents,
    servers: await pool.resolveAll({ path, },),
  },);
}

/**
 * Routes an incoming LSP notification to the diagnostic store.
 * Only handles `textDocument/publishDiagnostics`; other notifications are ignored.
 *
 * @param diagnostics - diagnostic store to update
 *
 * @param source - server type that sent the notification
 *
 * @param method - LSP notification method name
 *
 * @param params - notification parameters
 */
export function routeNotification({
  diagnostics,
  source,
  method,
  params,
}: {
  diagnostics: DiagnosticStore;
  source: string;
  method: string;
  params: unknown;
},): void {
  if (method === 'textDocument/publishDiagnostics') {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- LSP publishDiagnostics shape
    const p = params as {
      uri: string;
      diagnostics: LspDiagnostic[];
    };
    diagnostics.update({
      source,
      uri: p.uri,
      diagnostics: p.diagnostics,
    },);
  }
}
