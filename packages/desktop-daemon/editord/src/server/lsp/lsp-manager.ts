/**
 * Coordinates multiple LSP server processes for editord.
 *
 * Delegates document sync, feature requests, diagnostics,
 * and binary resolution to focused helper modules.
 */

import { join, } from 'node:path';
import { fileURLToPath, pathToFileURL, } from 'node:url';

import { tagged, type Logger, } from '../log.ts';
import { DiagnosticStore, type DiagnosticsHandler, type WireDiagnostic, } from './diagnostic-store.ts';
import {
  type DocumentState, type ServerSlots,
  didChange as syncChange, didClose as syncClose,
  didOpen as syncOpen, didSave as syncSave,
} from './document-sync.ts';
import { LspClient, } from './lsp-client.ts';
import { requestCompletion, requestFormat, requestGotoDefinition, requestHover, } from './lsp-features.ts';
import type { LspCompletionItem, LspDiagnostic, LspHover, LspTextEdit, } from './types.ts';

export type { DiagnosticsHandler, WireDiagnostic, };

/** Manages oxlint, tsgo, and dprint LSP servers. */
export class LspManager {
  /** oxlint language server. */
  #oxlint: LspClient | null = null;
  /** tsgo language server. */
  #tsgo: LspClient | null = null;
  /** dprint language server. */
  #dprint: LspClient | null = null;
  /** Open documents keyed by URI. */
  #documents = new Map<string, DocumentState>();
  /** Diagnostic aggregator. */
  #diagnostics: DiagnosticStore;
  /** Tagged logger. */
  #l: Logger;
  /** Resolves when all servers are initialized. */
  readonly ready: Promise<void>;

  /** @param rootDir - workspace root directory */
  constructor({ rootDir, onDiagnostics, l, }: { rootDir: string; onDiagnostics: DiagnosticsHandler; l: Logger }) {
    this.#l = tagged({ tag: 'lsp', l, },);
    this.#diagnostics = new DiagnosticStore({ onDiagnostics, },);
    this.ready = this.#initServers({ rootDir, },);
  }

  /**
   * Spawns and initializes all three LSP servers independently.
   * Each server is assigned as soon as it completes so a slow or
   * hanging server does not block the others.
   */
  async #initServers({ rootDir, }: { rootDir: string }): Promise<void> {
    const rootUri = pathToFileURL(rootDir,).href;
    const binPath = join(rootDir, 'node_modules/.bin',);
    const env = { ...process.env, PATH: `${binPath}:${process.env.PATH ?? ''}`, };
    const mgr = this;

    async function initOne({ command, args, name, assign, }: {
      command: string; args: readonly string[]; name: string;
      assign: (client: LspClient | null,) => void;
    }): Promise<void> {
      const client = await mgr.#mkClient({ command, args, name, cwd: rootDir, env, rootUri, },);
      assign(client,);
      mgr.#reopenTrackedDocuments();
    }

