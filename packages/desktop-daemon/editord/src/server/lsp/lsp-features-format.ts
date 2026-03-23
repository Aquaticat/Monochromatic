/**
 * LSP formatting request handler.
 *
 * Sends a `textDocument/formatting` request to an LSP client
 * and returns the resulting text edits.
 */

import { pathToFileURL, } from 'node:url';

import type { LspClient, } from './lsp-client.ts';
import type { LspTextEdit, } from './types.ts';

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
