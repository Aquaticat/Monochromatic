/**
 * Fetches LSP selection range chains from the server.
 *
 * Split from selection-range-utils.ts to keep the pure
 * comparison utilities separate from network concerns.
 */

import type { SelectionRange, } from '../../../protocol.ts';
import { flattenChain, } from './utils.ts';
import type { EditorWsClient, } from '../ws/client.ts';

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
 */
export async function fetchChain({ ws, path, line, character, }: {
  ws: EditorWsClient;
  path: string;
  line: number;
  character: number;
}): Promise<SelectionRange[]> {
  const r = await ws.request({ type: 'selectionRange', path, positions: [{ line, character, },], },);
  if (!('ranges' in r)) return [];
  // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- narrowed by 'ranges' in r
  const { ranges, } = r as { ranges: SelectionRange[] };
  const [first,] = ranges;
  if (first === undefined) return [];
  return flattenChain({ root: first, },);
}
