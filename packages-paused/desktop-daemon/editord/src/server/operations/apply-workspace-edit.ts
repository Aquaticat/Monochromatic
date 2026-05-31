/**
 * Applies text edits from a workspace edit to files on disk.
 *
 * Reads each affected file, applies the edits in reverse order
 * (to preserve positions), and writes the result back.
 * Returns the edits grouped by file path for the client to update
 * its open buffer.
 */

import { readFile, } from 'node:fs/promises';

import type {
  TextEdit,
  WorkspaceFileEdit,
} from '../../protocol.ts';
import type { LspWorkspaceEdit, } from '../lsp/types.ts';
import { uriToPath, } from '../lsp/uri.ts';
import type { DirWatcher, } from './watch-filesystem.ts';
import { writeFileAtomic, } from './write-file-atomic.ts';

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
  readonly text: string;
  readonly line: number;
  readonly character: number;
},): number {
  /**
   * Absolute string offset walked forward until `currentLine` reaches `line`.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- text-walker cursor: `offset` advances character-by-character until the target line
  let offset = 0;
  /**
   * Line counter incremented each time a `\n` is consumed; stops the walk when it equals `line`.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- text-walker counter: `currentLine` increments on each newline consumed
  let currentLine = 0;
  while ((currentLine < line) && (offset < text
    .length)) {
    if (text[offset]
      === '\n')
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
  readonly text: string;
  readonly edits: readonly TextEdit[];
},): string {
  /**
   * Sort edits in reverse document order (end of file first).
   */
  const sorted = edits.toSorted(
    function compareReverse(
      a,
      b,
    ) {
      /**
       * Negative line difference (b - a) for reverse-document ordering; falls through to character compare on ties.
       */
      const lineDiff = b.range
        .start
        .line
        - a
        .range
        .start
        .line;
      if (lineDiff !== 0)
        return lineDiff;
      return b.range
        .start
        .character
        - a
        .range
        .start
        .character;
    },
  );

  /**
   * Working text mutated in place by each edit; reverse-ordered edits keep earlier offsets valid.
   */
  let result = text;
  for (const edit of sorted) {
    /**
     * Start offset of the edit, recomputed against the current `result` since prior edits may have shifted it.
     */
    const start = positionToOffset({
      text: result,
      line: edit.range
        .start
        .line,
      character: edit.range
        .start
        .character,
    },);
    /**
     * End offset of the edit, recomputed against the current `result` for the same reason as `start`.
     */
    const end = positionToOffset({
      text: result,
      line: edit.range
        .end
        .line,
      character: edit.range
        .end
        .character,
    },);
    result = result.slice(
      0,
      start,
    )
      + edit
      .newText
      + result
      .slice(end,);
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
  readonly filePath: string;
  readonly wireEdits: readonly TextEdit[];
},): Promise<void> {
  /**
   * Pre-edit file contents loaded from disk; basis for applying `wireEdits`.
   */
  const content = await readFile(
    filePath,
    'utf8',
  );
  /**
   * Post-edit file contents to write back; reverse-ordered application keeps positions stable.
   */
  const modified = applyEditsToString({
    text: content,
    edits: wireEdits,
  },);
  await writeFileAtomic({
    path: filePath,
    content: modified,
  },);
}

/**
 * Applies a workspace edit to files on disk.
 * Writes all affected files except the currently open one (which the client
 * updates in its buffer). Returns edits grouped by path for the client.
 *
 * Suppresses the watcher for every file actually written to disk so the
 * client never sees `fileChanged` echoes from its own rename or refactor.
 *
 * @param workspaceEdit - LSP workspace edit with URI-keyed changes
 *
 * @param currentFilePath - path of the file currently open in the editor
 *   (edits for this file are returned but not written to disk)
 *
 * @param dirWatcher - watcher to silence for the duration of each write;
 *   `null` when the watcher is not yet wired (e.g. tests, headless mode)
 *
 * @returns edits grouped by file path
 *
 * @example
 * ```ts
 * const fileEdits = await applyWorkspaceEdit({
 *   workspaceEdit: { changes: { 'file:///src/utils.ts': [{ range, newText: 'renamed' }] } },
 *   currentFilePath: '/home/user/project/src/main.ts',
 *   dirWatcher,
 * });
 * ```
 */
export async function applyWorkspaceEdit({
  workspaceEdit,
  currentFilePath,
  dirWatcher,
}: {
  readonly workspaceEdit: LspWorkspaceEdit;
  readonly currentFilePath: string;
  readonly dirWatcher: DirWatcher | null;
},): Promise<WorkspaceFileEdit[]> {
  /**
   * URI-keyed edit map carried by the LSP workspace edit; undefined for no-op edits.
   */
  const { changes, } = workspaceEdit;
  if (changes === undefined)
    return [];

  /**
   * Output accumulator: edits grouped by absolute file path for the client to mirror.
   */
  const result: WorkspaceFileEdit[] = [];
  /**
   * Promises for the disk writes performed for non-current files; awaited together at the end.
   */
  const writePromises: Promise<void>[] = [];

  for (const uri of Object.keys(changes,)) {
    /**
     * Edits targeting this URI; undefined or empty when LSP returned nothing for that file.
     */
    const lspEdits = changes[uri];
    if ((lspEdits === undefined) || (lspEdits.length
      === 0))
      continue;

    /**
     * Absolute path decoded from the LSP `file://` URI for use with `node:fs` APIs.
     */
    const filePath = uriToPath({ uri, },);
    /**
     * Wire-format edits passed to the writer; copies into a mutable array since `LspWorkspaceEdit.changes` holds `readonly LspTextEdit[]`.
     */
    const wireEdits: TextEdit[] = lspEdits.map(
      function convertEdit(edit,): TextEdit {
        return {
          range: edit.range,
          newText: edit.newText,
        };
      },
    );

    result.push({
      path: filePath,
      edits: wireEdits,
    },);

    /**
     * Skip disk write for the current file; the client applies those edits.
     */
    if (filePath === currentFilePath)
      continue;

    /**
     * Suppress before the write starts so the suppression set is populated
     * before chokidar emits the post-`awaitWriteFinish` event.
     */
    if (dirWatcher !== null)
      dirWatcher.suppressPath({ path: filePath, },);

    writePromises.push(applyEditsToFile({
      filePath,
      wireEdits,
    },),);
  }

  await Promise.all(writePromises,);
  return result;
}
