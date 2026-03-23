/**
 * Coordinates LSP server processes for editord.
 *
 * Delegates server lifecycle to {@link LspPool}, which lazily creates
 * and caches servers per `(type, projectRoot)`. This module owns
 * document tracking, diagnostic aggregation, and feature dispatch.
 */

import { tagged, type Logger, } from '../log.ts';
import { DiagnosticStore, type DiagnosticsHandler, type WireDiagnostic, } from './diagnostic-store.ts';
import type { DocumentState, } from './document-sync.ts';
import { managerDidChange, managerDidClose, managerDidOpen, managerDidSave, routeNotification, } from './lsp-manager-lifecycle.ts';
import { managerCompletion, managerFormat, managerGotoDefinition, managerHover, managerInlayHints, managerReferences, managerSelectionRange, } from './lsp-manager-requests.ts';
import { LspPool, } from './lsp-pool.ts';
import type { LspCompletionItem, LspHover, LspInlayHint, LspSelectionRange, LspTextEdit, } from './types.ts';

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
    const managerLog = tagged({ tag: 'lsp', l, },);
    this.#diagnostics = new DiagnosticStore({ onDiagnostics, },);
    const diagStore = this.#diagnostics;
    this.#pool = new LspPool({
      ceiling, l: managerLog,
      onNotification: function handleNotification(event: { source: string; method: string; params: unknown },): void {
        routeNotification({ diagnostics: diagStore, ...event, },);
      },
    },);
  }

  /**
   * Notifies LSP servers that a file was opened.
   *
   * @param path - absolute file path
   */
  async didOpen({ path, text, }: { path: string; text: string }): Promise<void> {
    await managerDidOpen({ pool: this.#pool, documents: this.#documents, path, text, },);
  }

  /**
   * Notifies LSP servers that a file's content changed.
   *
   * @param path - absolute file path
   */
  async didChange({ path, text, }: { path: string; text: string }): Promise<void> {
    await managerDidChange({ pool: this.#pool, documents: this.#documents, path, text, },);
  }

  /**
   * Notifies LSP servers that a file was saved.
   *
   * @param path - absolute file path
   */
  async didSave({ path, }: { path: string }): Promise<void> {
    await managerDidSave({ pool: this.#pool, documents: this.#documents, path, },);
  }

  /**
   * Notifies LSP servers that a file was closed.
   *
   * @param path - absolute file path
   */
  async didClose({ path, }: { path: string }): Promise<void> {
    await managerDidClose({ pool: this.#pool, documents: this.#documents, diagnostics: this.#diagnostics, path, },);
  }

  /**
   * {@inheritDoc managerHover}
   *
   * @returns hover content, or null when no client is available
   */
  hover({ path, line, character, }: { path: string; line: number; character: number }): Promise<LspHover | null> {
    return managerHover({ pool: this.#pool, path, line, character, },);
  }

  /**
   * {@inheritDoc managerCompletion}
   *
   * @returns completion items, or empty array when no client is available
   */
  completion({ path, line, character, }: { path: string; line: number; character: number }): Promise<LspCompletionItem[]> {
    return managerCompletion({ pool: this.#pool, path, line, character, },);
  }

  /**
   * {@inheritDoc managerFormat}
   *
   * @returns text edits, or empty array when no client is available
   */
  format({ path, }: { path: string }): Promise<LspTextEdit[]> {
    return managerFormat({ pool: this.#pool, path, },);
  }

  /**
   * {@inheritDoc managerGotoDefinition}
   *
   * @returns definition location, or null when no client is available
   */
  gotoDefinition({ path, line, character, }: { path: string; line: number; character: number }): Promise<{ path: string; line: number; character: number } | null> {
    return managerGotoDefinition({ pool: this.#pool, path, line, character, },);
  }

  /**
   * {@inheritDoc managerReferences}
   *
   * @returns reference locations, or empty array when no client is available
   */
  references({ path, line, character, }: { path: string; line: number; character: number }): Promise<{ path: string; line: number; character: number }[]> {
    return managerReferences({ pool: this.#pool, path, line, character, },);
  }

  /**
   * {@inheritDoc managerInlayHints}
   *
   * @returns inlay hints, or empty array when no client is available
   */
  inlayHints({ path, range, }: { path: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }): Promise<LspInlayHint[]> {
    return managerInlayHints({ pool: this.#pool, path, range, },);
  }

  /**
   * {@inheritDoc managerSelectionRange}
   *
   * @returns selection ranges, or empty array when no client is available
   */
  selectionRange({ path, positions, }: { path: string; positions: { line: number; character: number }[] }): Promise<LspSelectionRange[]> {
    return managerSelectionRange({ pool: this.#pool, path, positions, },);
  }

  /** Gracefully shuts down all pooled LSP servers. */
  shutdown(): void { this.#pool.shutdown(); }

  /**
   * Shuts down LSP servers whose project root covers the given path.
   *
   * @param path - absolute file or directory path
   */
  async shutdownForPath({ path, }: { path: string }): Promise<void> {
    await this.#pool.shutdownForPath({ path, },);
  }
}
