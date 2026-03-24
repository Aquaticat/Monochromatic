/**
 * Document lifecycle sync for LSP servers.
 *
 * Tracks open documents and their versions, forwarding
 * didOpen/didChange/didSave/didClose notifications to
 * the relevant LSP clients based on language.
 */

import { pathToFileURL, } from 'node:url';

import type {
  DocumentState,
  ServerSlots,
} from './document-sync-types.ts';
import {
  getLanguageId,
  JS_TS_LANGUAGE_IDS,
} from './language-id.ts';
import type { LspClient, } from './lsp-client.ts';

export type {
  DocumentState,
  ServerSlots,
};

/**
 * Returns initialized LSP clients that handle a given language.
 *
 * @returns array of initialized clients relevant to the language
 */
function relevantClients(
  { languageId, oxlint, tsgo, dprint, }: { languageId: string; } & ServerSlots,
): LspClient[] {
  const clients: LspClient[] = [];
  const isJsTs = JS_TS_LANGUAGE_IDS.has(languageId,);
  if (isJsTs && oxlint !== null && oxlint.initialized)
    clients.push(oxlint,);
  if (isJsTs && tsgo !== null && tsgo.initialized)
    clients.push(tsgo,);
  if (dprint !== null && dprint.initialized)
    clients.push(dprint,);
  return clients;
}

/**
 * Registers a file as open and notifies relevant LSP servers.
 *
 * @param path - absolute file path
 */
export function didOpen({ path, text, documents, servers, }: {
  path: string;
  text: string;
  documents: Map<string, DocumentState>;
  servers: ServerSlots;
},): void {
  const uri = pathToFileURL(path,).href;
  const languageId = getLanguageId({ path, },);
  if (documents.has(uri,))
    didClose({ path, documents, servers, },);
  documents.set(uri, { version: 1, languageId, text, },);
  for (const c of relevantClients({ languageId, ...servers, },)) {
    c.notify({ method: 'textDocument/didOpen',
      params: { textDocument: { uri, languageId, version: 1, text, }, }, },);
  }
}

/**
 * Pushes a full-content change to relevant LSP servers and bumps the version.
 *
 * @param path - absolute file path
 */
export function didChange({ path, text, documents, servers, }: {
  path: string;
  text: string;
  documents: Map<string, DocumentState>;
  servers: ServerSlots;
},): void {
  const uri = pathToFileURL(path,).href;
  const doc = documents.get(uri,);
  if (doc === undefined)
    return;
  doc.version++;
  doc.text = text;
  for (const c of relevantClients({ languageId: doc.languageId, ...servers, },)) {
    c.notify({ method: 'textDocument/didChange',
      params: { textDocument: { uri, version: doc.version, },
        contentChanges: [{ text, },], }, },);
  }
}

/**
 * Notifies relevant LSP servers that a file was saved.
 *
 * @param path - absolute file path
 */
export function didSave({ path, documents, servers, }: {
  path: string;
  documents: Map<string, DocumentState>;
  servers: ServerSlots;
},): void {
  const uri = pathToFileURL(path,).href;
  const doc = documents.get(uri,);
  if (doc === undefined)
    return;
  for (const c of relevantClients({ languageId: doc.languageId, ...servers, },))
    c.notify({ method: 'textDocument/didSave', params: { textDocument: { uri, }, }, },);
}

/**
 * Removes a file from tracking and notifies relevant LSP servers.
 *
 * @param path - absolute file path
 */
export function didClose({ path, documents, servers, }: {
  path: string;
  documents: Map<string, DocumentState>;
  servers: ServerSlots;
},): void {
  const uri = pathToFileURL(path,).href;
  const doc = documents.get(uri,);
  if (doc === undefined)
    return;
  documents.delete(uri,);
  for (const c of relevantClients({ languageId: doc.languageId, ...servers, },))
    c.notify({ method: 'textDocument/didClose', params: { textDocument: { uri, }, }, },);
}
