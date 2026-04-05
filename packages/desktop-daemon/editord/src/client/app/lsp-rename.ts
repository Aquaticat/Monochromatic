/**
 * Rename orchestration for the editord client.
 *
 * Sends a prepareRename request to validate the symbol, shows the rename
 * input with the current name, then sends the rename request on confirmation
 * and applies the resulting edits.
 */

import type { EditorPane, } from '../editor/editor-pane.ts';
import {
  l,
  tagged,
} from '../log.ts';
import type { RenameInput, } from '../rename/rename-input.ts';
import { showCursorToast, } from '../toast/toast.ts';
import type { EditorWsClient, } from '../ws/client.ts';

import type { GetCurrentFilePathFn, } from './types.ts';

/** Tagged logger for rename operations. */
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
 */
export async function initiateRename({
  ws,
  editorPane,
  renameInput,
  getCurrentFilePath,
}: {
  ws: EditorWsClient;
  editorPane: EditorPane;
  renameInput: RenameInput;
  getCurrentFilePath: GetCurrentFilePathFn;
},): Promise<void> {
  const path = getCurrentFilePath();
  if (path === null)
    return;

  const pos = editorPane.getCursorPosition();
  const rect = editorPane.getCursorRect();
  if (pos === null || rect === null) {
    renameLog.info('could not resolve cursor position for rename',);
    return;
  }

  renameLog.info(`preparing rename at ${path}:${pos.line}:${pos.character}`,);

  try {
    const response = await ws.request({
      type: 'prepareRename',
      path,
      line: pos.line,
      character: pos.character,
    },);

    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- narrowed by canRename check
    const result = response as {
      canRename: boolean;
      placeholder?: string;
    };

    if (!result.canRename) {
      showCursorToast({
        message: 'Cannot rename this symbol',
        rect,
      },);
      return;
    }

    const placeholder = result.placeholder ?? '';
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
 */
export async function performRename({
  ws,
  editorPane,
  getCurrentFilePath,
  newName,
  line,
  character,
}: {
  ws: EditorWsClient;
  editorPane: EditorPane;
  getCurrentFilePath: GetCurrentFilePathFn;
  newName: string;
  line: number;
  character: number;
},): Promise<void> {
  const path = getCurrentFilePath();
  if (path === null)
    return;

  renameLog.info(`renaming to "${newName}" at ${path}:${line}:${character}`,);

  try {
    const response = await ws.request({
      type: 'rename',
      path,
      line,
      character,
      newName,
    },);

    // oxlint-disable-next-line typescript-eslint/no-unsafe-type-assertion -- narrowed by 'edits' check
    const result = response as {
      edits: {
        path: string;
        edits: {
          range: {
            start: { line: number; character: number; };
            end: { line: number; character: number; };
          };
          newText: string;
        }[];
      }[];
    };

    /** Find edits for the currently open file and apply them to the buffer. */
    const currentFileEdits = result.edits.find(
      function isCurrentFile(fileEdit,) {
        return fileEdit.path === path;
      },
    );

    if (currentFileEdits !== undefined && currentFileEdits.edits.length > 0) {
      editorPane.applyTextEdits(currentFileEdits.edits,);
    }

    const totalFiles = result.edits.length;
    const totalEdits = result.edits.reduce(
      function countEdits(sum, fileEdit,) {
        return sum + fileEdit.edits.length;
      },
      0,
    );
    renameLog.info(`rename applied: ${totalEdits} edit(s) across ${totalFiles} file(s)`,);
  }
  catch (error) {
    renameLog.error(`rename failed: ${String(error,)}`,);
  }
}
