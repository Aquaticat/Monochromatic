/**
 * `tomlGetCommentAfter`: trailing inline comment on the same source line.
 *
 * @module
 */

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw';

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
 * The same-line trailing inline comment for the node at `path`, or `null`.
 *
 * A comment is "trailing" when its `range[0]` is strictly after the node's
 * end and on the same source line (no newline between).
 *
 * @returns Result, or `null` when no match.
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
    edit: TomlEditState;
    path: TomlPath;
  },
): TomlComment | null {
  /** Effective resolution accounts for pending edits and deletes. */
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
    return null;
  /** Last AoT element is the one a trailing comment would attach to in source. */
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
