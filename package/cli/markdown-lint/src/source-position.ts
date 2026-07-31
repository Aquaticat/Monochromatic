import type { Point, } from 'unist';

/**
 * Offsets at which each line of a source starts, ascending, with the first
 * entry always 0. Built once per file so a rule reporting thousands of
 * positions does not rescan the source for each one.
 *
 * A line starts just past each `\n`. A `\r\n` therefore contributes one entry,
 * since its `\r` belongs to the line it ends rather than the one after it.
 *
 * @param source - source under lint
 *
 * @returns line-start offsets, ascending
 *
 * @example
 * ```ts
 * lineStartOffsets('a\nb\n'); // [0, 2, 4]
 * ```
 */
export function lineStartOffsets(source: string,): readonly number[] {
  /**
   * Line starts accumulated across the scan, seeded with the first line.
   */
  const starts: number[] = [0,];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '\n') {
      starts.push(index + 1,);
    }
  }
  return starts;
}

/**
 * Parameters for {@link lineIndexOf}.
 */
type LineIndexOfParams = {
  /**
   * Line-start offsets from {@link lineStartOffsets}.
   */
  readonly lineStarts: readonly number[];
  /**
   * Offset to locate.
   */
  readonly offset: number;
};

/**
 * Zero-based index of the line containing an offset, by binary search over the
 * line starts.
 *
 * @param lineStarts - line-start offsets, ascending
 *
 * @param offset - offset to locate
 *
 * @returns zero-based line index
 */
function lineIndexOf({
  lineStarts,
  offset,
}: LineIndexOfParams,): number {
  /**
   * Search bounds, narrowed until they meet on the last line that starts at or
   * before the offset. Held in one record so every mutable value is a number.
   */
  const bounds = {
    low: 0,
    high: lineStarts.length - 1,
  };
  while (bounds.low < bounds.high) {
    /**
     * Upper midpoint, so the loop always narrows and cannot spin on two
     * adjacent candidates.
     */
    const middle = Math.ceil((bounds.low + bounds.high) / 2,);
    if ((lineStarts[middle] ?? 0) <= offset) {
      bounds.low = middle;
    } else {
      bounds.high = middle - 1;
    }
  }
  return bounds.low;
}

/**
 * Parameters for {@link pointAt}.
 */
export type PointAtParams = {
  /**
   * Source the offset indexes.
   */
  readonly source: string;
  /**
   * Line-start offsets from {@link lineStartOffsets}.
   */
  readonly lineStarts: readonly number[];
  /**
   * Offset to describe.
   */
  readonly offset: number;
};

/**
 * The 1-based line and column of a source offset, for a diagnostic that has an
 * offset rather than a node to point at.
 *
 * Columns count code points rather than UTF-16 code units, which is what the
 * parser reports for node positions, so a rule that anchors at an offset and a
 * rule that anchors at a node agree on a line holding an astral character.
 * `doc/troubleshooting/satteri-offsets.md` records why the two differ.
 *
 * @param source - source the offset indexes
 *
 * @param lineStarts - line-start offsets, ascending
 *
 * @param offset - offset to describe
 *
 * @returns point with 1-based line and column, carrying the offset
 *
 * @example
 * ```ts
 * pointAt({ source: 'a\nbc', lineStarts: [0, 2], offset: 3 }); // line 2, column 2
 * ```
 */
export function pointAt({
  source,
  lineStarts,
  offset,
}: PointAtParams,): Point {
  /**
   * Zero-based index of the line the offset falls on.
   */
  const line = lineIndexOf({
    lineStarts,
    offset,
  },);
  /**
   * Offset the line starts at.
   */
  const lineStart = lineStarts[line] ?? 0;
  /**
   * Code points between the line start and the offset.
   */
  const counted = { column: 0, };
  for (const character of source.slice(
    lineStart,
    offset,
  )) {
    // Counting characters rather than code units: one astral character is a
    // surrogate pair and occupies one column.
    counted.column += character.length > 0
      ? 1
      : 0;
  }
  return {
    line: line + 1,
    column: counted.column + 1,
    offset,
  };
}
