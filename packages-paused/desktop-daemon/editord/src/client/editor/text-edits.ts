/**
 * Text edit application for the contenteditable editor.
 *
 * Applies formatting edits from the language server by sorting
 * bottom-to-top and splicing line content. Also maps cursor
 * positions through edit sets so the cursor survives formatting
 * and rename operations.
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
 *
 * @example
 * ```ts
 * const result = applyEditsToText({ text: 'const x = 42;', edits: [{ range: { start: { line: 2, character: 0 }, end: { line: 2, character: 5 } }, newText: "const" }], });
 * ```
 */
export function applyEditsToText({
  text,
  edits,
}: {
  readonly text: string;
  readonly edits: readonly TextEdit[];
},): string {
  /**
   * Editor text split into per-line strings; mutated by `splice` for each applied edit.
   */
  const lines = text.split('\n',);

  /**
   * Edits sorted bottom-to-top so applying earlier ones never shifts later ranges.
   */
  const sorted = edits.toSorted(function compareEditsReverse(
    a,
    b,
  ) {
    /**
     * Line diff (b - a) for reverse ordering; falls through to character on ties.
     */
    const lineDiff = b.range
      .end
      .line
      - a
      .range
      .end
      .line;
    return lineDiff !== 0 ? lineDiff : b.range
      .end
      .character
      - a
      .range
      .end
      .character;
  },);

  for (const edit of sorted) {
    /**
     * Text on the start line before the edit range; preserved verbatim around the replacement.
     */
    const before = lines[edit.range
      .start
      .line]
      ?.slice(
      0,
      edit.range
        .start
        .character,
    )
      ?? '';
    /**
     * Text on the end line after the edit range; preserved verbatim around the replacement.
     */
    const after = lines[edit.range
      .end
      .line]
      ?.slice(edit.range
        .end
        .character,)
      ?? '';
    /**
     * Replacement lines for the spliced range; `newText` may introduce or collapse line breaks.
     */
    const newLines = (before + edit
      .newText
      + after).split('\n',);
    lines.splice(
      edit.range
        .start
        .line,
      (edit.range
        .end
        .line
        - edit
        .range
        .start
        .line) + 1,
      ...newLines,
    );
  }

  return lines.join('\n',);
}

/**
 * Converts a `(line, character)` coordinate into a single byte-agnostic
 * character offset within the joined-by-newline text.
 *
 * @param position - 0-based line and character coordinates
 *
 * @param lines - text split by `'\n'`
 *
 * @returns absolute character offset
 *
 * @example
 * ```ts
 * const offset = positionToOffset({ position: { line: 1, character: 1, }, lines: ['ab', 'cd',], });
 * // offset === 4 (text 'ab\ncd', line 1 starts at offset 3, +1 = 4)
 * ```
 */
function positionToOffset({
  position,
  lines,
}: {
  readonly position: {
    readonly line: number;
    readonly character: number;
  };
  readonly lines: readonly string[];
},): number {
  return lines
    .slice(
      0,
      position.line,
    )
    .reduce(
      function addLineLength(
        sum,
        line,
      ) {
        return sum + line
          .length
          + 1;
      },
      0,
    )
    + position
    .character;
}

/**
 * Converts an absolute character offset back into `(line, character)`
 * coordinates. Offsets past the end clamp to the last character.
 *
 * @param offset - absolute character offset
 *
 * @param lines - text split by `'\n'`
 *
 * @returns 0-based line and character coordinates
 *
 * @example
 * ```ts
 * const pos = offsetToPosition({ offset: 4, lines: ['ab', 'cd',], });
 * // pos === { line: 1, character: 1, }
 * ```
 */
function offsetToPosition({
  offset,
  lines,
}: {
  readonly offset: number;
  readonly lines: readonly string[];
},): {
  readonly line: number;
  readonly character: number;
} {
  /**
   * Accumulator for offset remaining as we walk the lines.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- line-walker cursor: `remaining` decrements by each line's length plus terminator, with early return when the line is found
  let remaining = offset;
  for (const [line, lineText,] of lines.entries()) {
    /**
     * Visible length of this line, excluding its `\n` terminator.
     */
    const lineLen = lineText.length;
    if (remaining <= lineLen) {
      return {
        line,
        character: remaining,
      };
    }
    remaining -= lineLen + 1;
  }
  /**
   * Index of the last line; clamped to 0 for empty input so subsequent lookup never goes negative.
   */
  const lastLine = Math.max(
    0,
    lines.length
      - 1,
  );
  return {
    line: lastLine,
    character: lines[lastLine]
      ?.length
      ?? 0,
  };
}

