/**
 * Coordinates LSP server processes for editord.
 *
 * Delegates server lifecycle to {@link LspPool}, which lazily creates
 * and caches servers per `(type, projectRoot)`. This module owns
 * document tracking, diagnostic aggregation, and feature dispatch.
 */

import type {
  FilePosition,
  Range,
} from '../../protocol.ts';
import {
  type Logger,
  tagged,
} from '../log.ts';
import {
  type DiagnosticsHandler,
  DiagnosticStore,
  type WireDiagnostic,
} from './diagnostic-store.ts';
import type { DocumentState, } from './document-sync.ts';
import {
  managerDidChange,
  managerDidClose,
  managerDidOpen,
  managerDidSave,
  routeNotification,
} from './lsp-manager-lifecycle.ts';
import {
  managerCompletion,
  managerFormat,
  managerGotoDefinition,
  managerHover,
  managerInlayHints,
  managerReferences,
  managerSelectionRange,
} from './lsp-manager-requests.ts';
import { LspPool, } from './lsp-pool.ts';
import type {
  LspCompletionItem,
  LspHover,
  LspInlayHint,
  LspSelectionRange,
  LspTextEdit,
} from './types.ts';

export type {
  DiagnosticsHandler,
  WireDiagnostic,
};

//region LspManager type

/** Manages LSP servers via a lazy pool, routing documents and features. */
export type LspManager = {
  /** Notifies LSP servers that a file was opened. */
  didOpen(opts: {
    path: string;
    text: string;
  },): Promise<void>;
  /** Notifies LSP servers that a file's content changed. */
  didChange(opts: {
    path: string;
    text: string;
  },): Promise<void>;
  /** Notifies LSP servers that a file was saved. */
  didSave(opts: { path: string; },): Promise<void>;
  /** Notifies LSP servers that a file was closed. */
  didClose(opts: { path: string; },): Promise<void>;
  /** Returns hover content, or null when no client is available. */
  hover(opts: FilePosition,): Promise<LspHover | null>;
  /** Returns completion items, or empty array when no client is available. */
  completion(opts: FilePosition,): Promise<LspCompletionItem[]>;
  /** Returns text edits, or empty array when no client is available. */
  format(opts: { path: string; },): Promise<LspTextEdit[]>;
  /** Returns definition location, or null when no client is available. */
  gotoDefinition(opts: FilePosition,): Promise<FilePosition | null>;
  /** Returns reference locations, or empty array when no client is available. */
  references(opts: FilePosition,): Promise<FilePosition[]>;
  /** Returns inlay hints, or empty array when no client is available. */
  inlayHints(opts: {
    path: string;
    range: Range;
  },): Promise<LspInlayHint[]>;
  /** Returns selection ranges, or empty array when no client is available. */
  selectionRange(opts: {
    path: string;
    positions: {
      line: number;
      character: number;
    }[];
  },): Promise<LspSelectionRange[]>;
  /** Gracefully shuts down all pooled LSP servers. */
  shutdown(): void;
  /** Shuts down LSP servers whose project root covers the given path. */
  shutdownForPath(opts: { path: string; },): Promise<void>;
};

//endregion LspManager type

//region Factory

/**
 * Creates an LSP manager that coordinates server processes via a lazy pool.
 *
 * @param ceiling - highest directory for config-file search (file tree root)
 *
 * @param onDiagnostics - callback when merged diagnostics change
 *
 * @param l - parent logger
 *
 * @returns LSP manager instance
 */
export function createLspManager({
  ceiling,
  onDiagnostics,
  l,
}: {
  ceiling: string;
  onDiagnostics: DiagnosticsHandler;
  l: Logger;
},): LspManager {
  const managerLog = tagged({
    tag: 'lsp',
    l,
  },);
  const diagnostics = new DiagnosticStore({ onDiagnostics, },);
  const documents = new Map<string, DocumentState>();
  const pool = new LspPool({
    ceiling,
    l: managerLog,
    onNotification: function handleNotification(
      event: {
        source: string;
        method: string;
        params: unknown;
      },
    ): void {
      routeNotification({
        diagnostics,
        ...event,
      },);
    },
  },);

  return {
    didOpen(opts,) {
      return managerDidOpen({
        pool,
        documents,
        ...opts,
      },);
    },
    didChange(opts,) {
      return managerDidChange({
        pool,
        documents,
        ...opts,
      },);
    },
    didSave(opts,) {
      return managerDidSave({
        pool,
        documents,
        ...opts,
      },);
    },
    didClose(opts,) {
      return managerDidClose({
        pool,
        documents,
        diagnostics,
        ...opts,
      },);
    },
    hover(opts,) {
      return managerHover({
        pool,
        ...opts,
      },);
    },
    completion(opts,) {
      return managerCompletion({
        pool,
        ...opts,
      },);
    },
    format(opts,) {
      return managerFormat({
        pool,
        ...opts,
      },);
    },
    gotoDefinition(opts,) {
      return managerGotoDefinition({
        pool,
        ...opts,
      },);
    },
    references(opts,) {
      return managerReferences({
        pool,
        ...opts,
      },);
    },
    inlayHints(opts,) {
      return managerInlayHints({
        pool,
        ...opts,
      },);
    },
    selectionRange(opts,) {
      return managerSelectionRange({
        pool,
        ...opts,
      },);
    },
    shutdown() {
      pool.shutdown();
    },
    shutdownForPath(opts,) {
      return pool.shutdownForPath(opts,);
    },
  };
}

//endregion Factory
