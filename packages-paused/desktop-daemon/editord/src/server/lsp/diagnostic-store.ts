/**
 * Stores and merges diagnostics from multiple LSP sources.
 *
 * Each source (e.g. oxlint, tsc) publishes diagnostics independently.
 * The store keeps the latest set per source per URI and merges them
 * into a single array for the client whenever any source updates.
 */

import type { Range, } from '../../protocol.ts';
import type { LspDiagnostic, } from './types.ts';
import { uriToPath, } from './uri.ts';

/**
 * Severity number to wire severity string mapping.
 */
const SEVERITY_MAP: Record<number, 'error' | 'warning' | 'info' | 'hint'> = {
  1: 'error',
  2: 'warning',
  3: 'info',
  4: 'hint',
};

/**
 * Diagnostic in wire format (ready for WebSocket transport to client).
 */
export type WireDiagnostic = {
  /**
   * Text range for the diagnostic.
   */
  readonly range: Range;
  /**
   * Severity level.
   */
  readonly severity: 'error' | 'warning' | 'info' | 'hint';
  /**
   * Human-readable message.
   */
  readonly message: string;
  /**
   * Source tool name.
   */
  readonly source: string;
};

/**
 * Callback signature for pushing merged diagnostics to the client.
 */
export type DiagnosticsHandler = (
  event: {
    readonly path: string;
    readonly diagnostics: readonly WireDiagnostic[];
  },
) => void;

/**
 * Diagnostic update payload accepted by {@link DiagnosticStore.update}.
 */
type DiagnosticUpdate = {
  /**
   * Server name that produced these diagnostics.
   */
  readonly source: string;
  /**
   * Document URI.
   */
  readonly uri: string;
  /**
   * Diagnostics from this source, replacing previous source diagnostics.
   */
  readonly diagnostics: readonly LspDiagnostic[];
};

/**
 * Stores diagnostics from multiple LSP sources and merges them per URI.
 */
export type DiagnosticStore = Readonly<{
  /**
   * Stores diagnostics from one source and pushes the merged set to the client.
   */
  readonly update: (event: DiagnosticUpdate,) => void;
  /**
   * Removes all stored diagnostics for a URI.
   */
  readonly delete: (event: { readonly uri: string; },) => void;
}>;

/**
 * Creates a diagnostic store.
 *
 * @param onDiagnostics - callback invoked with merged diagnostics whenever a source updates
 *
 * @returns frozen diagnostic store handle
 *
 * @example
 * ```ts
 * const store = createDiagnosticStore({
 *   onDiagnostics: function handleDiagnostics({ path, diagnostics }) { console.info(path, diagnostics.length); },
 * });
 * ```
 */
export function createDiagnosticStore(
  { onDiagnostics, }: { readonly onDiagnostics: DiagnosticsHandler; },
): DiagnosticStore {
  /**
   * Diagnostics keyed by URI, then by source name.
   */
  const store = new Map<string, Map<string, readonly LspDiagnostic[]>>();

  /**
   * Stores diagnostics from one source and pushes the merged set to the client.
   *
   * @param source - server name that produced these diagnostics
   *
   * @param uri - document URI
   *
   * @param diagnostics - diagnostics from this source (replaces previous set)
   */
  function update(
    {
      source,
      uri,
      diagnostics,
    }: DiagnosticUpdate,
  ): void {
    if (!store.has(uri,)) {
      store.set(
        uri,
        new Map(),
      );
    }
    /**
     * URI-keyed inner map; guaranteed by the `set` above but typed as optional.
     */
    const sourceMap = store.get(uri,);
    if (sourceMap === undefined)
      return;

    /**
     * Skip merge and broadcast when this source's diagnostics are unchanged.
     */
    const previous = sourceMap.get(source,);
    if ((previous !== undefined)
      && (previous.length
        === diagnostics
        .length)
      && previous.every(function matchesDiagnostic(
        prev,
        i,
      ) {
        /**
         * Counterpart in the new array; undefined on length mismatch (handled above).
         */
        const next = diagnostics[i];
        if (next === undefined)
          return false;
        return (prev.message
          === next
          .message)
          && (prev.severity
            === next
            .severity)
          && (prev.source
            === next
            .source)
          && (prev.range
            .start
            .line
            === next
            .range
            .start
            .line)
          && (prev.range
            .start
            .character
            === next
            .range
            .start
            .character)
          && (prev.range
            .end
            .line
            === next
            .range
            .end
            .line)
          && (prev.range
            .end
            .character
            === next
            .range
            .end
            .character);
      },))
    {
      return;
    }

    sourceMap.set(
      source,
      diagnostics,
    );

    /**
     * Merge diagnostics from all sources for this URI.
     */
    const merged: readonly WireDiagnostic[] = Array.from(
      sourceMap.entries(),
      function mergeSourceDiagnostics([sourceName, sourceDiags,],) {
        return sourceDiags.map(function toWireDiagnostic(diag,) {
          return {
            range: diag.range,
            severity: (diag
                .severity
              !== undefined
              ? SEVERITY_MAP[diag.severity]
              : undefined) ?? 'info',
            message: diag.message,
            source: diag.source
              ?? sourceName,
          };
        },);
      },
    )
      .flat();

    /**
     * Filesystem path returned to the broadcast handler; the wire form was URI.
     */
    const path = uriToPath({ uri, },);
    onDiagnostics({
      path,
      diagnostics: merged,
    },);
  }

  /**
   * Removes all stored diagnostics for a URI.
   *
   * @param uri - document URI to clear
   */
  function deleteFn({ uri, }: { readonly uri: string; },): void {
    store.delete(uri,);
  }

  return Object.freeze({
    update,
    delete: deleteFn,
  },);
}
