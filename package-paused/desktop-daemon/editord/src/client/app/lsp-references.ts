/**
 * Reference lookup and popup display for the editord client.
 *
 * Requests references from the server and either navigates directly
 * (single result) or shows the references popup (multiple results).
 * Split from app-lsp.ts to stay under max-lines.
 */

import {
  l,
  tagged,
} from '../log.ts';
import type { ReferenceLocation, } from '../references/references-popup.ts';
import { showCursorToast, } from '../toast/toast.ts';
import type {
  EditorWsClientHandle,
  GetCurrentFilePathFn,
  ReferencesPopupHandle,
} from './types.ts';

/**
 * Tagged logger for LSP references.
 */
const refLog = tagged({
  tag: 'lsp-references',
  l,
},);

/**
 * Requests references from the server and shows them in the popup.
 * If there is exactly one reference, navigates directly.
 *
 * @param ws - WebSocket client
 *
 * @param referencesPopup - popup to display results in
 *
 * @param getCurrentFilePath - returns the current file path
 *
 * @param line - 0-based line number of the definition
 *
 * @param character - 0-based character offset
 *
 * @param rect - cursor bounding rect for popup positioning
 *
 * @example
 * ```ts
 * await showReferences({ ws: ws, referencesPopup: referencesPopup, getCurrentFilePath: '/home/user/project/src/main.ts', line: 10, character: 5, rect: cursorRect, });
 * ```
 */
export async function showReferences(
  {
    ws,
    referencesPopup,
    getCurrentFilePath,
    line,
    character,
    rect,
  }: {
    readonly ws: EditorWsClientHandle;
    readonly referencesPopup: ReferencesPopupHandle;
    readonly getCurrentFilePath: GetCurrentFilePathFn;
    readonly line: number;
    readonly character: number;
    readonly rect: DOMRect;
  },
): Promise<void> {
  /**
   * Current file path; null when no buffer is open, in which case the request would be meaningless.
   */
  const path = getCurrentFilePath();
  if (path === null)
    return;
  try {
    /**
     * Server response payload; `locations` is the only field consumed downstream.
     */
    const { locations, } = await ws.request({
      type: 'findReferences',
      path,
      line,
      character,
    },);
    refLog.info(`references: ${locations.length} usage(s) found`,);
    if (locations.length
      === 0) {
      showCursorToast({
        message: 'No usages found',
        rect,
      },);
      return;
    }

    /**
     * Strip common prefix from paths for display.
     */
    /**
     * Without destructuring: prefer-destructuring lint error for member access.
     */
    const { rootDir, } = ws;
    /**
     * Display-ready reference entries with paths shortened relative to the workspace root.
     */
    const items: ReferenceLocation[] = locations.map(function toItem(loc,) {
      /**
       * Workspace-relative display string; falls back to the full path when outside the root.
       */
      const label = loc.path
        .startsWith(rootDir,)
        ? loc.path
          .slice(rootDir.length
            + 1,)
        : loc.path;
      return {
        path: loc.path,
        line: loc.line,
        character: loc.character,
        label,
      };
    },);

    if (items.length
      === 1) {
      /**
       * Without destructuring: prefer-destructuring lint error for index-0 access.
       */
      const [only,] = items;
      if (only !== undefined)
        referencesPopup.selectReference(only,);
      return;
    }

    referencesPopup.show({
      locations: items,
      x: rect.left,
      y: rect.top,
      cursorHeight: rect
        .height,
    },);
  }
  catch (error) {
    refLog.error(`references request failed: ${String(error,)}`,);
    showCursorToast({
      message: 'References request failed',
      rect,
    },);
  }
}
