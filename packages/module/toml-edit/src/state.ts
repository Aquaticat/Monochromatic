/**
 * Shared {@link TomlEditState} builders used by {@link tomlSet} and `path-create`.
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
 * @returns A fresh {@link TomlEditState} reflecting the change.
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
    readonly edit: TomlEditState;
    readonly node: AST.TOMLNode;
    readonly delta: Edit;
  },
): TomlEditState {
  /**
   * Flattened tuples so `Map` can rebuild without mutating the previous instance.
   */
  const entries: [
    AST.TOMLNode,
    Edit,
  ][] = [
    ...edit.edits,
    [
      node,
      delta,
    ],
  ];
  return {
    ...edit,
    edits: new Map(entries,),
  };
}

/**
 * Return a fresh state with an additional pending `insertion`.
 *
 * @returns A fresh {@link TomlEditState} reflecting the change.
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
    readonly edit: TomlEditState;
    readonly insertion: Insertion;
  },
): TomlEditState {
  return {
    ...edit,
    insertions: [
      ...edit.insertions,
      insertion,
    ],
  };
}
