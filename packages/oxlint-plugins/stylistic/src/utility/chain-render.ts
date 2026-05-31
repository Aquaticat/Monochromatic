/**
 * One element of a flattened chain in source order.
 *
 * `isBreak: true` marks a break point (a member-name step or an operator's
 * right operand) that may begin a continuation line; `breakOffset` is the byte
 * offset of the leading token that renders at the start of that line (the
 * `.`/`?.` for a member step, or the operator token for an operator step).
 * `isBreak: false` marks an attached segment (the head leaf, a call step, or a
 * computed step) that always rides on the line of the segment before it.
 */
export type ChainSegment =
  | { readonly isBreak: false; }
  | {
    readonly isBreak: true;
    /**
     * Byte offset of the segment's leading token; start of its continuation line.
     */
    readonly breakOffset: number;
  };

/**
 * Selects the break offsets that actually begin a continuation line.
 *
 * The layout rule reduces to a single test: a break point breaks when two or
 * more segments precede it on the head line, and every break point after the
 * first such one also breaks. Because segments accumulate left to right and the
 * leaf occupies index `0`, "two or more segments before it" is exactly
 * "segment index of two or more". Every later break point has a higher index,
 * so the set of breaking points is precisely the break points at index two or
 * greater; locating the first one separately is unnecessary.
 *
 * @param segments - flattened chain segments in source order, leaf at index 0
 *
 * @returns break offsets in source order, empty when the chain stays on one line
 *
 * @example
 * ```ts
 * // segments for `a.b.c`: [leaf, .b(break), .c(break)]
 * selectBreakOffsets(segments); // [offset of `.c`]
 * ```
 */
export function selectBreakOffsets(
  segments: readonly ChainSegment[],
): readonly number[] {
  return segments.flatMap(function pick(
    segment,
    index,
  ): number[] {
    // The literal 2 is the magic-number exemption; it needs no name.
    return (segment.isBreak
      && (index >= 2))
      ? [segment.breakOffset,]
      : [];
  },);
}

/**
 * Parameters for {@link renderCanonical}.
 */
export type RenderCanonicalParams = {
  /**
   * Full file source text.
   */
  readonly sourceText: string;
  /**
   * Byte offset where the chain region begins (the head leaf).
   */
  readonly regionStart: number;
  /**
   * Byte offset where the chain region ends, past any trailing wrapper.
   */
  readonly regionEnd: number;
  /**
   * Break offsets in source order, as returned by {@link selectBreakOffsets}.
   */
  readonly breakOffsets: readonly number[];
  /**
   * Whitespace prefix prepended to every continuation line.
   */
  readonly childIndent: string;
};

/**
 * Renders the chain region in canonical layout by slicing source between the
 * break offsets, so comments and exact operand text inside each kept slice
 * survive verbatim.
 *
 * The head line runs from `regionStart` to the first break offset; each
 * continuation line runs from its break offset to the next break offset (or
 * `regionEnd` for the last). Trailing whitespace on every line is trimmed, so
 * the result carries no trailing spaces and no whitespace-only lines, and
 * re-rendering already-canonical source reproduces it byte for byte.
 *
 * @returns canonical multi-line rendering, or the verbatim region when there
 *   are no breaks
 *
 * @throws when a break offset has no matching end offset, which is
 *   unreachable because the end list is built one-to-one from the breaks
 *
 * @example
 * ```ts
 * // `a.b.c` with breaks at `.c`: renders `a.b\n  .c`
 * renderCanonical({ sourceText, regionStart, regionEnd, breakOffsets, childIndent: '  ', });
 * ```
 */
export function renderCanonical({
  sourceText,
  regionStart,
  regionEnd,
  breakOffsets,
  childIndent,
}: RenderCanonicalParams,): string {
  if (breakOffsets.length
    === 0) {
    return sourceText.slice(
      regionStart,
      regionEnd,
    );
  }
  /**
   * End offset of each continuation slice: the next break, or the region end for the last.
   */
  const ends: readonly number[] = [
    ...breakOffsets.slice(1,),
    regionEnd,
  ];
  /**
   * First break offset; start of the first continuation line and end of the head slice.
   */
  const firstBreak = breakOffsets[0]
    ?? regionEnd;
  /**
   * Head line: from region start to the first break, trailing whitespace removed.
   */
  const head = sourceText
    .slice(
      regionStart,
      firstBreak,
    )
    .trimEnd();
  /**
   * One `\n + indent + content` string per break offset, content sliced verbatim.
   */
  const continuations = breakOffsets.map(function piece(
    offset,
    index,
  ): string {
    /**
     * Slice end for this break: paired one-to-one with `breakOffsets` by construction.
     */
    const end = ends[index];
    if (end === undefined) {
      throw new Error('chain render: break offset without matching end',);
    }
    return `\n${childIndent}${
      sourceText
        .slice(
          offset,
          end,
        )
        .trimEnd()
    }`;
  },);
  return `${head}${continuations.join('',)}`;
}
