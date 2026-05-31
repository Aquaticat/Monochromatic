/**
 * Shared helpers for MCP tool handlers.
 *
 * Contains utility functions for building response text
 * (caveats, notes, headers) and the common result type.
 *
 * @module
 */

import type { CurrentFile, } from './nvim-types.ts';

//region Helper functions: build response text for tool handlers

/**
 * Builds a caveat note when any current buffer has unsaved changes.
 * CLI linters see the on-disk version, which may differ from the buffer.
 *
 * @param files - Current file metadata from all Neovim instances.
 *
 * @returns Caveat string or empty string when no buffers are modified.
 *
 * @example
 * ```ts
 * modifiedCaveat([{ path: '/tmp/a.ts', filetype: 'typescript', modified: true }]);
 * // 'buffer has unsaved changes; CLI lint results reflect the saved file, not the current buffer: /tmp/a.ts'
 * ```
 */
export function modifiedCaveat(files: readonly CurrentFile[],): string {
  /**
   * Paths whose buffers have unsaved changes; drives the singular/plural caveat shape below.
   */
  const modifiedPaths = files
    .filter(function isModified(file,) {
      return file.modified;
    },)
    .map(function getPath(file,) {
      return file.path;
    },);

  if (modifiedPaths.length
    === 0)
    return '';
  if (modifiedPaths.length
    === 1) {
    return `buffer has unsaved changes; CLI lint results reflect the saved file, not the current buffer: ${
      modifiedPaths[0]
    }`;
  }
  return `some buffers have unsaved changes; CLI lint results reflect saved files, not current buffers: ${
    modifiedPaths.join(', ',)
  }`;
}

/**
 * Joins caveat notes into a single block, prefixed with a blank line.
 *
 * @param notes - Array of note strings to join.
 *
 * @returns Formatted notes block or empty string when no notes.
 *
 * @example
 * ```ts
 * formatNotes(['unsaved changes', 'stale index']);
 * // '\n\n(note: unsaved changes)\n(note: stale index)'
 * ```
 */
export function formatNotes(notes: readonly string[],): string {
  if (notes.length
    === 0)
    return '';
  /**
   * Notes wrapped in `(note: ...)` markers and joined newline-separated; prefixed with a blank line by the caller.
   */
  const formattedNotes = notes
    .map(function prefixNote(note,) {
      return `(note: ${note})`;
    },)
    .join('\n',);
  return `\n\n${formattedNotes}`;
}

/**
 * Builds a header showing current file info from all Neovim instances.
 *
 * @param files - Current file metadata from all instances.
 *
 * @returns Multi-line header string.
 *
 * @example
 * ```ts
 * buildHeader([{ path: '/tmp/a.ts', filetype: 'typescript', modified: false }]);
 * // 'path: /tmp/a.ts\nfiletype: typescript\nmodified: false'
 * ```
 */
export function buildHeader(files: readonly CurrentFile[],): string {
  /**
   * First entry; used for the single-instance shortcut path that emits a vertical key/value block.
   */
  const [firstFile,] = files;
  if ((files.length
    === 1) && (firstFile !== undefined))
    return `path: ${firstFile.path}\nfiletype: ${firstFile.filetype}\nmodified: ${firstFile.modified}`;

  return files
    .map(function formatEntry(
      file,
      index,
    ) {
      return `[instance ${
        index + 1
      }] path: ${file.path} | filetype: ${file.filetype} | modified: ${file.modified}`;
    },)
    .join('\n',);
}

//endregion Helper functions
