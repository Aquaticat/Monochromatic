/**
 * `tomlGetNode`: read the parse-time AST node at a path.
 *
 * @module
 */

import type { AST, } from 'toml-eslint-parser';

import { TomlPathNotFoundError, } from './errors.ts';
import { formatPath, } from './path.ts';
import { resolveByPath, } from './resolve.ts';
import type {
  TomlEditState,
  TomlPath,
} from './types.ts';

/**
 * Return the parse-time AST `TOMLContentNode` (or wrapped value) at `path`.
 *
 * Power-user escape hatch. This routes through `resolveByPath` directly and
 * does NOT consult pending deltas: a `tomlSet` on a path does not change
 * what `tomlGetNode` returns for that path (the AST is immutable, so the
 * node's `range` and content remain accurate for `edit.source`). Use
 * `tomlGetValue` when you need a value that reflects pending edits.
 *
 * For paths created by `tomlSet` that did not exist at parse time, there
 * is no AST node; `TomlPathNotFoundError` is thrown. `tomlStringify` and
 * reparse to materialise an AST node for such paths.
 *
 * @returns Computed result (`AST.TOMLContentNode | AST.TOMLTable | AST.TOMLTopLevelTable | readonly AST.TOMLTable[]`).
 *
 * @throws TomlPathNotFoundError when `path` was not present in the parse-time
 *         source.
 *
 * @example
 * ```ts
 * const node = tomlGetNode({ edit, path: ['tools', 'bun',], },);
 * ```
 */
export function tomlGetNode(
  {
    edit,
    path,
  }: {
    readonly edit: TomlEditState;
    readonly path: TomlPath;
  },
): AST.TOMLContentNode | AST.TOMLTable | AST.TOMLTopLevelTable
  | readonly AST.TOMLTable[]
{
  /**
   * Direct AST lookup so callers can branch on the resolution kind.
   */
  const result = resolveByPath({
    edit,
    path,
  },);
  if (result.kind
    === 'missing') {
    throw new TomlPathNotFoundError(
      `Path ${formatPath({ path, },)} not found in parse-time AST`,
    );
  }
  if (result.kind
    === 'keyvalue')
    return result.node
      .value;
  if ((result.kind
    === 'value')
    || (result.kind
      === 'table')
    || (result.kind
      === 'top-level'))
  {
    return result.node;
  }
  return result.nodes;
}