    await Promise.allSettled([
      initOne({ command: 'oxlint', args: ['--lsp',], name: 'oxlint', assign: function setOxlint(c,) { mgr.#oxlint = c; }, },),
      initOne({ command: 'tsgo', args: ['--lsp', '--stdio',], name: 'tsgo', assign: function setTsgo(c,) { mgr.#tsgo = c; }, },),
      initOne({ command: 'dprint', args: ['lsp',], name: 'dprint', assign: function setDprint(c,) { mgr.#dprint = c; }, },),
    ],);

    this.#l.info(`servers: oxlint=${this.#oxlint !== null} tsgo=${this.#tsgo !== null} dprint=${this.#dprint !== null}`,);
  }

  /** Re-opens all tracked documents against currently available servers. */
  #reopenTrackedDocuments(): void {
    for (const [uri, doc,] of this.#documents) {
      const path = uri.startsWith('file://',) ? fileURLToPath(uri,) : uri;
      syncOpen({ path, text: doc.text, documents: this.#documents, servers: this.#servers(), },);
    }
  }

  /** Creates and initializes one LSP client, returning null on failure. */
  async #mkClient({ command, args, name, cwd, env, rootUri, }: {
    command: string; args: readonly string[]; name: string;
    cwd: string; env: Record<string, string | undefined>; rootUri: string;
  }): Promise<LspClient | null> {
    try {
      const mgr = this;
      const c = new LspClient({
        command, args, name, cwd, env, l: this.#l,
        onNotification: function onNotif(method: string, params: unknown,): void {
          mgr.#onNotification({ source: name, method, params, },);
        },
      },);
      await c.initialize({ rootUri, },);
      return c;
    }
    catch (error) { this.#l.error(`${name} init failed: ${String(error,)}`,); return null; }
  }

  /** Bundles the three server refs for document-sync. */
  #servers(): ServerSlots { return { oxlint: this.#oxlint, tsgo: this.#tsgo, dprint: this.#dprint, }; }

  /** @param path - absolute file path */
  didOpen({ path, text, }: { path: string; text: string }): void { syncOpen({ path, text, documents: this.#documents, servers: this.#servers(), },); }
  /** @param path - absolute file path */
  didChange({ path, text, }: { path: string; text: string }): void { syncChange({ path, text, documents: this.#documents, servers: this.#servers(), },); }
  /** @param path - absolute file path */
  didSave({ path, }: { path: string }): void { syncSave({ path, documents: this.#documents, servers: this.#servers(), },); }
  /** @param path - absolute file path */
  didClose({ path, }: { path: string }): void {
    const uri = pathToFileURL(path,).href;
    this.#diagnostics.delete({ uri, },);
    syncClose({ path, documents: this.#documents, servers: this.#servers(), },);
  }

  /** {@inheritDoc requestHover} */
  async hover({ path, line, character, }: { path: string; line: number; character: number }): Promise<LspHover | null> {
    if (this.#tsgo === null) { this.#l.info('hover: tsgo is null',); return null; }
    if (!this.#tsgo.initialized) { this.#l.info('hover: tsgo not initialized',); return null; }
    const uri = pathToFileURL(path,).href;
    const hasDoc = this.#documents.has(uri,);
    this.#l.info(`hover: tsgo ok, doc open=${hasDoc}, uri=${uri}`,);
    return requestHover({ client: this.#tsgo, path, line, character, l: this.#l, },);
  }
  /** {@inheritDoc requestCompletion} */
  async completion({ path, line, character, }: { path: string; line: number; character: number }): Promise<LspCompletionItem[]> {
    return this.#tsgo !== null && this.#tsgo.initialized ? requestCompletion({ client: this.#tsgo, path, line, character, },) : [];
  }
  /** {@inheritDoc requestFormat} */
  async format({ path, }: { path: string }): Promise<LspTextEdit[]> {
    return this.#dprint !== null && this.#dprint.initialized ? requestFormat({ client: this.#dprint, path, },) : [];
  }
  /** {@inheritDoc requestGotoDefinition} */
  async gotoDefinition({ path, line, character, }: { path: string; line: number; character: number }): Promise<{ path: string; line: number; character: number } | null> {
    return this.#tsgo !== null && this.#tsgo.initialized ? requestGotoDefinition({ client: this.#tsgo, path, line, character, },) : null;
  }

  /** Routes an LSP notification to the diagnostic store. */
  #onNotification({ source, method, params, }: { source: string; method: string; params: unknown }): void {
    if (method === 'textDocument/publishDiagnostics') {
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- LSP publishDiagnostics shape
      const p = params as { uri: string; diagnostics: LspDiagnostic[] };
      this.#diagnostics.update({ source, uri: p.uri, diagnostics: p.diagnostics, },);
    }
  }

  /** Gracefully shuts down all running LSP servers. */
  shutdown(): void {
    if (this.#oxlint !== null) void this.#oxlint.shutdown();
    if (this.#tsgo !== null) void this.#tsgo.shutdown();
    if (this.#dprint !== null) void this.#dprint.shutdown();
  }
}
