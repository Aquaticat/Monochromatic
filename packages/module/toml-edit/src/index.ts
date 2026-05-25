/**
 * Comment-preserving TOML read, edit, and write utility.
 *
 * Wraps `toml-eslint-parser` and adds a serializer plus a free-function edit API
 * over an immutable `TomlEditState`.
 *
 * Two fidelity modes:
 * - `'splice'` preserves the original bytes for unmutated regions (default).
 * - `'canonical'` rebuilds text from the AST with consistent formatting.
 *
 * Mutating functions return a fresh state; the AST and source are shared by
 * reference. Read functions consult pending deltas first, the parse-time AST
 * second, so branching on a state and querying it after a `tomlSet` reflects
 * the pending value.
 *
 * @example
 * Round-trip a file unchanged (splice mode, byte-identical):
 * ```ts
 * import { parseTomlEdit, tomlStringify } from '\@monochromatic-dev/module-toml-edit';
 *
 * const source = await Bun.file('mise.toml',).text();
 * const edit = parseTomlEdit({ source, },);
 * const text = tomlStringify({ edit, },);
 * // text === source
 * ```
 *
 * @packageDocumentation
 */

export type {
  AnchorKind,
  CanonicalOptions,
  CanonicalOptionsOverride,
  Edit,
  Insertion,
  TomlComment,
  TomlEditMode,
  TomlEditOptions,
  TomlEditState,
  TomlEmptyOptions,
  TomlPath,
  TomlValueInput,
  TomlWrappedInput,
} from './types.ts';

export {
  TomlEditError,
  TomlImmutableNodeError,
  TomlPathNotFoundError,
  TomlSpliceUnavailableError,
  TomlTypeError,
} from './errors.ts';

export { parseTomlEdit, } from './parse-toml-edit.ts';

export { emptyTomlEdit, } from './empty-toml-edit.ts';

export { tomlHas, } from './toml-has.ts';

export { tomlGet, } from './toml-get.ts';

export { tomlGetValue, } from './toml-get-value.ts';

export { tomlGetRaw, } from './toml-get-raw.ts';

export { tomlGetNode, } from './toml-get-node.ts';

export { tomlKeys, } from './toml-keys.ts';

export { tomlGetComments, } from './toml-get-comments.ts';

export { tomlGetCommentsBefore, } from './toml-get-comments-before.ts';

export { tomlGetCommentAfter, } from './toml-get-comment-after.ts';

export { tomlSet, } from './toml-set.ts';

export { tomlDelete, } from './toml-delete.ts';

export { tomlSetHeaderComment, } from './toml-set-header-comment.ts';

export { tomlInsertCommentBefore, } from './toml-insert-comment-before.ts';

export { tomlInsertCommentAfter, } from './toml-insert-comment-after.ts';

export { tomlStringify, } from './toml-stringify.ts';

export {
  getStaticTOMLValue,
  parseTOML,
} from 'toml-eslint-parser';
