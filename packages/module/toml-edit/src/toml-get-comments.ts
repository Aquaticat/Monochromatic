/**
 * `tomlGetComments`: return every comment on the file.
 *
 * @module
 */

import type {
  TomlComment,
  TomlEditState,
} from './types.ts';

/**
 * Every `Block`-typed comment in the parse-time source, in source order.
 *
 * The list is unaffected by pending deltas; new comments inserted via
 * `tomlInsertCommentBefore` / `tomlInsertCommentAfter` are not reflected
 * here until the source is re-parsed.
 *
 * @returns Computed result (`readonly TomlComment[]`).
 *
 * @example
 * ```ts
 * tomlGetComments({ edit, },);  // [{ value: ' header', range: [0, 8,], ...},]
 * ```
 */
export function tomlGetComments(
  { edit, }: { readonly edit: TomlEditState; },
): readonly TomlComment[] {
  return edit.program
    .comments;
}
