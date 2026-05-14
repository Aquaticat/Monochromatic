/**
 * Shared `TomlEditState` builders used by `tomlSet` and `path-create`.
 *
 * These helpers preserve the immutability invariant: every mutating
 * function returns a fresh state while sharing the AST and source by
 * reference.
 *
 * @module
 */

import type { AST, } from 'toml-eslint-parser';

import type {
  Edit,
  Insertion,
  TomlEditState,
} from './types.ts';

/**
 * Return a fresh state with an additional `edits` entry on `node`.
 *
 * @example
 * ```ts
 * withEditOn({ edit, node, delta: { kind: 'replace-value', ... }, },);
 * ```
 */
export function withEditOn(
  {
    edit,
    node,
    delta,
  }: {
    edit: TomlEditState;
    node: AST.TOMLNode;
    delta: Edit;
  },
): TomlEditState {
  const entries: [AST.TOMLNode, Edit,][] = [...edit.edits, [node, delta,],];
  return { ...edit, edits: new Map(entries,), };
}

/**
 * Return a fresh state with an additional pending `insertion`.
 *
 * @example
 * ```ts
 * withInsertion({ edit, insertion, },);
 * ```
 */
export function withInsertion(
  {
    edit,
    insertion,
  }: {
    edit: TomlEditState;
    insertion: Insertion;
  },
): TomlEditState {
  return { ...edit, insertions: [...edit.insertions, insertion,], };
}
