/**
 * Fetches LSP selection range chains from the server.
 *
 * Split from selection-range-utils.ts to keep the pure
 * comparison utilities separate from network concerns.
 */

import type { SelectionRange, } from '../../../protocol.ts';
import type { EditorWsClient, } from '../ws/client.ts';
import { flattenChain, } from './utils.ts';

/**
 * Fetches the selection range chain from the server and returns
 * the flattened array.
 *
 * @param ws - WebSocket client
 *
 * @param path - absolute file path
 *
 * @param line - 0-based cursor line
 *
 * @param character - 0-based cursor character
 *
 * @returns flattened chain from innermost to outermost, or empty
 *
 * @example
 * ```ts
 * const result = await fetchChain({ ws: ws, path: '/home/user/project/src/main.ts', line: 10, character: 5, });
 * ```
 */
export async function fetchChain({
  ws,
  path,
  line,
  character,
}: {
  ws: EditorWsClient;
  path: string;
  line: number;
  character: number;
},): Promise<SelectionRange[]> {
  const { ranges, } = await ws.request({
    type: 'selectionRange',
    path,
    positions: [{
      line,
      character,
    },],
  },);
  const [first,] = ranges;
  if (first === undefined)
    return [];
  return flattenChain({ root: first, },);
}
