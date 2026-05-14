/**
 * `tomlGetCommentsBefore`: attached comment block immediately before a path.
 *
 * @module
 */

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw';

import { attachedCommentsFor, } from './comments.ts';
import { effectiveAt, } from './effective-value.ts';
import { TomlPathNotFoundError, } from './errors.ts';
import { formatPath, } from './path.ts';
import type {
  TomlComment,
  TomlEditState,
  TomlPath,
} from './types.ts';

/**
 * The contiguous block of `Block` comments immediately preceding the node
 * at `path`, with no blank line between any pair. A comment separated from
 * the node by a blank line is NOT attached.
 *
 * @returns Computed result (`readonly TomlComment[]`).
 *
 * @throws TomlPathNotFoundError when `path` does not exist or was deleted.
 *
 * @example
 * ```toml
 * # not attached: blank line below
 *
 * # attached
 * key = 1
 * ```
 */
export function tomlGetCommentsBefore(
  {
    edit,
    path,
  }: {
    edit: TomlEditState;
    path: TomlPath
  },
): readonly TomlComment[] {
  const result = effectiveAt({
    edit,
    path,
  },);
  if ((result.kind === 'missing') || (result.kind === 'deleted'))
    throw new TomlPathNotFoundError(
      `Path ${formatPath({ path, },)} not found`,
    );
  if (result.kind === 'pending-value')
    return [];
  const node = result.kind === 'array-of-tables' ? nonNullishOrThrow(result.nodes[0],) : result.node;
  return attachedCommentsFor({
    node,
    edit,
  },);
}
