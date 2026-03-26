/**
 * LSP navigation request handlers: go-to-definition and find references.
 *
 * Sends `textDocument/definition` and `textDocument/references` requests
 * to an LSP client and converts Location results to simplified paths.
 */

import {
  LSP_FEATURE_TIMEOUT_MS,
  type LspClient,
} from './lsp-client.ts';
import {
  pathToUri,
  uriToPath,
} from './uri.ts';

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
export async function requestGotoDefinition({
  client,
  path,
  line,
  character,
}: {
  client: LspClient;
  path: string;
  line: number;
  character: number;
},): Promise<{
  path: string;
  line: number;
  character: number
} | null> {
  const uri = pathToUri({ path, },);
  const result = await client.request({
    method: 'textDocument/definition',
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

  /** LSP definition returns Location | Location[] | null */
  const rawLocation = Array.isArray(result,)
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- array index on LSP result
    ? (result as unknown[])[0]
    : result;
  if (rawLocation === undefined || rawLocation === null)
    return null;

  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- narrow from Location shape
  const loc = rawLocation as {
    uri: string;
    range: {
      start: {
        line: number;
        character: number;
      };
    }
  };
  const defPath = uriToPath({ uri: loc.uri, },);
  return {
    path: defPath,
    line: loc.range.start.line,
    character: loc.range.start.character,
  };
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
export async function requestReferences({
  client,
  path,
  line,
  character,
}: {
  client: LspClient;
  path: string;
  line: number;
  character: number;
},): Promise<{
  path: string;
  line: number;
  character: number
}[]> {
  const uri = pathToUri({ path, },);
  const result = await client.request({
    method: 'textDocument/references',
    params: {
      textDocument: { uri, },
      position: {
        line,
        character,
      },
      context: { includeDeclaration: false, },
    },
    timeoutMs: LSP_FEATURE_TIMEOUT_MS,
  },);

  if (result === null || result === undefined || !Array.isArray(result,))
    return [];

  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- LSP references returns Location[]
  return (result as {
    uri: string;
    range: {
      start: {
        line: number;
        character: number;
      };
    }
  }[])
    .map(
      function convertLocation(loc,) {
        const refPath = uriToPath({ uri: loc.uri, },);
        return {
          path: refPath,
          line: loc.range.start.line,
          character: loc.range.start.character,
        };
      },
    );
}
