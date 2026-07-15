/**
 * LSP feature request handlers.
 *
 * Standalone functions that forward hover and completion
 * requests to the appropriate LSP client.
 * Separated from the manager class to keep each file focused.
 */

import {
  LSP_FEATURE_TIMEOUT_MS,
  type LspClient,
} from './lsp-client.ts';
import type {
  LspCompletionItem,
  LspHover,
} from './types.ts';
import { pathToUri, } from './uri.ts';

export {
  requestInlayHints,
  requestSelectionRange,
} from './lsp-features-extra.ts';
export { requestFormat, } from './lsp-features-format.ts';
export {
  requestGotoDefinition,
  requestReferences,
} from './lsp-features-nav.ts';

/**
 * Requests hover information from an LSP client.
 *
 * @param client - LSP client to query (typically tsc)
 *
 * @param path - absolute file path
 *
 * @param line - 0-based line number
 *
 * @param character - 0-based character offset
 *
 * @returns hover result, or null if unavailable
 *
 * @example
 * ```ts
 * const result = await requestHover({ client: client, path: '/home/user/project/src/main.ts', line: 10, character: 5, });
 * ```
 */
export async function requestHover({
  client,
  path,
  line,
  character,
}: {
  readonly client: LspClient;
  readonly path: string;
  readonly line: number;
  readonly character: number;
},): Promise<LspHover | null> {
  /**
   * LSP wire format expects a URI, not a filesystem path.
   */
  const uri = pathToUri({ path, },);
  /**
   * LSP hover payload; null when no hover is available at the position.
   */
  const result = await client.request({
    method: 'textDocument/hover',
    params: {
      textDocument: { uri, },
      position: {
        line,
        character,
      },
    },
    timeoutMs: LSP_FEATURE_TIMEOUT_MS,
  },);

  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- LSP hover returns LspHover | null
  return result as LspHover | null;
}

/**
 * Requests completion items from an LSP client.
 *
 * @param client - LSP client to query (typically tsc)
 *
 * @param path - absolute file path
 *
 * @param line - 0-based line number
 *
 * @param character - 0-based character offset
 *
 * @returns array of completion items
 *
 * @example
 * ```ts
 * const result = await requestCompletion({ client: client, path: '/home/user/project/src/main.ts', line: 10, character: 5, });
 * ```
 */
export async function requestCompletion({
  client,
  path,
  line,
  character,
}: {
  readonly client: LspClient;
  readonly path: string;
  readonly line: number;
  readonly character: number;
},): Promise<LspCompletionItem[]> {
  /**
   * LSP wire format expects a URI, not a filesystem path.
   */
  const uri = pathToUri({ path, },);
  /**
   * LSP completion can return null, an array, or a CompletionList; normalised below.
   */
  const result = await client.request({
    method: 'textDocument/completion',
    params: {
      textDocument: { uri, },
      position: {
        line,
        character,
      },
    },
    timeoutMs: LSP_FEATURE_TIMEOUT_MS,
  },);

  if ((result === null) || (result === undefined))
    return [];
  if (Array.isArray(result,)) {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- LSP completion can return CompletionItem[]
    return result as LspCompletionItem[];
  }
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- LSP completion can return CompletionList
  if ('items' in (result as Record<string, unknown>)) {
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- narrow from CompletionList shape
    return (result as { readonly items: LspCompletionItem[]; }).items;
  }

  return [];
}
