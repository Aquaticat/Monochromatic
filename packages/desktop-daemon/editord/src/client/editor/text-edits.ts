/**
 * Text edit application for the contenteditable editor.
 *
 * Applies formatting edits from the language server by sorting
 * bottom-to-top and splicing line content.
 */

import type { TextEdit, } from '../../../protocol.ts';

/**
 * Applies text edits to a line array.
 * Sorts edits bottom-to-top so earlier edits don't shift later positions.
 *
 * @param text - current editor content as a single string
 *
 * @param edits - text edits from the formatter
 *
 * @returns modified content as a single string
 */
export function applyEditsToText({
  text,
  edits,
}: {
  text: string;
  edits: TextEdit[];
},): string {
  const lines = text.split('\n',);

  const sorted = edits.toSorted(function compareEditsReverse(
    a,
    b,
  ) {
    const lineDiff = b.range.end.line - a.range.end.line;
    return lineDiff !== 0 ? lineDiff : b.range.end.character - a.range.end.character;
  },);

  for (const edit of sorted) {
    const before = lines[edit.range.start.line]?.slice(
      0,
      edit.range.start.character,
    )
      ?? '';
    const after = lines[edit.range.end.line]?.slice(edit.range.end.character,) ?? '';
    const newLines = (before + edit.newText + after).split('\n',);
    lines.splice(
      edit.range.start.line,
      edit.range.end.line - edit.range.start.line + 1,
      ...newLines,
    );
  }

  return lines.join('\n',);
}
