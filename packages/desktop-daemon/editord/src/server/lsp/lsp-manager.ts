/**
 * Coordinates LSP server processes for editord.
 *
 * Delegates server lifecycle to {@link LspPool}, which lazily creates
 * and caches servers per `(type, projectRoot)`. This module owns
 * document tracking, diagnostic aggregation, and feature dispatch.
 */

import { pathToFileURL, } from 'node:url';

import { tagged, type Logger, } from '../log.ts';
import { DiagnosticStore, type DiagnosticsHandler, type WireDiagnostic, } from './diagnostic-store.ts';
import {
  type DocumentState,
  didChange as syncChange, didClose as syncClose,
  didOpen as syncOpen, didSave as syncSave,
} from './document-sync.ts';
import { requestCompletion, requestFormat, requestGotoDefinition, requestHover, requestInlayHints, requestReferences, requestSelectionRange, } from './lsp-features.ts';
import { LspPool, } from './lsp-pool.ts';
import type { LspCompletionItem, LspDiagnostic, LspHover, LspInlayHint, LspSelectionRange, LspTextEdit, } from './types.ts';

export type { DiagnosticsHandler, WireDiagnostic, };

/** Manages LSP servers via a lazy pool, routing documents and features. */
export class LspManager {
  /** Server pool keyed by `(type, projectRoot)`. */
  #pool: LspPool;
  /** Open documents keyed by URI. */
  #documents = new Map<string, DocumentState>();
  /** Diagnostic aggregator. */
  #diagnostics: DiagnosticStore;

  /**
   * @param ceiling - highest directory for config-file search (file tree root)
   *
   * @param onDiagnostics - callback when merged diagnostics change
   *
   * @param l - parent logger
   */
  constructor({ ceiling, onDiagnostics, l, }: { ceiling: string; onDiagnostics: DiagnosticsHandler; l: Logger }) {
    const tl = tagged({ tag: 'lsp', l, },);
    this.#diagnostics = new DiagnosticStore({ onDiagnostics, },);
    const mgr = this;
    this.#pool = new LspPool({
      ceiling, l: tl,
      onNotification: function handleNotification(source: string, method: string, params: unknown,): void {
        mgr.#onNotification({ source, method, params, },);
      },
    },);
  }

  //region Document lifecycle

  /**
   * @param path - absolute file path
   */
  async didOpen({ path, text, }: { path: string; text: string }): Promise<void> {
    syncOpen({ path, text, documents: this.#documents, servers: await this.#pool.resolveAll({ path, },), },);
  }
  /**
   * @param path - absolute file path
   */
  async didChange({ path, text, }: { path: string; text: string }): Promise<void> {
    syncChange({ path, text, documents: this.#documents, servers: await this.#pool.resolveAll({ path, },), },);
  }
  /**
   * @param path - absolute file path
   */
  async didSave({ path, }: { path: string }): Promise<void> {
    syncSave({ path, documents: this.#documents, servers: await this.#pool.resolveAll({ path, },), },);
  }
  /**
   * @param path - absolute file path
   */
  async didClose({ path, }: { path: string }): Promise<void> {
    this.#diagnostics.delete({ uri: pathToFileURL(path,).href, },);
    syncClose({ path, documents: this.#documents, servers: await this.#pool.resolveAll({ path, },), },);
  }

  //endregion Document lifecycle

  //region Feature requests

  /**
   * {@inheritDoc requestHover}
   *
   * @returns hover content, or null if tsgo is unavailable
   */
  async hover({ path, line, character, }: { path: string; line: number; character: number }): Promise<LspHover | null> {
    const c = await this.#pool.resolve({ type: 'tsgo', filePath: path, },);
    return c !== null && c.initialized ? requestHover({ client: c, path, line, character, },) : null;
  }
  /**
   * {@inheritDoc requestCompletion}
   *
   * @returns completion items, or empty array if tsgo is unavailable
   */
  async completion({ path, line, character, }: { path: string; line: number; character: number }): Promise<LspCompletionItem[]> {
    const c = await this.#pool.resolve({ type: 'tsgo', filePath: path, },);
    return c !== null && c.initialized ? requestCompletion({ client: c, path, line, character, },) : [];
  }
  /**
   * {@inheritDoc requestFormat}
   *
   * @returns text edits, or empty array if dprint is unavailable
   */
  async format({ path, }: { path: string }): Promise<LspTextEdit[]> {
    const c = await this.#pool.resolve({ type: 'dprint', filePath: path, },);
    return c !== null && c.initialized ? requestFormat({ client: c, path, },) : [];
  }
  /**
   * {@inheritDoc requestGotoDefinition}
   *
   * @returns definition location, or null if tsgo is unavailable
   */
  async gotoDefinition({ path, line, character, }: { path: string; line: number; character: number }): Promise<{ path: string; line: number; character: number } | null> {
    const c = await this.#pool.resolve({ type: 'tsgo', filePath: path, },);
    return c !== null && c.initialized ? requestGotoDefinition({ client: c, path, line, character, },) : null;
  }
  /**
   * {@inheritDoc requestReferences}
   *
   * @returns reference locations, or empty array if tsgo is unavailable
   */
  async references({ path, line, character, }: { path: string; line: number; character: number }): Promise<{ path: string; line: number; character: number }[]> {
    const c = await this.#pool.resolve({ type: 'tsgo', filePath: path, },);
    return c !== null && c.initialized ? requestReferences({ client: c, path, line, character, },) : [];
  }
  /**
   * {@inheritDoc requestInlayHints}
   *
   * @returns inlay hints, or empty array if tsgo is unavailable
   */
  async inlayHints({ path, range, }: {
    path: string;
    range: { start: { line: number; character: number }; end: { line: number; character: number } };
  }): Promise<LspInlayHint[]> {
    const c = await this.#pool.resolve({ type: 'tsgo', filePath: path, },);
    return c !== null && c.initialized ? requestInlayHints({ client: c, path, range, },) : [];
  }
  /**
   * {@inheritDoc requestSelectionRange}
   *
   * @returns selection ranges (one per position), or empty array if tsgo is unavailable
   */
  async selectionRange({ path, positions, }: {
    path: string;
    positions: { line: number; character: number }[];
  }): Promise<LspSelectionRange[]> {
    const c = await this.#pool.resolve({ type: 'tsgo', filePath: path, },);
    return c !== null && c.initialized ? requestSelectionRange({ client: c, path, positions, },) : [];
  }

  //endregion Feature requests

  /** Routes an LSP notification to the diagnostic store. */
  #onNotification({ source, method, params, }: { source: string; method: string; params: unknown }): void {
    if (method === 'textDocument/publishDiagnostics') {
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- LSP publishDiagnostics shape
      const p = params as { uri: string; diagnostics: LspDiagnostic[] };
      this.#diagnostics.update({ source, uri: p.uri, diagnostics: p.diagnostics, },);
    }
  }

  /** Gracefully shuts down all pooled LSP servers. */
  shutdown(): void { this.#pool.shutdown(); }

  /**
   * Shuts down LSP servers whose project root covers the given path.
   * Called before retrying move/delete operations that fail due to
   * file locks held by LSP processes (Windows `EBUSY`/`EPERM`).
   *
   * @param path - absolute file or directory path
   */
  async shutdownForPath({ path, }: { path: string }): Promise<void> {
    await this.#pool.shutdownForPath({ path, },);
  }
}