/**
 * Maps a cursor position through a set of text edits, returning the
 * equivalent position in the post-edit text. Used to keep the cursor
 * stable across formatting and rename operations that replace the
 * entire DOM via `setText`.
 *
 * Cases handled:
 * - Edit fully before cursor: cursor shifts by the edit's length delta.
 * - Edit at or after cursor: cursor is unaffected; remaining edits skipped.
 * - Cursor strictly inside edit: cursor lands at the end of the edit's
 *   replacement text, matching standard editor convention for replaced ranges.
 *
 * @param cursor - 0-based cursor position in the original text
 *
 * @param edits - text edits being applied (positions in original text)
 *
 * @param originalText - editor text before edits are applied
 *
 * @param newText - editor text after edits have been applied
 *
 * @returns 0-based cursor position in the post-edit text
 *
 * @example
 * ```ts
 * const restored = mapCursorThroughEdits({
 *   cursor: { line: 0, character: 4, },
 *   edits: [{ range: { start: { line: 0, character: 0, }, end: { line: 0, character: 3, }, }, newText: 'barbaz', },],
 *   originalText: 'foo bar',
 *   newText: 'barbaz bar',
 * },);
 * // restored === { line: 0, character: 7, }
 * ```
 */
export function mapCursorThroughEdits({
  cursor,
  edits,
  originalText,
  newText,
}: {
  readonly cursor: {
    readonly line: number;
    readonly character: number;
  };
  readonly edits: readonly TextEdit[];
  readonly originalText: string;
  readonly newText: string;
},): {
  readonly line: number;
  readonly character: number;
} {
  /**
   * Pre-edit text split by `\n`; used to translate the original cursor to an absolute offset.
   */
  const originalLines = originalText.split('\n',);
  /**
   * Cursor expressed as a single offset against `originalText`, simplifying edit-shift arithmetic.
   */
  const cursorOffset = positionToOffset({
    position: cursor,
    lines: originalLines,
  },);

  /**
   * Sort top-to-bottom so accumulated offset shift remains valid as we iterate.
   */
  const sorted = edits.toSorted(function compareEditsForward(
    a,
    b,
  ) {
    /**
     * Line diff for forward ordering; falls through to character on ties.
     */
    const lineDiff = a.range
      .start
      .line
      - b
      .range
      .start
      .line;
    return lineDiff !== 0 ? lineDiff : a.range
      .start
      .character
      - b
      .range
      .start
      .character;
  },);

  /**
   * Running delta `newOffset - originalOffset` accumulated across edits.
   */
  // oxlint-disable-next-line no-restricted-syntax/no-function-root-let -- edit-walker accumulator: `shift` accumulates length deltas with early `break` once the cursor falls inside an edit
  let shift = 0;

  for (const edit of sorted) {
    /**
     * Edit start as an absolute offset in `originalText`; compared against `cursorOffset` for case routing.
     */
    const editStart = positionToOffset({
      position: edit.range
        .start,
      lines: originalLines,
    },);
    /**
     * Edit end as an absolute offset in `originalText`; matched against `cursorOffset` to detect inclusion.
     */
    const editEnd = positionToOffset({
      position: edit.range
        .end,
      lines: originalLines,
    },);

    if (editEnd <= cursorOffset) {
      shift += edit.newText
        .length
        - (editEnd - editStart);
      continue;
    }
    if (editStart < cursorOffset) {
      /**
       * Cursor is inside this edit; clamp to end of replacement text.
       */
      shift += (editStart
        + edit
        .newText
        .length) - cursorOffset;
    }
    break;
  }

  /**
   * Post-edit text split by `\n`; basis for translating the shifted offset back to a `(line, character)`.
   */
  const newLines = newText.split('\n',);
  return offsetToPosition({
    offset: cursorOffset + shift,
    lines: newLines,
  },);
}
