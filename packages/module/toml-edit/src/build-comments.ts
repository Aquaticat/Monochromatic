/**
 * Build-time helpers over the flat `program.comments` list and source: compute
 * an entry's physical line end, and extract attached / trailing comment text.
 *
 * Comments in `toml-eslint-parser` are unattached (a sorted `program.comments`
 * array); attribution is positional. A contiguous block of comments
 * immediately above a node with no blank line between is "attached"; a comment
 * on the same line after the node's value is the "trailing" comment. Extracted
 * text is the comment value (the bytes after `#`), used for reads and synthetic
 * rendering; clean nodes still emit the real bytes verbatim.
 *
 * @module
 */

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import type { TomlComment, } from './types.ts';

/**
 * Offset just past the line terminator at or after `from` (EOF when none).
 *
 * A same-line trailing comment sits before that newline, so this span end
 * absorbs it and the newline for free.
 *
 * @returns Computed offset.
 *
 * @example
 * ```ts
 * lineEndAfter({ source: 'a = 1\n', from: 5, },); // 6
 * ```
 */
export function lineEndAfter(
  {
    source,
    from,
  }: {
    readonly source: string;
    readonly from: number;
  },
): number {
  /**
   * First newline at or after `from`; `-1` means the line runs to EOF.
   */
  const nl = source.indexOf(
    '\n',
    from,
  );
  return nl === (-1) ? source.length : nl + 1;
}

/**
 * Whitespace-only gap containing exactly one newline (single line break, no
 * blank line), the shape that keeps a preceding comment "attached".
 *
 * @returns Whether the gap attaches.
 *
 * @example
 * ```ts
 * isAttachedGap('\n',);   // true
 * isAttachedGap('\n\n',); // false
 * ```
 */
export function isAttachedGap(gap: string,): boolean {
  /**
   * Running newline count; a second one (a blank line) breaks attachment.
   */
  let newlineCount = 0;
  for (const char of gap) {
    if (char === '\n') {
      if (newlineCount >= 1)
        return false;
      newlineCount += 1;
      continue;
    }
    if ((char !== ' ') && (char !== '\t'))
      return false;
  }
  return newlineCount === 1;
}

/**
 * Comment values (bytes after `#`) attached immediately above `at`, in source
 * order.
 *
 * @returns Computed comment-value strings.
 *
 * @example
 * ```ts
 * attachedCommentValues({ comments, source, at: kv.range[0], },); // [' header']
 * ```
 */
export function attachedCommentValues(
  {
    comments,
    source,
    at,
  }: {
    readonly comments: readonly TomlComment[];
    readonly source: string;
    readonly at: number;
  },
): readonly string[] {
  /**
   * Index of the last comment ending before `at`; the backward walk starts here.
   */
  const initialIdx = comments.reduce(
    function step(
      acc,
      c,
      i,
    ) {
      return c.range[1]
        < at ? i : acc;
    },
    -1,
  );
  /**
   * Cursor retreating to each attached comment's start as the block grows.
   */
  let cursorPos = at;
  /**
   * Collected nearest-first; reversed to source order on return.
   */
  const collected: string[] = [];
  for (let idx = initialIdx; idx >= 0; idx--) {
    /**
     * Candidate comment so the gap check can decide whether it stays attached.
     */
    const comment = nonNullishOrThrow(comments[idx],);
    if (comment.range[1]
      >= cursorPos)
      continue;
    if (!isAttachedGap(source.slice(
      comment.range[1],
      cursorPos,
    ),))
      break;
    collected.push(comment.value,);
    cursorPos = comment.range[0];
  }
  return collected.toReversed();
}

/**
 * Trailing same-line comment value after `from`, if any.
 *
 * @returns Comment value, or `undefined` when there is none on the line.
 *
 * @example
 * ```ts
 * trailingCommentValue({ comments, source, from: kv.value.range[1], },); // ' note'
 * ```
 */
export function trailingCommentValue(
  {
    comments,
    source,
    from,
  }: {
    readonly comments: readonly TomlComment[];
    readonly source: string;
    readonly from: number;
  },
): string | undefined {
  /**
   * End of the current line; the trailing comment must start before it.
   */
  const newlineAfter = source.indexOf(
    '\n',
    from,
  );
  /**
   * Upper bound for a same-line match (EOF when the line runs to end).
   */
  const limit = newlineAfter === (-1) ? source.length : newlineAfter;
  /**
   * First comment starting after `from` and before the line break.
   */
  const match = comments.find(function inLine(c,) {
    return (c.range[0]
      > from) && (c.range[0]
        < limit);
  },);
  return match?.value;
}
