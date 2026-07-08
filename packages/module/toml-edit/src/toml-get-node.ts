/**
 * {@link tomlGetNode}: read the parse-time AST node at a path.
 *
 * @module
 */

import type { AST, } from 'toml-eslint-parser';

import { TomlPathNotFoundError, } from './errors.ts';
import { formatPath, } from './path.ts';
import {
  locateValueNode,
  NOT_LOCATED,
} from './resolve-document.ts';
import type {
  TomlEditState,
  TomlPath,
} from './types.ts';

/**
 * Return the parse-time AST node at `path`.
 *
 * Power-user escape hatch: it returns the retained AST node of a clean
 * (unmutated) node. A path created or edited by a mutation has no parse-time
 * node, so {@link TomlPathNotFoundError} is thrown; {@link tomlGetValue} returns
 * the current value instead.
 *
 * @returns Computed result (`AST.TOMLContentNode | AST.TOMLTable | readonly AST.TOMLTable[]`).
 *
 * @throws {@link TomlPathNotFoundError} when `path` has no clean parse-time node.
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
): AST.TOMLContentNode | AST.TOMLTable | readonly AST.TOMLTable[] {
  /**
   * Structural location so a clean node's retained AST node can surface.
   */
  const located = locateValueNode({
    blocks: edit.blocks,
    path,
  },);
  if (located === NOT_LOCATED)
    throw notFound({ path, },);
  if (located.kind
    === 'value') {
    if (located.value
      .origin
      .kind
      === 'clean')
      return located.value
        .origin
        .astNode as AST.TOMLContentNode;
    throw notFound({ path, },);
  }
  if (located.kind
    === 'table') {
    if (located.table
      .headerOrigin
      .kind
      === 'clean')
      return located.table
        .headerOrigin
        .astNode as AST.TOMLTable;
    throw notFound({ path, },);
  }
  return located.tables
    .map(function each(t,) {
    if (t.headerOrigin
      .kind
      !== 'clean')
      throw notFound({ path, },);
    return t.headerOrigin
      .astNode as AST.TOMLTable;
  },);
}

/**
 * Build the not-found error for `path`.
 *
 * @returns Error to throw.
 */
function notFound({ path, }: { readonly path: TomlPath; },): TomlPathNotFoundError {
  return new TomlPathNotFoundError(
    `Path ${formatPath({ path, },)} has no parse-time AST node`,
  );
}
