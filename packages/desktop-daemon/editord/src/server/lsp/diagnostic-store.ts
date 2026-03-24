/**
 * Stores and merges diagnostics from multiple LSP sources.
 *
 * Each source (e.g. oxlint, tsgo) publishes diagnostics independently.
 * The store keeps the latest set per source per URI and merges them
 * into a single array for the client whenever any source updates.
 */

import { fileURLToPath, } from 'node:url';

import type { Range, } from '../../protocol.ts';
import type { LspDiagnostic, } from './types.ts';

/** Severity number to wire severity string mapping. */
const SEVERITY_MAP: Record<number, 'error' | 'warning' | 'info' | 'hint'> = {
  1: 'error',
  2: 'warning',
  3: 'info',
  4: 'hint',
};

/** Diagnostic in wire format (ready for WebSocket transport to client). */
export type WireDiagnostic = {
  /** Text range for the diagnostic. */
  range: Range;
  /** Severity level. */
  severity: 'error' | 'warning' | 'info' | 'hint';
  /** Human-readable message. */
  message: string;
  /** Source tool name. */
  source: string;
};

/** Callback signature for pushing merged diagnostics to the client. */
export type DiagnosticsHandler = (
  event: { path: string; diagnostics: WireDiagnostic[]; },
) => void;

/**
 * Stores diagnostics from multiple LSP sources and merges them per URI.
 */
export class DiagnosticStore {
  /** Diagnostics keyed by URI, then by source name. */
  #store = new Map<string, Map<string, LspDiagnostic[]>>();

  /** Callback to push merged diagnostics to the WebSocket client. */
  #onDiagnostics: DiagnosticsHandler;

  /**
   * @param onDiagnostics - callback invoked with merged diagnostics whenever a source updates
   */
  constructor({ onDiagnostics, }: { onDiagnostics: DiagnosticsHandler; },) {
    this.#onDiagnostics = onDiagnostics;
  }

  /**
   * Stores diagnostics from one source and pushes the merged set to the client.
   *
   * @param source - server name that produced these diagnostics
   *
   * @param uri - document URI
   *
   * @param diagnostics - diagnostics from this source (replaces previous set)
   */
  update(
    { source, uri, diagnostics, }: { source: string; uri: string;
      diagnostics: LspDiagnostic[]; },
  ): void {
    if (!this.#store.has(uri,))
      this.#store.set(uri, new Map(),);
    const sourceMap = this.#store.get(uri,);
    if (sourceMap === undefined)
      return;

    /** Skip merge and broadcast when this source's diagnostics are unchanged. */
    const previous = sourceMap.get(source,);
    if (previous !== undefined
      && previous.length === diagnostics.length
      && JSON.stringify(previous,) === JSON.stringify(diagnostics,))
    {
      return;
    }

    sourceMap.set(source, diagnostics,);

    /** Merge diagnostics from all sources for this URI. */
    const merged: WireDiagnostic[] = [];
    for (const [sourceName, sourceDiags,] of sourceMap) {
      for (const diag of sourceDiags) {
        merged.push({
          range: diag.range,
          severity: (diag
              .severity !== undefined
            ? SEVERITY_MAP[diag.severity]
            : undefined) ?? 'info',
          message: diag.message,
          source: diag.source ?? sourceName,
        },);
      }
    }

    const path = uri.startsWith('file://',) ? fileURLToPath(uri,) : uri;
    this.#onDiagnostics({ path, diagnostics: merged, },);
  }

  /**
   * Removes all stored diagnostics for a URI.
   *
   * @param uri - document URI to clear
   */
  delete({ uri, }: { uri: string; },): void {
    this.#store.delete(uri,);
  }
}
