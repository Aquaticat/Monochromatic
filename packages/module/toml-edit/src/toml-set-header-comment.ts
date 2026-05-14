/**
 * `tomlSetHeaderComment`: set or clear the file's header comment block.
 *
 * @module
 */

import type {
  TomlEditState,
} from './types.ts';

/**
 * Set the header comment block.
 *
 * Pass a string (or array of lines) for the new comment, or `null` to
 * clear. Each line is emitted as `# <line>` by canonical-mode output,
 * preceded by a blank line.
 *
 * Splice-mode emission does not currently re-flow existing source
 * comments; setting a header comment in splice mode affects only
 * canonical re-emission via `tomlStringify` when the state is canonical.
 */
export function tomlSetHeaderComment(
  {
    edit,
    comment,
  }: {
    edit: TomlEditState;
    comment: string | readonly string[] | null;
  },
): TomlEditState {
  const headerComment = resolveComment({ comment, },);
  return { ...edit, headerComment, };
}

/** Normalise the `comment` arg to a single newline-joined string or `null`. */
function resolveComment(
  { comment, }: { comment: string | readonly string[] | null; },
): string | null {
  if (comment === null) return null;
  if (typeof comment === 'string') return comment;
  return comment.join('\n',);
}
