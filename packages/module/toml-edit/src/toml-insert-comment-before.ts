/**
 * `tomlInsertCommentBefore`: add a comment block immediately before a path.
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
 * Insert one or more `#`-prefixed lines just before the node at `path`.
 *
 * The new comment lines are stored as a pending `Insertion` and emitted at
 * `tomlStringify` time. They do not show up in `tomlGetComments` until the
 * output is reparsed.
 *
 * @returns A fresh `TomlEditState` reflecting the change.
 *
 * @throws TomlPathNotFoundError when `path` does not exist.
 *
 * @example
 * ```ts
 * tomlInsertCommentBefore({ edit, path: ['version',], comment: ' bumped', },);
 * tomlInsertCommentBefore({ edit, path: ['tools',], comment: [' line one', ' line two',], },);
 * ```
 */
export function tomlInsertCommentBefore(
  {
    edit,
    path,
    comment,
  }: {
    readonly edit: TomlEditState;
    readonly path: TomlPath;
    readonly comment: string | readonly string[];
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

  /** Normalised to an array so a single string and a multi-line list share the join path. */
  const lines = toLines({ comment, },);
  /** Each line gets the `# ` prefix and a newline so it stands as its own physical line. */
  const text = lines
    .map(function withHash(line,) {
      return `# ${line}\n`;
    },)
    .join('',);

  /** Anchor records placement so the emitter can splice in source order. */
  const anchor: Insertion['anchor'] = resolved.kind
    === 'array-of-tables'
    ? {
      position: 'before-node',
      node: nonNullishOrThrow(resolved.nodes[0],),
    }
    : {
      position: 'before-node',
      node: resolved.node,
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

/**
 * Normalise the `comment` arg to a readonly array of lines.
 *
 * @returns Computed result (`readonly string[]`).
 */
function toLines(
  { comment, }: { readonly comment: string | readonly string[]; },
): readonly string[] {
  if ((typeof comment) === 'string')
    return [comment,];
  return comment;
}
