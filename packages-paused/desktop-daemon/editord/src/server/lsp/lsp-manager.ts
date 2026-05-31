/**
 * Coordinates LSP server processes for editord.
 *
 * Delegates server lifecycle to {@link LspPool}, which lazily creates
 * and caches servers per `(type, projectRoot)`. This module owns
 * document tracking, diagnostic aggregation, and feature dispatch.
 */

import { FILE_SIZE_WARNING_THRESHOLD, } from '../../constants.ts';
import type {
  FilePosition,
  Range,
} from '../../protocol.ts';
import {
  type Logger,
  tagged,
} from '../log.ts';
import {
  createDiagnosticStore,
  type DiagnosticsHandler,
  type WireDiagnostic,
} from './diagnostic-store.ts';
import type { DocumentState, } from './document-sync.ts';
import type { PrepareRenameResult, } from './lsp-features-rename.ts';
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
  managerPrepareRename,
  managerReferences,
  managerRename,
  managerSelectionRange,
} from './lsp-manager-requests.ts';
import { createLspPool, } from './lsp-pool.ts';
import type {
  LspCompletionItem,
  LspHover,
  LspInlayHint,
  LspSelectionRange,
  LspTextEdit,
  LspWorkspaceEdit,
} from './types.ts';
import { pathToUri, } from './uri.ts';

export type {
  DiagnosticsHandler,
  WireDiagnostic,
};

//region LspManager type

/**
 * Manages LSP servers via a lazy pool, routing documents and features.
 */
