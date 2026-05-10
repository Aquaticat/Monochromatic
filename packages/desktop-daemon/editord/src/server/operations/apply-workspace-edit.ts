/**
 * Applies text edits from a workspace edit to files on disk.
 *
 * Reads each affected file, applies the edits in reverse order
 * (to preserve positions), and writes the result back.
 * Returns the edits grouped by file path for the client to update
 * its open buffer.
 */

import {
  readFile,
  writeFile,
} from 'node:fs/promises';

import type {
  Range,
  TextEdit,
  WorkspaceFileEdit,
} from '../../protocol.ts';
import type { LspWorkspaceEdit, } from '../lsp/types.ts';
import { uriToPath, } from '../lsp/uri.ts';

/**
 * Converts 0-based line/character position to a string offset.
 *
 * @param text - full file text
 *
 * @param line - 0-based line number
 *
 * @param character - 0-based character offset within the line
 *
 * @returns absolute character offset in the string
 */
function positionToOffset({
  text,
  line,
  character,
}: {
  text: string;
  line: number;
  character: number;
},): number {
  let offset = 0;
  let currentLine = 0;
  while (currentLine < line && offset < text.length) {
    if (text[offset] === '\n')
      currentLine++;
    offset++;
  }
  return offset + character;
}

/**
 * Applies an array of text edits to a string, processing in reverse
 * document order so that earlier edits don't shift later positions.
 *
 * @param text - original file content
 *
 * @param edits - text edits to apply
 *
 * @returns modified text
 */
function applyEditsToString({
  text,
  edits,
}: {
  text: string;
  edits: TextEdit[];
},): string {
  /** Sort edits in reverse document order (end of file first). */
  const sorted = edits.toSorted(
    function compareReverse(
      a,
      b,
    ) {
      const lineDiff = b.range.start.line - a.range.start.line;
      if (lineDiff !== 0)
        return lineDiff;
      return b.range.start.character - a.range.start.character;
    },
  );

  let result = text;
  for (const edit of sorted) {
    const start = positionToOffset({
      text: result,
      line: edit.range.start.line,
      character: edit.range.start.character,
    },);
    const end = positionToOffset({
      text: result,
      line: edit.range.end.line,
      character: edit.range.end.character,
    },);
    result = result.slice(
      0,
      start,
    ) + edit.newText + result.slice(end,);
  }
  return result;
}

/**
 * Applies a workspace edit to files on disk.
 * Writes all affected files except the currently open one (which the client
 * updates in its buffer). Returns edits grouped by path for the client.
 *
 * @param workspaceEdit - LSP workspace edit with URI-keyed changes
 *
 * @param currentFilePath - path of the file currently open in the editor
 *   (edits for this file are returned but not written to disk)
 *
 * @returns edits grouped by file path
 *
 * @example
 * ```ts
 * const fileEdits = await applyWorkspaceEdit({
 *   workspaceEdit: { changes: { 'file:///src/utils.ts': [{ range, newText: 'renamed' }] } },
 *   currentFilePath: '/home/user/project/src/main.ts',
 * });
 * ```
 */
/**
 * Reads a file, applies text edits, and writes the result back.
 *
 * @param filePath - absolute file path
 *
 * @param wireEdits - edits to apply
 */
async function applyEditsToFile({
  filePath,
  wireEdits,
}: {
  filePath: string;
  wireEdits: TextEdit[];
},): Promise<void> {
  const content = await readFile(
    filePath,
    'utf8',
  );
  const modified = applyEditsToString({
    text: content,
    edits: wireEdits,
  },);
  await writeFile(
    filePath,
    modified,
    'utf8',
  );
}

/**
 * Applies a workspace edit to files on disk.
 * Writes all affected files except the currently open one (which the client
 * updates in its buffer). Returns edits grouped by path for the client.
 *
 * @param workspaceEdit - LSP workspace edit with URI-keyed changes
 *
 * @param currentFilePath - path of the file currently open in the editor
 *   (edits for this file are returned but not written to disk)
 *
 * @returns edits grouped by file path
 *
 * @example
 * ```ts
 * const fileEdits = await applyWorkspaceEdit({
 *   workspaceEdit: { changes: { 'file:///src/utils.ts': [{ range, newText: 'renamed' }] } },
 *   currentFilePath: '/home/user/project/src/main.ts',
 * });
 * ```
 */
export async function applyWorkspaceEdit({
  workspaceEdit,
  currentFilePath,
}: {
  workspaceEdit: LspWorkspaceEdit;
  currentFilePath: string;
},): Promise<WorkspaceFileEdit[]> {
  const { changes, } = workspaceEdit;
  if (changes === undefined)
    return [];

  const result: WorkspaceFileEdit[] = [];
  const writePromises: Promise<void>[] = [];

  for (const uri of Object.keys(changes,)) {
    const lspEdits = changes[uri];
    if (lspEdits === undefined || lspEdits.length === 0)
      continue;

    const filePath = uriToPath({ uri, },);
    const wireEdits: TextEdit[] = lspEdits.map(
      function convertEdit(edit,): TextEdit {
        return {
          range: edit.range as Range,
          newText: edit.newText,
        };
      },
    );

    result.push({
      path: filePath,
      edits: wireEdits,
    },);

    /** Skip disk write for the current file; the client applies those edits. */
    if (filePath === currentFilePath)
      continue;

    writePromises.push(applyEditsToFile({
      filePath,
      wireEdits,
    },),);
  }

  await Promise.all(writePromises,);
  return result;
}
