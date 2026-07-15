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
  readonly path: string;
  readonly documents: ReadonlyMap<string, DocumentState>;
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
 *
 * @example
 * ```ts
 * await managerDidOpen({ pool, documents, path: '/home/user/project/src/main.ts', text: 'const x = 42;', });
 * ```
 */
export async function managerDidOpen({
  pool,
  documents,
  path,
  text,
}: {
  readonly pool: LspPool;
  readonly documents: Map<string, DocumentState>;
  readonly path: string;
  readonly text: string;
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
 *
 * @example
 * ```ts
 * await managerDidChange({ pool, documents, path: '/home/user/project/src/main.ts', text: 'const y = 99;', });
 * ```
 */
export async function managerDidChange({
  pool,
  documents,
  path,
  text,
}: {
  readonly pool: LspPool;
  readonly documents: Map<string, DocumentState>;
  readonly path: string;
  readonly text: string;
},): Promise<void> {
  if (!isTracked({
    path,
    documents,
  },)) {
    return;
  }
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
 *
 * @example
 * ```ts
 * await managerDidSave({ pool, documents, path: '/home/user/project/src/main.ts', });
 * ```
 */
export async function managerDidSave({
  pool,
  documents,
  path,
}: {
  readonly pool: LspPool;
  readonly documents: ReadonlyMap<string, DocumentState>;
  readonly path: string;
},): Promise<void> {
  if (!isTracked({
    path,
    documents,
  },)) {
    return;
  }
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
 *
 * @example
 * ```ts
 * await managerDidClose({ pool, documents, diagnostics: diagnosticStore, path: '/home/user/project/src/main.ts', });
 * ```
 */
export async function managerDidClose({
  pool,
  documents,
  diagnostics,
  path,
}: {
  readonly pool: LspPool;
  readonly documents: Map<string, DocumentState>;
  readonly diagnostics: DiagnosticStore;
  readonly path: string;
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
 *
 * @example
 * ```ts
 * routeNotification({
 *   diagnostics: diagnosticStore,
 *   source: 'tsc',
 *   method: 'textDocument/publishDiagnostics',
 *   params: { uri: 'file:///src/main.ts', diagnostics: [] },
 * });
 * ```
 */
export function routeNotification({
  diagnostics,
  source,
  method,
  params,
}: {
  readonly diagnostics: DiagnosticStore;
  readonly source: string;
  readonly method: string;
  readonly params: unknown;
},): void {
  if (method === 'textDocument/publishDiagnostics') {
    /**
     * Narrowed view of `params` for the `publishDiagnostics` LSP notification.
     */
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- LSP publishDiagnostics shape
    const p = params as {
      readonly uri: string;
      readonly diagnostics: LspDiagnostic[];
    };
    diagnostics.update({
      source,
      uri: p.uri,
      diagnostics: p.diagnostics,
    },);
  }
}
