/**
 * Resolve a `TomlPath` against the AST.
 *
 * Pure function: reads `edit.program` only; never inspects deltas. Higher
 * layers (`effective-value.ts`) apply pending edits on top of the result.
 *
 * Resolver policy when multiple standard `[a.b]` tables would match the same
 * logical path: pick the **last physical instance** in document order.
 *
 * @module
 */

import type { AST, } from 'toml-eslint-parser';

import type {
  TomlEditState,
  TomlPath,
} from './types.ts';
import { walk, } from './walk.ts';

/**
 * The kind of node a path resolved to.
 */
/** Discriminated union of `resolveByPath` outcomes. */
export type ResolveResult =
  | {
    readonly kind: 'top-level';
    readonly node: AST.TOMLTopLevelTable;
  }
  | {
    readonly kind: 'keyvalue';
    readonly node: AST.TOMLKeyValue;
  }
  | {
    readonly kind: 'value';
    readonly node: AST.TOMLContentNode;
  }
  | {
    readonly kind: 'table';
    readonly node: AST.TOMLTable;
  }
  | {
    readonly kind: 'array-of-tables';
    readonly nodes: readonly AST.TOMLTable[];
  }
  | {
    readonly kind: 'missing';
    readonly deepest: AST.TOMLNode;
    readonly consumed: number;
  };

/**
 * Find the node at `path` within `edit.program`.
 *
 * @param edit - The state to search.
 *
 * @param path - The TOML path to resolve.
 *
 * @returns A `ResolveResult` describing what was found, or `missing` with
 *          the deepest existing ancestor and how many path segments were
 *          consumed before the miss.
 *
 * @example
 * ```ts
 * resolveByPath({ edit, path: ['fruits', 0, 'name'] },);
 * // -> { kind: 'keyvalue', node: TOMLKeyValue }
 * ```
 */
export function resolveByPath(
  {
    edit,
    path,
  }: {
    readonly edit: TomlEditState;
    readonly path: TomlPath;
  },
): ResolveResult {
  /** Root container so the walker can descend without re-indexing every call. */
  const [root,] = edit.program
    .body;
  if (path.length
    === 0) {
    return {
      kind: 'top-level',
      node: root,
    };
  }
  return walk({
    container: root,
    segments: path,
    consumed: 0,
  },);
}
