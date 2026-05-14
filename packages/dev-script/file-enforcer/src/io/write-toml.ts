import {
  parseTomlEdit,
  tomlSet,
  tomlStringify,
  type TomlValueInput,
} from '@monochromatic-dev/module-toml-edit';
import type { Path, } from '../types.ts';
import {
  overwrite,
  readExisting,
} from './write.ts';

/**
 * Updates a single key in an existing TOML file, preserving comments and
 * unmutated whitespace byte-identically (splice mode).
 *
 * Reads the destination via the shared read cache, applies one `tomlSet`, then
 * routes the resulting text through {@link overwrite} so content-skip, cache
 * update, and write-time tracking are inherited.
 *
 * Throws when the destination does not exist; create-from-empty is a different
 * operation. To create an empty TOML and write keys into it, compose
 * `emptyTomlEdit + tomlSet + tomlStringify + overwrite` from
 * `\@monochromatic-dev/module-toml-edit` directly.
 *
 * @param dest - Path to the existing TOML file
 *
 * @param path - Sequence of key segments (and numeric array-of-tables indices)
 *
 * @param value - JS value to write at the path
 *
 * @throws Error when dest does not exist
 *
 * @throws Error from `parseTomlEdit` when the existing file is not valid TOML
 *
 * @example
 * ```ts
 * await overwriteTomlKey({
 *   dest: './pkg.toml',
 *   path: ['package', 'version',],
 *   value: '1.2.3',
 * },);
 * ```
 */
export async function overwriteTomlKey(
  {
    dest,
    path,
    value,
  }: {
    readonly dest: string;
    readonly path: Path;
    readonly value: TomlValueInput;
  },
): Promise<void> {
  /** Current file content; undefined when missing */
  const existing = await readExisting(dest,);
  if (existing === undefined)
    throw new Error(`overwriteTomlKey: ${dest} does not exist`,);
  /** Parsed TOML state for the existing content */
  const edit = parseTomlEdit({ source: existing, },);
  /** Fresh state with the pending edit recorded */
  const edited = tomlSet({
    edit,
    path,
    value,
  },);
  /** Updated source text; splice mode keeps unmutated regions byte-identical */
  const newContent = tomlStringify({ edit: edited, },);
  await overwrite({
    dest,
    content: newContent,
  },);
}
