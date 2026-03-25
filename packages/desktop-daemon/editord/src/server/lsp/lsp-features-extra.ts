/**
 * Additional LSP feature request handlers.
 *
 * Inlay hints and selection range requests, split from lsp-features.ts
 * to stay under max-lines.
 */

import { pathToFileURL, } from 'node:url';

import {
  LSP_FEATURE_TIMEOUT_MS,
  type LspClient,
} from './lsp-client.ts';
import type {
  LspInlayHint,
  LspSelectionRange,
} from './types.ts';

/**
 * Requests inlay hints from an LSP client for a given range.
 *
 * @param client - LSP client to query (typically tsgo)
 *
 * @param path - absolute file path
 *
 * @param range - range to request hints for
 *
 * @returns array of inlay hints
 */
export async function requestInlayHints({
  client,
  path,
  range,
}: {
  client: LspClient;
  path: string;
  range: {
    start: { line: number; character: number; };
    end: { line: number; character: number; }
  };
},): Promise<LspInlayHint[]> {
  const uri = pathToFileURL(path,).href;
  const result = await client.request({
    method: 'textDocument/inlayHint',
    params: {
      textDocument: { uri, },
      range,
    },
    timeoutMs: LSP_FEATURE_TIMEOUT_MS,
  },);

  if (result === null || result === undefined)
    return [];

  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- LSP inlayHint returns InlayHint[]
  return result as LspInlayHint[];
}

/**
 * Requests selection ranges from an LSP client for a set of positions.
 * Each returned range has a nested `parent` chain representing
 * progressively larger syntactic scopes.
 *
 * @param client - LSP client to query (typically tsgo)
 *
 * @param path - absolute file path
 *
 * @param positions - cursor positions to compute selection ranges for
 *
 * @returns array of selection ranges (one per input position), or empty if unavailable
 */
export async function requestSelectionRange({
  client,
  path,
  positions,
}: {
  client: LspClient;
  path: string;
  positions: {
    line: number;
    character: number
  }[];
},): Promise<LspSelectionRange[]> {
  const uri = pathToFileURL(path,).href;
  const result = await client.request({
    method: 'textDocument/selectionRange',
    params: {
      textDocument: { uri, },
      positions,
    },
    timeoutMs: LSP_FEATURE_TIMEOUT_MS,
  },);

  if (result === null || result === undefined || !Array.isArray(result,))
    return [];

  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- LSP selectionRange returns SelectionRange[]
  return result as LspSelectionRange[];
}
