/**
 * Document lifecycle sync for LSP servers.
 *
 * Tracks open documents and their versions, forwarding
 * didOpen/didChange/didSave/didClose notifications to
 * the relevant LSP clients based on language.
 */

import { pathToFileURL, } from 'node:url';

import { getLanguageId, JS_TS_LANGUAGE_IDS, } from './language-id.ts';
import type { LspClient, } from './lsp-client.ts';

/** State tracked per open document. */
export type DocumentState = {
  /** Monotonically increasing version number. */
  version: number;
  /** LSP language identifier. */
  languageId: string;
  /** Latest full document text. */
  text: string;
};

/** Three LSP server slots passed to sync functions. */
export type ServerSlots = {
  oxlint: LspClient | null;
  tsgo: LspClient | null;
  dprint: LspClient | null;
};

/** Returns initialized LSP clients that handle a given language. */
function relevantClients({ languageId, oxlint, tsgo, dprint, }: { languageId: string } & ServerSlots): LspClient[] {
  const clients: LspClient[] = [];
  const isJsTs = JS_TS_LANGUAGE_IDS.has(languageId,);
  if (isJsTs && oxlint !== null && oxlint.initialized) clients.push(oxlint,);
  if (isJsTs && tsgo !== null && tsgo.initialized) clients.push(tsgo,);
  if (dprint !== null && dprint.initialized) clients.push(dprint,);
  return clients;
}

/** @param path - absolute file path */
export function didOpen({ path, text, documents, servers, }: {
  path: string; text: string; documents: Map<string, DocumentState>; servers: ServerSlots;
}): void {
  const uri = pathToFileURL(path,).href;
  const languageId = getLanguageId({ path, },);
  if (documents.has(uri,)) didClose({ path, documents, servers, },);
  documents.set(uri, { version: 1, languageId, text, },);
  for (const c of relevantClients({ languageId, ...servers, },)) {
    c.notify({ method: 'textDocument/didOpen', params: { textDocument: { uri, languageId, version: 1, text, }, }, },);
  }
}

/** @param path - absolute file path */
export function didChange({ path, text, documents, servers, }: {
  path: string; text: string; documents: Map<string, DocumentState>; servers: ServerSlots;
}): void {
  const uri = pathToFileURL(path,).href;
  const doc = documents.get(uri,);
  if (doc === undefined) return;
  doc.version++;
  doc.text = text;
  for (const c of relevantClients({ languageId: doc.languageId, ...servers, },)) {
    c.notify({ method: 'textDocument/didChange', params: { textDocument: { uri, version: doc.version, }, contentChanges: [{ text, },], }, },);
  }
}

/** @param path - absolute file path */
export function didSave({ path, documents, servers, }: {
  path: string; documents: Map<string, DocumentState>; servers: ServerSlots;
}): void {
  const uri = pathToFileURL(path,).href;
  const doc = documents.get(uri,);
  if (doc === undefined) return;
  for (const c of relevantClients({ languageId: doc.languageId, ...servers, },)) {
    c.notify({ method: 'textDocument/didSave', params: { textDocument: { uri, }, }, },);
  }
}

/** @param path - absolute file path */
export function didClose({ path, documents, servers, }: {
  path: string; documents: Map<string, DocumentState>; servers: ServerSlots;
}): void {
  const uri = pathToFileURL(path,).href;
  const doc = documents.get(uri,);
  if (doc === undefined) return;
  documents.delete(uri,);
  for (const c of relevantClients({ languageId: doc.languageId, ...servers, },)) {
    c.notify({ method: 'textDocument/didClose', params: { textDocument: { uri, }, }, },);
  }
}
