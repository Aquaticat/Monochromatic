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
 * @param client - LSP client to query (typically tsc)
 *
 * @param path - absolute file path
 *
 * @param line - 0-based line number
 *
 * @param character - 0-based character offset
 *
 * @returns definition location, or null if unavailable
 *
 * @example
 * ```ts
 * const result = await requestGotoDefinition({ client: client, path: '/home/user/project/src/main.ts', line: 10, character: 5, });
 * ```
 */
export async function requestGotoDefinition({
  client,
  path,
  line,
  character,
}: {
  readonly client: LspClient;
  readonly path: string;
  readonly line: number;
  readonly character: number;
},): Promise<{
  readonly path: string;
  readonly line: number;
  readonly character: number;
} | null> {
  /**
   * LSP wire format expects a URI, not a filesystem path.
   */
  const uri = pathToUri({ path, },);
  /**
   * LSP returns Location | Location[] | null; normalised below.
   */
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

  if ((result === null) || (result === undefined))
    return null;

  /**
   * LSP definition returns Location | Location[] | null
   */
  const rawLocation = Array.isArray(result,)
    ? (result as unknown[])[0]
    : result;
  if ((rawLocation === undefined) || (rawLocation === null))
    return null;

  /* oxlint-disable typescript-eslint/no-unsafe-type-assertion -- narrow from Location shape */
  /**
   * Narrowed Location view used to read the definition coords.
   */
  const loc = rawLocation as {
    readonly uri: string;
    readonly range: {
      readonly start: {
        readonly line: number;
        readonly character: number;
      };
    };
  };
  /* oxlint-enable typescript-eslint/no-unsafe-type-assertion */
  /**
   * Filesystem path returned to the caller; the wire form was URI.
   */
  const defPath = uriToPath({ uri: loc.uri, },);
  return {
    path: defPath,
    line: loc.range
      .start
      .line,
    character: loc.range
      .start
      .character,
  };
}

/**
 * Requests references (usage sites) from an LSP client.
 * Excludes the declaration itself so only call sites are returned.
 *
 * @param client - LSP client to query (typically tsc)
 *
 * @param path - absolute file path
 *
 * @param line - 0-based line number
 *
 * @param character - 0-based character offset
 *
 * @returns array of reference locations
 *
 * @example
 * ```ts
 * const result = await requestReferences({ client: client, path: '/home/user/project/src/main.ts', line: 10, character: 5, });
 * ```
 */
export async function requestReferences({
  client,
  path,
  line,
  character,
}: {
  readonly client: LspClient;
  readonly path: string;
  readonly line: number;
  readonly character: number;
},): Promise<{
  readonly path: string;
  readonly line: number;
  readonly character: number;
}[]> {
  /**
   * LSP wire format expects a URI, not a filesystem path.
   */
  const uri = pathToUri({ path, },);
  /**
   * Empty / non-array result is mapped to `[]` below.
   */
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

  if ((result === null) || (result === undefined)
    || (!Array.isArray(result,)))
    return [];

  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- LSP references returns Location[]
  return (result as {
    readonly uri: string;
    readonly range: {
      readonly start: {
        readonly line: number;
        readonly character: number;
      };
    };
  }[])
    .map(
      function convertLocation(loc,) {
        /**
         * Filesystem path returned to the caller; the wire form was URI.
         */
        const refPath = uriToPath({ uri: loc.uri, },);
        return {
          path: refPath,
          line: loc.range
            .start
            .line,
          character: loc.range
            .start
            .character,
        };
      },
    );
}
