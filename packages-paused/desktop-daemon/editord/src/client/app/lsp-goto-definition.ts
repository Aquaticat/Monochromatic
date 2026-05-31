/**
 * Go-to-definition logic for the editord client.
 *
 * Sends a definition request via WebSocket and navigates to the result.
 * Split from app-lsp-actions.ts to stay under max-lines.
 */

import {
  l,
  tagged,
} from '../log.ts';
import type {
  EditorWsClientHandle,
  GetCurrentFilePathFn,
  LoadFileFn,
} from './types.ts';

/**
 * Tagged logger for go-to-definition.
 */
const gotoLog = tagged({
  tag: 'lsp-goto',
  l,
},);

/**
 * Result of a go-to-definition attempt.
 */
export type GotoDefinitionResult = 'navigated' | 'no-definition' | 'already-at-definition'
  | 'error';

/**
 * Sends a go-to-definition request and navigates to the result.
 *
 * @param ws - WebSocket client
 *
 * @param getCurrentFilePath - returns the currently open file path
 *
 * @param loadFileSafe - loads a file, optionally scrolling to a line
 *
 * @param line - 0-based line number
 *
 * @param character - 0-based character offset
 *
 * @returns result indicating whether navigation succeeded, found nothing, or errored
 *
 * @example
 * ```ts
 * const result = await doGotoDefinition({ ws: ws, getCurrentFilePath: '/home/user/project/src/main.ts', loadFileSafe: loadFileSafe, line: 10, character: 5, });
 * ```
 */
export async function doGotoDefinition(
  {
    ws,
    getCurrentFilePath,
    loadFileSafe,
    line,
    character,
  }: {
    readonly ws: EditorWsClientHandle;
    readonly getCurrentFilePath: GetCurrentFilePathFn;
    readonly loadFileSafe: LoadFileFn;
    readonly line: number;
    readonly character: number;
  },
): Promise<GotoDefinitionResult> {
  /**
   * Active file path; `null` when no file is open, in which case there is nothing to look up.
   */
  const path = getCurrentFilePath();
  if (path === null)
    return 'no-definition';
  gotoLog.info(`requesting definition at ${path}:${line}:${character}`,);
  try {
    /**
     * Server-resolved definition location; `path === ''` means "no result from any LSP".
     */
    const def = await ws.request({
      type: 'gotoDefinition',
      path,
      line,
      character,
    },);
    gotoLog.info(`definition response: ${JSON.stringify(def,)}`,);
    if (def.path
      !== '') {
      if ((def.path
        === path) && (def.line
          === line))
        return 'already-at-definition';
      await loadFileSafe({
        path: def.path,
        line: def.line
          + 1,
        character: def.character,
      },);
      return 'navigated';
    }
    return 'no-definition';
  }
  catch (error) {
    gotoLog.error(`go-to-definition failed: ${String(error,)}`,);
    return 'error';
  }
}
