/**
 * `tomlInsertCommentAfter`: add a same-line trailing inline comment.
 *
 * @module
 */

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw';

import { TomlPathNotFoundError, } from './errors.ts';
import { formatPath, } from './path.ts';
import { resolveByPath, } from './resolve.ts';
import type {
  Insertion,
  TomlEditState,
  TomlPath,
} from './types.ts';

/**
 * Append a same-line inline `# <comment>` after the value at `path`.
 *
 * The comment is stored as a pending `Insertion` and emitted at
 * `tomlStringify` time. It is placed right after the node's end on the
 * same source line, before the newline.
 *
 * @throws TomlPathNotFoundError when `path` does not exist.
 */
export function tomlInsertCommentAfter(
  {
    edit,
    path,
    comment,
  }: {
    edit: TomlEditState;
    path: TomlPath;
    comment: string;
  },
): TomlEditState {
  const resolved = resolveByPath({ edit, path, },);
  if (resolved.kind === 'missing' || resolved.kind === 'top-level')
    throw new TomlPathNotFoundError(
      `Path ${formatPath({ path, },)} not found`,
    );

  const node = resolved.kind === 'array-of-tables'
    ? nonNullishOrThrow(resolved.nodes[resolved.nodes.length - 1],)
    : resolved.node;

  const text = `  # ${comment}`;

  const anchor: Insertion['anchor'] = { position: 'same-line-after', node, };

  return { ...edit, insertions: [...edit.insertions, { anchor, text, },], };
}
