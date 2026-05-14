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
  { node, edit, }: { node: AST.TOMLNode; edit: TomlEditState; },
): readonly TomlComment[] {
  const comments = edit.program.comments;
  const source = edit.source;
  return collectAttached({
    comments,
    source,
    cursor: node.range[0],
  },);
}

/** Walk backwards from `cursor`, collecting comments with no blank gap. */
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
  const collected: TomlComment[] = [];
  const initialIdx = lastCommentBefore({ comments, offset: cursor, },);
  const fold = (function loop(i: number, c: number,): TomlComment[] {
    if (i < 0) return collected;
    const comment = nonNullishOrThrow(comments[i],);
    if (comment.range[1] >= c) return loop(i - 1, c,);
    const between = source.slice(comment.range[1], c,);
    if (!ATTACHED_GAP_PATTERN.test(between,)) return collected;
    collected.unshift(comment,);
    return loop(i - 1, comment.range[0],);
  })(initialIdx, cursor,);
  return fold;
}

/** Index of the last comment whose end is before `offset`, or -1. */
function lastCommentBefore(
  { comments, offset, }: { comments: readonly TomlComment[]; offset: number; },
): number {
  return comments.reduce(function step(acc, c, i,) {
    if (c.range[1] < offset) return i;
    return acc;
  }, -1,);
}

/**
 * The same-line trailing inline comment for `node`, if any.
 *
 * A comment is "trailing" when its `range[0]` is strictly after `node.range[1]`
 * and on the same source line (no newline between).
 *
 * @example
 * ```toml
 * key = "value"  # this is the trailing inline comment for `key`
 * ```
 */
export function trailingInlineCommentFor(
  { node, edit, }: { node: AST.TOMLNode; edit: TomlEditState; },
): TomlComment | null {
  const source = edit.source;
  const newlineAfter = source.indexOf('\n', node.range[1],);
  const limit = newlineAfter === -1 ? source.length : newlineAfter;
  const match = edit.program.comments.find(function inLine(c,) {
    return c.range[0] > node.range[1] && c.range[0] < limit;
  },);
  return match ?? null;
}
