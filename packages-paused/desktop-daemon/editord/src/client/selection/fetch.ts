/**
 * Fetches LSP selection range chains from the server.
 *
 * Split from selection-range-utils.ts to keep the pure
 * comparison utilities separate from network concerns.
 */

import type { SelectionRange, } from '../../../protocol.ts';
import type { EditorWsClientHandle, } from '../app/types.ts';
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
  readonly ws: EditorWsClientHandle;
  readonly path: string;
  readonly line: number;
  readonly character: number;
},): Promise<readonly SelectionRange[]> {
  /**
   * Server response: one chain per requested position; only the first is used here.
   */
  const { ranges, } = await ws.request({
    type: 'selectionRange',
    path,
    positions: [{
      line,
      character,
    },],
  },);
  /**
   * Innermost selection range; subsequent `parent` pointers form the chain.
   */
  const [first,] = ranges;
  if (first === undefined)
    return [];
  return flattenChain({ root: first, },);
}
