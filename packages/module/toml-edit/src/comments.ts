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

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import type { AST, } from 'toml-eslint-parser';

import type {
  TomlComment,
  TomlEditState,
} from './types.ts';

/**
 * Tests whether `s` consists entirely of spaces/tabs surrounding exactly
 * one newline. Mirrors the shape of `/^[ \t]*\n[ \t]*$/` with a linear
 * scan; used to detect "attached" comment gaps (a single line break with
 * no blank line between).
 *
 * @param s - candidate gap string
 *
 * @returns whether the gap is space/tab-only with exactly one newline
 *
 * @example
 * ```ts
 * isAttachedGap('\n',);   // true  (single line break attaches)
 * isAttachedGap('\n\n',); // false (blank line breaks attachment)
 * ```
 */
export function isAttachedGap(s: string,): boolean {
  return (function scan(): boolean {
    /**
     * Running count of newlines; a second one disqualifies the gap.
     */
    let newlineCount = 0;
    for (const char of s) {
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
  })();
}

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
    readonly node: AST.TOMLNode;
    readonly edit: TomlEditState;
  },
): readonly TomlComment[] {
  /**
   * Local alias so the recursive walker reads as `comments[i]`.
   */
  const { comments, } = edit.program;
  /**
   * Source bytes so the gap test can read between adjacent comments.
   */
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
    readonly comments: readonly TomlComment[];
    readonly source: string;
    readonly cursor: number;
  },
): readonly TomlComment[] {
  /**
   * Last comment whose end falls before the cursor; starting point for the backward walk.
   */
  const initialIdx = lastCommentBefore({
    comments,
    offset: cursor,
  },);
  /**
   * IIFE scopes the moving cursor so no `let` survives at the function-body root.
   */
  return (function walk(): TomlComment[] {
    /**
     * Cursor that retreats to each attached comment's start as the block grows.
     */
    let cursorPos = cursor;
    /**
     * Filled nearest-first while walking back, reversed to source order on return.
     */
    const collected: TomlComment[] = [];
    for (let idx = initialIdx; idx >= 0; idx--) {
      /**
       * Candidate comment so the gap check can decide if it is still attached.
       */
      const comment = nonNullishOrThrow(comments[idx],);
      /**
       * Start and end offsets of the candidate comment.
       */
      const [commentStart, commentEnd,] = comment.range;
      if (commentEnd >= cursorPos)
        continue;
      /**
       * Source between the comment and the cursor; whitespace-only means still attached.
       */
      const between = source.slice(
        commentEnd,
        cursorPos,
      );
      if (!isAttachedGap(between,))
        break;
      collected.push(comment,);
      cursorPos = commentStart;
    }
    return collected.toReversed();
  })();
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
    readonly comments: readonly TomlComment[];
    readonly offset: number;
  },
): number {
  return comments.reduce(
    function step(
      acc,
      c,
      i,
    ) {
      if (c.range[1]
        < offset)
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
 * @returns Object whose `comment` field is the trailing comment, or is
 *          absent when the node has no same-line trailing comment.
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
    readonly node: AST.TOMLNode;
    readonly edit: TomlEditState;
  },
): { readonly comment?: TomlComment; } {
  /**
   * Source bytes so the same-line check can scan for the next newline.
   */
  const { source, } = edit;
  /**
   * First newline after the node; `-1` means EOF, so `limit` falls back to `source.length`.
   */
  const newlineAfter = source.indexOf(
    '\n',
    node.range[1],
  );
  /**
   * Upper bound for "still on the same line" matches.
   */
  const limit = newlineAfter === (-1) ? source.length : newlineAfter;
  /**
   * First comment that starts after the node and before the line break.
   */
  const match = edit.program
    .comments
    .find(function inLine(c,) {
    return (c.range[0]
      > node
      .range[1]) && (c.range[0]
        < limit);
  },);
  if (match === undefined)
    return {};
  return { comment: match, };
}
