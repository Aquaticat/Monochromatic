/**
 * LSP formatting request handler.
 *
 * Sends a `textDocument/formatting` request to an LSP client
 * and returns the resulting text edits.
 */

import {
  LSP_FEATURE_TIMEOUT_MS,
  type LspClient,
} from './lsp-client.ts';
import type { LspTextEdit, } from './types.ts';
import { pathToUri, } from './uri.ts';

/**
 * Requests document formatting from an LSP client.
 *
 * @param client - LSP client to query (typically dprint)
 *
 * @param path - absolute file path
 *
 * @returns array of text edits to apply
 *
 * @example
 * ```ts
 * const result = await requestFormat({ client: client, path: '/home/user/project/src/main.ts', });
 * ```
 */
export async function requestFormat({
  client,
  path,
}: {
  readonly client: LspClient;
  readonly path: string;
},): Promise<LspTextEdit[]> {
  /**
   * `file://` URI form required by LSP `textDocument` identifiers.
   */
  const uri = pathToUri({ path, },);
  /**
   * Raw LSP response; cast below because servers return `TextEdit[] | null`.
   */
  const result = await client.request({
    method: 'textDocument/formatting',
    params: {
      textDocument: { uri, },
      options: {
        tabSize: 2,
        insertSpaces: true,
      },
    },
    timeoutMs: LSP_FEATURE_TIMEOUT_MS,
  },);

  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- LSP formatting returns TextEdit[] | null
  return (result as LspTextEdit[] | null) ?? [];
}
