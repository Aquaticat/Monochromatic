/**
 * `tomlGetCommentAfter`: trailing inline comment on the same source line.
 *
 * @module
 */

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import { trailingInlineCommentFor, } from './comments.ts';
import { effectiveAt, } from './effective-value.ts';
import { TomlPathNotFoundError, } from './errors.ts';
import { formatPath, } from './path.ts';
import type {
  TomlComment,
  TomlEditState,
  TomlPath,
} from './types.ts';

/**
 * The same-line trailing inline comment for the node at `path`.
 *
 * A comment is "trailing" when its `range[0]` is strictly after the node's
 * end and on the same source line (no newline between).
 *
 * @returns Object whose `comment` field is the trailing comment, or is
 *          absent when the node has no same-line trailing comment.
 *
 * @throws TomlPathNotFoundError when `path` does not exist or was deleted.
 *
 * @example
 * ```toml
 * key = "value"  # trailing
 * ```
 */
export function tomlGetCommentAfter(
  {
    edit,
    path,
  }: {
    readonly edit: TomlEditState;
    readonly path: TomlPath;
  },
): { readonly comment?: TomlComment; } {
  /**
   * Effective resolution accounts for pending edits and deletes.
   */
  const result = effectiveAt({
    edit,
    path,
  },);
  if ((result.kind
    === 'missing') || (result.kind
      === 'deleted')) {
    throw new TomlPathNotFoundError(
      `Path ${formatPath({ path, },)} not found`,
    );
  }
  if (result.kind
    === 'pending-value')
    return {};
  /**
   * Last AoT element is the one a trailing comment would attach to in source.
   */
  const node = result.kind
    === 'array-of-tables'
    ? nonNullishOrThrow(result.nodes
      .at(-1,),)
    : result.node;
  return trailingInlineCommentFor({
    node,
    edit,
  },);
}
