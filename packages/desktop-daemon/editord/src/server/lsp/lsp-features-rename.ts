/**
 * LSP rename request handlers: prepareRename and rename.
 *
 * Sends `textDocument/prepareRename` and `textDocument/rename` requests
 * to an LSP client. PrepareRename validates that the symbol at the cursor
 * can be renamed and returns its current name and range. Rename performs
 * the actual renaming and returns a workspace edit with changes across files.
 */

import {
  LSP_FEATURE_TIMEOUT_MS,
  type LspClient,
} from './lsp-client.ts';
import type {
  LspRange,
  LspWorkspaceEdit,
} from './types.ts';
import { pathToUri, } from './uri.ts';

/** Result of a successful `textDocument/prepareRename` request. */
export type PrepareRenameResult = {
  /** Range of the symbol to rename. */
  range: LspRange;
  /** Current name of the symbol (used as placeholder in the rename input). */
  placeholder: string;
};

/**
 * Requests prepare-rename from an LSP client.
 * Validates whether the symbol at the cursor position can be renamed.
 *
 * @param client - LSP client to query (typically tsgo)
 *
 * @param path - absolute file path
 *
 * @param line - 0-based line number
 *
 * @param character - 0-based character offset
 *
 * @returns prepare rename result with range and placeholder, or null if not renamable
 *
 * @example
 * ```ts
 * const result = await requestPrepareRename({ client: client, path: '/home/user/project/src/main.ts', line: 10, character: 5, });
 * ```
 */
export async function requestPrepareRename({
  client,
  path,
  line,
  character,
}: {
  client: LspClient;
  path: string;
  line: number;
  character: number;
},): Promise<PrepareRenameResult | null> {
  const uri = pathToUri({ path, },);
  const result = await client.request({
    method: 'textDocument/prepareRename',
    params: {
      textDocument: { uri, },
      position: {
        line,
        character,
      },
    },
    timeoutMs: LSP_FEATURE_TIMEOUT_MS,
  },);

  if (result === null || result === undefined)
    return null;

  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- LSP prepareRename returns Range | { range, placeholder } | null
  const raw = result as Record<string, unknown>;

  /**
   * tsgo returns `{ range, placeholder }` when prepareProvider is true.
   * Some servers return just a Range (without placeholder).
   */
  if ('placeholder' in raw && 'range' in raw) {
    return {
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- narrowed by 'range' check
      range: raw.range as LspRange,
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- narrowed by 'placeholder' check
      placeholder: raw.placeholder as string,
    };
  }

  /** Plain Range response — extract the symbol text from the range as placeholder. */
  if ('start' in raw && 'end' in raw) {
    return {
      // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- narrowed by start/end check
      range: raw as unknown as LspRange,
      placeholder: '',
    };
  }

  return null;
}

/**
 * Requests rename from an LSP client.
 * Renames all references to the symbol at the given position.
 *
 * @param client - LSP client to query (typically tsgo)
 *
 * @param path - absolute file path
 *
 * @param line - 0-based line number
 *
 * @param character - 0-based character offset
 *
 * @param newName - new name for the symbol
 *
 * @returns workspace edit with changes across files, or null if rename failed
 *
 * @example
 * ```ts
 * const result = await requestRename({ client: client, path: '/home/user/project/src/main.ts', line: 10, character: 5, newName: 'renamedSymbol', });
 * ```
 */
export async function requestRename({
  client,
  path,
  line,
  character,
  newName,
}: {
  client: LspClient;
  path: string;
  line: number;
  character: number;
  newName: string;
},): Promise<LspWorkspaceEdit | null> {
  const uri = pathToUri({ path, },);
  const result = await client.request({
    method: 'textDocument/rename',
    params: {
      textDocument: { uri, },
      position: {
        line,
        character,
      },
      newName,
    },
    timeoutMs: LSP_FEATURE_TIMEOUT_MS,
  },);

  if (result === null || result === undefined)
    return null;

  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- LSP rename returns WorkspaceEdit | null
  return result as LspWorkspaceEdit;
}
