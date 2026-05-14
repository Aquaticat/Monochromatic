/**
 * `tomlGetRaw`: read the original source slice at a path. Splice mode only.
 *
 * @module
 */

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw';

import {
  TomlPathNotFoundError,
  TomlSpliceUnavailableError,
} from './errors.ts';
import { formatPath, } from './path.ts';
import { resolveByPath, } from './resolve.ts';
import type {
  TomlEditState,
  TomlPath,
} from './types.ts';

/**
 * Return the substring of the original source that spelled the value at
 * `path`. For round-trip-sensitive consumers that want to diff values
 * without canonical reformatting.
 *
 * Routes through `resolveByPath` directly and does NOT consult pending
 * deltas: a `tomlSet` on a path does not change what `tomlGetRaw` returns
 * for that path. The slice always reflects the parse-time bytes from
 * `edit.source`.
 *
 * @returns Computed string.
 *
 * @throws TomlSpliceUnavailableError when the state is in canonical mode
 *         (no source bytes to slice from).
 *
 * @throws TomlPathNotFoundError when the path was not present in the
 *         parse-time source. Paths newly created by `tomlSet` are not
 *         resolvable here until you `tomlStringify` and reparse.
 *
 * @example
 * ```ts
 * const raw = tomlGetRaw({ edit, path: ['version',], },);  // e.g. `'"1.0.0"'`
 * ```
 */
export function tomlGetRaw(
  {
    edit,
    path,
  }: {
    edit: TomlEditState;
    path: TomlPath
  },
): string {
  if (edit.mode === 'canonical')
    throw new TomlSpliceUnavailableError(
      `tomlGetRaw requires splice mode; current state is canonical`,
    );
  const result = resolveByPath({
    edit,
    path,
  },);
  if (result.kind === 'missing')
    throw new TomlPathNotFoundError(
      `Path ${formatPath({ path, },)} not found in parse-time source`,
    );
  if (result.kind === 'keyvalue')
    return edit.source.slice(
      result.node.value.range[0],
      result.node.value.range[1],
    );
  if (result.kind === 'value')
    return edit.source.slice(
      result.node.range[0],
      result.node.range[1],
    );
  if ((result.kind === 'table') || (result.kind === 'top-level'))
    return edit.source.slice(
      result.node.range[0],
      result.node.range[1],
    );
  const first = nonNullishOrThrow(result.nodes[0],);
  const last = nonNullishOrThrow(result.nodes.at(-1),);
  return edit.source.slice(
    first.range[0],
    last.range[1],
  );
}
