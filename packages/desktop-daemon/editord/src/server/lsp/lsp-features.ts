/**
 * LSP feature request handlers.
 *
 * Standalone functions that forward hover, completion, formatting,
 * and go-to-definition requests to the appropriate LSP client.
 * Separated from the manager class to keep each file focused.
 */

import { fileURLToPath, pathToFileURL, } from 'node:url';

import type { LspClient, } from './lsp-client.ts';
import type {
  LspCompletionItem,
  LspHover,
  LspTextEdit,
} from './types.ts';

/**
 * Requests hover information from an LSP client.
 *
 * @param client - LSP client to query (typically tsgo)
 *
 * @param path - absolute file path
 *
 * @param line - 0-based line number
 *
 * @param character - 0-based character offset
 *
 * @returns hover result, or null if unavailable
 */
export async function requestHover({ client, path, line, character, }: {
  client: LspClient;
  path: string;
  line: number;
  character: number;
}): Promise<LspHover | null> {
  const uri = pathToFileURL(path,).href;
  const result = await client.request({
    method: 'textDocument/hover',
    params: { textDocument: { uri, }, position: { line, character, }, },
  },);

  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- LSP hover returns LspHover | null
  return result as LspHover | null;
}

/**
 * Requests completion items from an LSP client.
 *
 * @param client - LSP client to query (typically tsgo)
 *
 * @param path - absolute file path
 *
 * @param line - 0-based line number
 *
 * @param character - 0-based character offset
 *
 * @returns array of completion items
 */
export async function requestCompletion({ client, path, line, character, }: {
  client: LspClient;
  path: string;
  line: number;
  character: number;
}): Promise<LspCompletionItem[]> {
  const uri = pathToFileURL(path,).href;
  const result = await client.request({
    method: 'textDocument/completion',
    params: { textDocument: { uri, }, position: { line, character, }, },
  },);

  if (result === null || result === undefined)
    return [];
  if (Array.isArray(result,))
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- LSP completion can return CompletionItem[]
    return result as LspCompletionItem[];
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion, typescript-eslint/no-unsafe-member-access -- LSP completion can return CompletionList
  if ('items' in (result as Record<string, unknown>))
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- narrow from CompletionList shape
    return (result as { items: LspCompletionItem[] }).items;

  return [];
}

/**
 * Requests document formatting from an LSP client.
 *
 * @param client - LSP client to query (typically dprint)
 *
 * @param path - absolute file path
 *
 * @returns array of text edits to apply
 */
export async function requestFormat({ client, path, }: {
  client: LspClient;
  path: string;
}): Promise<LspTextEdit[]> {
  const uri = pathToFileURL(path,).href;
  const result = await client.request({
    method: 'textDocument/formatting',
    params: {
      textDocument: { uri, },
      options: { tabSize: 2, insertSpaces: true, },
    },
  },);

  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- LSP formatting returns TextEdit[] | null
  return (result as LspTextEdit[] | null) ?? [];
}

/**
 * Requests go-to-definition from an LSP client.
 *
 * @param client - LSP client to query (typically tsgo)
 *
 * @param path - absolute file path
 *
 * @param line - 0-based line number
 *
 * @param character - 0-based character offset
 *
 * @returns definition location, or null if unavailable
 */
export async function requestGotoDefinition({ client, path, line, character, }: {
  client: LspClient;
  path: string;
  line: number;
  character: number;
}): Promise<{ path: string; line: number; character: number } | null> {
  const uri = pathToFileURL(path,).href;
  const result = await client.request({
    method: 'textDocument/definition',
    params: { textDocument: { uri, }, position: { line, character, }, },
  },);

  if (result === null || result === undefined)
    return null;

  /** LSP definition returns Location | Location[] | null */
  const rawLocation = Array.isArray(result,)
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- array index on LSP result
    ? (result as unknown[])[0]
    : result;
  if (rawLocation === undefined || rawLocation === null)
    return null;

  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- narrow from Location shape
  const loc = rawLocation as { uri: string; range: { start: { line: number; character: number } } };
  const defPath = loc.uri.startsWith('file://',) ? fileURLToPath(loc.uri,) : loc.uri;
  return { path: defPath, line: loc.range.start.line, character: loc.range.start.character, };
}

/**
 * Requests references (usage sites) from an LSP client.
 * Excludes the declaration itself so only call sites are returned.
 *
 * @param client - LSP client to query (typically tsgo)
 *
 * @param path - absolute file path
 *
 * @param line - 0-based line number
 *
 * @param character - 0-based character offset
 *
 * @returns array of reference locations
 */
export async function requestReferences({ client, path, line, character, }: {
  client: LspClient;
  path: string;
  line: number;
  character: number;
}): Promise<{ path: string; line: number; character: number }[]> {
  const uri = pathToFileURL(path,).href;
  const result = await client.request({
    method: 'textDocument/references',
    params: {
      textDocument: { uri, },
      position: { line, character, },
      context: { includeDeclaration: false, },
    },
  },);

  if (result === null || result === undefined || !Array.isArray(result,))
    return [];

  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- LSP references returns Location[]
  return (result as { uri: string; range: { start: { line: number; character: number } } }[]).map(
    function convertLocation(loc,) {
      const refPath = loc.uri.startsWith('file://',) ? fileURLToPath(loc.uri,) : loc.uri;
      return { path: refPath, line: loc.range.start.line, character: loc.range.start.character, };
    },
  );
}

export { requestInlayHints, requestSelectionRange, } from './lsp-features-extra.ts';
