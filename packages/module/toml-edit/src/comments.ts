/**
 * Comment-attachment resolvers.
 *
 * Comments in toml-eslint-parser live in `Program.comments` as a flat sorted
 * array, NOT attached to nodes. Attribution to a key is positional: a
 * contiguous block of `Block` comments immediately preceding the key with no
 * blank line between is considered "attached"; a comment on the same line
 * as the key's value is the "trailing inline comment".
 *
 * @module
 */

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw';
import type { AST, } from 'toml-eslint-parser';

import type {
  TomlComment,
  TomlEditState,
} from './types.ts';

/** Whitespace-and-single-newline pattern used to recognise "attached" gaps. */
const ATTACHED_GAP_PATTERN = /^[ \t]*\n[ \t]*$/;

/**
 * The block of `Block` comments immediately preceding `node` with no blank
 * line between any pair. Returned in source order.
 *
 * @returns Computed result (`readonly TomlComment[]`).
 *
 * @example
 * ```toml
 * # header1
 * # header2
 *
 * # attached1
 * # attached2
 * key = 1
 * ```
 * `attachedCommentsFor` on `key` returns `[attached1, attached2,]`.
 */
export function attachedCommentsFor(
  {
    node,
    edit,
  }: {
    node: AST.TOMLNode;
    edit: TomlEditState;
  },
): readonly TomlComment[] {
  /** Local alias so the recursive walker reads as `comments[i]`. */
  const { comments, } = edit.program;
  /** Source bytes so the gap test can read between adjacent comments. */
  const { source, } = edit;
  return collectAttached({
    comments,
    source,
    cursor: node.range[0],
  },);
}

/**
 * Walk backwards from `cursor`, collecting comments with no blank gap.
 *
 * @returns Computed result (`readonly TomlComment[]`).
 */
function collectAttached(
  {
    comments,
    source,
    cursor,
  }: {
    comments: readonly TomlComment[];
    source: string;
    cursor: number;
  },
): readonly TomlComment[] {
  /** Accumulator filled in source order via `unshift`. */
  const collected: TomlComment[] = [];
  /** Last comment whose end falls before the cursor; starting point for the walk. */
  const initialIdx = lastCommentBefore({
    comments,
    offset: cursor,
  },);
  /** IIFE-into-const so the recursive walker satisfies the no-let-root rule. */
  const fold = (function loop(
    i: number,
    c: number,
  ): TomlComment[] {
    if (i < 0)
      return collected;
    /** Candidate comment so the gap check can decide if it is still attached. */
    const comment = nonNullishOrThrow(comments[i],);
    if (comment.range[1] >= c) {
      return loop(
        i - 1,
        c,
      );
    }
    /** Source between the comment and the cursor; whitespace-only means still attached. */
    const between = source.slice(
      comment.range[1],
      c,
    );
    if (!ATTACHED_GAP_PATTERN.test(between,))
      return collected;
    collected.unshift(comment,);
    return loop(
      i - 1,
      comment.range[0],
    );
  })(
    initialIdx,
    cursor,
  );
  return fold;
}

/**
 * Index of the last comment whose end is before `offset`, or -1.
 *
 * @returns Computed number.
 */
function lastCommentBefore(
  {
    comments,
    offset,
  }: {
    comments: readonly TomlComment[];
    offset: number;
  },
): number {
  return comments.reduce(
    function step(
      acc,
      c,
      i,
    ) {
      if (c.range[1] < offset)
        return i;
      return acc;
    },
    -1,
  );
}

/**
 * The same-line trailing inline comment for `node`, if any.
 *
 * A comment is "trailing" when its `range[0]` is strictly after `node.range[1]`
 * and on the same source line (no newline between).
 *
 * @returns Result, or `null` when no match.
 *
 * @example
 * ```toml
 * key = "value"  # this is the trailing inline comment for `key`
 * ```
 */
export function trailingInlineCommentFor(
  {
    node,
    edit,
  }: {
    node: AST.TOMLNode;
    edit: TomlEditState;
  },
): TomlComment | null {
  /** Source bytes so the same-line check can scan for the next newline. */
  const { source, } = edit;
  /** First newline after the node; `-1` means EOF, so `limit` falls back to `source.length`. */
  const newlineAfter = source.indexOf(
    '\n',
    node.range[1],
  );
  /** Upper bound for "still on the same line" matches. */
  const limit = newlineAfter === (-1) ? source.length : newlineAfter;
  /** First comment that starts after the node and before the line break. */
  const match = edit.program.comments.find(function inLine(c,) {
    return (c.range[0] > node.range[1]) && (c.range[0] < limit);
  },);
  return match ?? null;
}