export type LspManager = {
  /**
   * Notifies LSP servers that a file was opened.
   * Files exceeding {@link FILE_SIZE_WARNING_THRESHOLD} are silently
   * skipped; no document is registered, so all subsequent operations
   * (didChange, hover, completions, etc.) become no-ops for that path.
   */
  readonly didOpen: (opts: {
    readonly path: string;
    readonly text: string;
    readonly size: number;
  },) => Promise<void>;
  /**
   * Notifies LSP servers that a file's content changed.
   */
  readonly didChange: (opts: {
    readonly path: string;
    readonly text: string;
  },) => Promise<void>;
  /**
   * Notifies LSP servers that a file was saved.
   */
  readonly didSave: (opts: { readonly path: string; },) => Promise<void>;
  /**
   * Notifies LSP servers that a file was closed.
   */
  readonly didClose: (opts: { readonly path: string; },) => Promise<void>;
  /**
   * Returns hover content, or null when no client is available.
   */
  readonly hover: (opts: FilePosition,) => Promise<LspHover | null>;
  /**
   * Returns completion items, or empty array when no client is available.
   */
  readonly completion: (opts: FilePosition,) => Promise<readonly LspCompletionItem[]>;
  /**
   * Returns text edits, or empty array when no client is available.
   */
  readonly format: (opts: { readonly path: string; },) => Promise<readonly LspTextEdit[]>;
  /**
   * Returns definition location, or null when no client is available.
   */
  readonly gotoDefinition: (opts: FilePosition,) => Promise<FilePosition | null>;
  /**
   * Returns reference locations, or empty array when no client is available.
   */
  readonly references: (opts: FilePosition,) => Promise<readonly FilePosition[]>;
  /**
   * Returns inlay hints, or empty array when no client is available.
   */
  readonly inlayHints: (opts: {
    readonly path: string;
    readonly range: Range;
  },) => Promise<readonly LspInlayHint[]>;
  /**
   * Returns selection ranges, or empty array when no client is available.
   */
  readonly selectionRange: (opts: {
    readonly path: string;
    readonly positions: readonly {
      readonly line: number;
      readonly character: number;
    }[];
  },) => Promise<readonly LspSelectionRange[]>;
  /**
   * Returns prepare-rename result, or null when symbol is not renamable.
   */
  readonly prepareRename: (opts: FilePosition,) => Promise<PrepareRenameResult | null>;
  /**
   * Returns workspace edit for rename, or null when rename failed.
   */
  readonly rename: (opts: {
    readonly path: string;
    readonly line: number;
    readonly character: number;
    readonly newName: string;
  },) => Promise<LspWorkspaceEdit | null>;
  /**
   * Gracefully shuts down all pooled LSP servers and waits for completion.
   */
  readonly shutdown: () => Promise<void>;
  /**
   * Shuts down LSP servers whose project root covers the given path.
   */
  readonly shutdownForPath: (opts: { readonly path: string; },) => Promise<void>;
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
 *
 * @example
 * ```ts
 * const manager = createLspManager({
 *   ceiling: '/home/user/project',
 *   onDiagnostics: function handleDiagnostics({ path, diagnostics }) { updateUI(path, diagnostics); },
 *   l: rootLogger,
 * });
 * ```
 */
export function createLspManager({
  ceiling,
  onDiagnostics,
  l,
}: {
  readonly ceiling: string;
  readonly onDiagnostics: DiagnosticsHandler;
  readonly l: Logger;
},): LspManager {
  /**
   * Tagged logger forwarded to all subsystems so log lines stay attributable.
   */
  const managerLog = tagged({
    tag: 'lsp',
    l,
  },);
  /**
   * Per-file diagnostic aggregator that fans out to the manager's `onDiagnostics`.
   */
  const diagnostics = createDiagnosticStore({ onDiagnostics, },);
  /**
   * URI-keyed document state shared across the didOpen/didChange/didClose helpers.
   */
  const documents = new Map<string, DocumentState>();
  /**
   * LSP server pool keyed by `<type>:<root>`; each entry is lazy.
   */
  const pool = createLspPool({
    ceiling,
    l: managerLog,
    onNotification: function handleNotification(
      event: {
        readonly source: string;
        readonly method: string;
        readonly params: unknown;
      },
    ): void {
      routeNotification({
        diagnostics,
        ...event,
      },);
    },
  },);

  /**
   * Checks whether a file is tracked by the document sync layer.
   * Files that were too large at open time are never registered,
   * so all feature requests for them return empty fallbacks without
   * touching the LSP pool.
   *
   * @param path - absolute file path
   *
   * @returns true when the file has an active LSP document session
   */
  function hasDocument({ path, }: { readonly path: string; },): boolean {
    return documents.has(pathToUri({ path, },),);
  }

  return {
    didOpen({
      path,
      text,
      size,
    },) {
      if (size > FILE_SIZE_WARNING_THRESHOLD) {
        managerLog.info(`skipping LSP for large file (${String(size,)} bytes): ${path}`,);
        return Promise.resolve();
      }
      return managerDidOpen({
        pool,
        documents,
        path,
        text,
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
      if (!hasDocument({ path: opts.path, },))
        return Promise.resolve(null,);
      return managerHover({
        pool,
        ...opts,
      },);
    },
    completion(opts,) {
      if (!hasDocument({ path: opts.path, },))
        return Promise.resolve([],);
      return managerCompletion({
        pool,
        ...opts,
      },);
    },
    format(opts,) {
      if (!hasDocument({ path: opts.path, },))
        return Promise.resolve([],);
      return managerFormat({
        pool,
        ...opts,
      },);
    },
    gotoDefinition(opts,) {
      if (!hasDocument({ path: opts.path, },))
        return Promise.resolve(null,);
      return managerGotoDefinition({
        pool,
        ...opts,
      },);
    },
    references(opts,) {
      if (!hasDocument({ path: opts.path, },))
        return Promise.resolve([],);
      return managerReferences({
        pool,
        ...opts,
      },);
    },
    inlayHints(opts,) {
      if (!hasDocument({ path: opts.path, },))
        return Promise.resolve([],);
      return managerInlayHints({
        pool,
        ...opts,
      },);
    },
    selectionRange(opts,) {
      if (!hasDocument({ path: opts.path, },))
        return Promise.resolve([],);
      return managerSelectionRange({
        pool,
        ...opts,
      },);
    },
    prepareRename(opts,) {
      if (!hasDocument({ path: opts.path, },))
        return Promise.resolve(null,);
      return managerPrepareRename({
        pool,
        ...opts,
      },);
    },
    rename(opts,) {
      if (!hasDocument({ path: opts.path, },))
        return Promise.resolve(null,);
      return managerRename({
        pool,
        ...opts,
      },);
    },
    async shutdown(): Promise<void> {
      await pool.shutdown();
    },
    shutdownForPath(opts,) {
      return pool.shutdownForPath(opts,);
    },
  };
}

//endregion Factory
