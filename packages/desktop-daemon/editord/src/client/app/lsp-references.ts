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
import type {
  ReferenceLocation,
  ReferencesPopup,
} from '../references/references-popup.ts';
import { showCursorToast, } from '../toast/toast.ts';
import type { EditorWsClient, } from '../ws/client.ts';

/** Tagged logger for LSP references. */
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
    ws: EditorWsClient;
    referencesPopup: ReferencesPopup;
    getCurrentFilePath: () => string | null;
    line: number;
    character: number;
    rect: DOMRect;
  },
): Promise<void> {
  const path = getCurrentFilePath();
  if (path === null)
    return;
  try {
    const response = await ws.request({
      type: 'findReferences',
      path,
      line,
      character,
    },);
    if (!('locations' in response)) {
      showCursorToast({
        message: 'No usages found',
        rect,
      },);
      return;
    }
    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- narrowed by 'locations' check
    const { locations, } = response as {
      locations: {
        path: string;
        line: number;
        character: number
      }[];
    };
    refLog.info(`references: ${locations.length} usage(s) found`,);
    if (locations.length === 0) {
      showCursorToast({
        message: 'No usages found',
        rect,
      },);
      return;
    }

    /** Strip common prefix from paths for display. */
    /** Without destructuring: prefer-destructuring lint error for member access. */
    const { rootDir, } = ws;
    const items: ReferenceLocation[] = locations.map(function toItem(loc,) {
      const label = loc.path.startsWith(rootDir,)
        ? loc.path.slice(rootDir.length + 1,)
        : loc.path;
      return {
        path: loc.path,
        line: loc.line,
        character: loc.character,
        label,
      };
    },);

    if (items.length === 1) {
      /** Without destructuring: prefer-destructuring lint error for index-0 access. */
      const [only,] = items;
      if (only !== undefined) {
        referencesPopup.dispatchEvent(new CustomEvent(
          'reference-select',
          {
          detail: {
            path: only.path,
            line: only.line + 1,
            character: only.character,
          },
          bubbles: true,
          composed: true,
        },
        ),);
      }
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
