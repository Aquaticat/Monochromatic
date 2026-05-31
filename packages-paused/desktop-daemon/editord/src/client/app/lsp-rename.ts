/**
 * Rename orchestration for the editord client.
 *
 * Sends a prepareRename request to validate the symbol, shows the rename
 * input with the current name, then sends the rename request on confirmation
 * and applies the resulting edits.
 */

import {
  l,
  tagged,
} from '../log.ts';
import { showCursorToast, } from '../toast/toast.ts';
import type {
  EditorPaneHandle,
  EditorWsClientHandle,
  GetCurrentFilePathFn,
  RenameInputHandle,
} from './types.ts';

/**
 * Tagged logger for rename operations.
 */
const renameLog = tagged({
  tag: 'lsp-rename',
  l,
},);

/**
 * Initiates a rename at the current cursor position.
 * Sends prepareRename to validate, then shows the rename input.
 *
 * @param ws - WebSocket client
 *
 * @param editorPane - editor pane for cursor position and applying edits
 *
 * @param renameInput - rename input component to show
 *
 * @param getCurrentFilePath - returns the current file path
 *
 * @example
 * ```ts
 * await initiateRename({ ws: ws, editorPane: editorPane, renameInput: renameInput, getCurrentFilePath: '/home/user/project/src/main.ts', });
 * ```
 */
export async function initiateRename({
  ws,
  editorPane,
  renameInput,
  getCurrentFilePath,
}: {
  readonly ws: EditorWsClientHandle;
  readonly editorPane: EditorPaneHandle;
  readonly renameInput: RenameInputHandle;
  readonly getCurrentFilePath: GetCurrentFilePathFn;
},): Promise<void> {
  /**
   * Skip when no file is open; LSP needs a target.
   */
  const path = getCurrentFilePath();
  if (path === null)
    return;

  /**
   * Cursor coords sent to the LSP `prepareRename` request.
   */
  const pos = editorPane.getCursorPosition();
  /**
   * Screen rect anchors the toast and rename popover.
   */
  const rect = editorPane.getCursorRect();
  if ((pos === null) || (rect === null)) {
    renameLog.info('could not resolve cursor position for rename',);
    return;
  }

  renameLog.info(`preparing rename at ${path}:${pos.line}:${pos.character}`,);

  try {
    /**
     * LSP response indicating rename eligibility and an optional placeholder.
     */
    const result = await ws.request({
      type: 'prepareRename',
      path,
      line: pos.line,
      character: pos.character,
    },);

    if (!result.canRename) {
      showCursorToast({
        message: 'Cannot rename this symbol',
        rect,
      },);
      return;
    }

    /**
     * Empty fallback so the input opens with a usable cursor regardless of LSP support.
     */
    const placeholder = result.placeholder
      ?? '';
    renameLog.info(`symbol renamable, placeholder: "${placeholder}"`,);

    renameInput.show({
      placeholder,
      x: rect.left,
      y: rect.bottom,
    },);
  }
  catch (error) {
    renameLog.error(`prepareRename failed: ${String(error,)}`,);
    showCursorToast({
      message: 'Rename request failed',
      rect,
    },);
  }
}

/**
 * Performs the rename after the user confirms a new name.
 * Sends the rename request and applies edits to the current file.
 *
 * @param ws - WebSocket client
 *
 * @param editorPane - editor pane to apply edits to
 *
 * @param getCurrentFilePath - returns the current file path
 *
 * @param newName - new name for the symbol
 *
 * @param line - 0-based line of the symbol
 *
 * @param character - 0-based character of the symbol
 *
 * @example
 * ```ts
 * await performRename({ ws: ws, editorPane: editorPane, getCurrentFilePath: '/home/user/project/src/main.ts', newName: 'renamedSymbol', line: 10, character: 5, });
 * ```
 */
export async function performRename({
  ws,
  editorPane,
  getCurrentFilePath,
  newName,
  line,
  character,
}: {
  readonly ws: EditorWsClientHandle;
  readonly editorPane: EditorPaneHandle;
  readonly getCurrentFilePath: GetCurrentFilePathFn;
  readonly newName: string;
  readonly line: number;
  readonly character: number;
},): Promise<void> {
  /**
   * Skip when no file is open; LSP needs a target.
   */
  const path = getCurrentFilePath();
  if (path === null)
    return;

  renameLog.info(`renaming to "${newName}" at ${path}:${line}:${character}`,);

  try {
    /**
     * Workspace edits returned by the LSP rename handler.
     */
    const result = await ws.request({
      type: 'rename',
      path,
      line,
      character,
      newName,
    },);

    /**
     * Find edits for the currently open file and apply them to the buffer.
     */
    const currentFileEdits = result.edits
      .find(
      function isCurrentFile(fileEdit,) {
        return fileEdit.path
          === path;
      },
    );

    if ((currentFileEdits !== undefined) && (currentFileEdits.edits
      .length
      > 0))
      editorPane.applyTextEdits(currentFileEdits.edits,);

    /**
     * File-count summary used in the post-rename log entry below.
     */
    const totalFiles = result.edits
      .length;
    /**
     * Edit-count summary used in the post-rename log entry below.
     */
    const totalEdits = result.edits
      .reduce(
      function countEdits(
        sum,
        fileEdit,
      ) {
        return sum
          + fileEdit
          .edits
          .length;
      },
      0,
    );
    renameLog.info(`rename applied: ${totalEdits} edit(s) across ${totalFiles} file(s)`,);
  }
  catch (error) {
    renameLog.error(`rename failed: ${String(error,)}`,);
  }
}
