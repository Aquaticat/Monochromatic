/**
 * `tomlInsertCommentAfter`: add a same-line trailing inline comment.
 *
 * @module
 */

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

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
 * @returns A fresh `TomlEditState` reflecting the change.
 *
 * @throws TomlPathNotFoundError when `path` does not exist.
 *
 * @example
 * ```ts
 * tomlInsertCommentAfter({ edit, path: ['version',], comment: ' bumped', },);
 * ```
 */
export function tomlInsertCommentAfter(
  {
    edit,
    path,
    comment,
  }: {
    readonly edit: TomlEditState;
    readonly path: TomlPath;
    readonly comment: string;
  },
): TomlEditState {
  /** Path lookup so missing keys throw before any state change. */
  const resolved = resolveByPath({
    edit,
    path,
  },);
  if ((resolved.kind
    === 'missing') || (resolved.kind
      === 'top-level')) {
    throw new TomlPathNotFoundError(
      `Path ${formatPath({ path, },)} not found`,
    );
  }

  /** Use the last AoT element so the comment lands next to the entry the caller named. */
  const node = resolved.kind
    === 'array-of-tables'
    ? nonNullishOrThrow(resolved.nodes
      .at(-1,),)
    : resolved.node;

  /** Two-space prefix matches the prevailing style for trailing comments. */
  const text = `  # ${comment}`;

  /** Anchor records placement so the emitter can splice in source order. */
  const anchor: Insertion['anchor'] = {
    position: 'same-line-after',
    node,
  };

  return {
    ...edit,
    insertions: [
      ...edit.insertions,
      {
        anchor,
        text,
      },
    ],
  };
}
