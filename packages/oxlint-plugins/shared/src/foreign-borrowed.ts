/**
 * Foreign ownership marker for externally dictated mutable handles.
 *
 * Marker does not claim immutability. Semantic effect verification still rejects
 * direct mutation and unresolved calls through borrowed handle.
 *
 * @module
 */

/**
 * Project-owned marker key preserving transparent runtime representation.
 */
declare const FOREIGN_BORROWED_MARKER: unique symbol;

/**
 * Marks mutable handle whose ownership and parameter type are dictated by foreign API.
 *
 * Type remains assignable to and from original foreign contract. Readonly parameter
 * rule recognizes alias as capability boundary rather than structural readonly claim.
 *
 * @typeParam Value - Foreign handle type imposed by upstream API.
 *
 * @example
 * ```ts
 * function inspectNode(node: ForeignBorrowed<ESTree.Node>): void {
 *   void node.type;
 * }
 * ```
 */
export type ForeignBorrowed<Value> = Value & {
  readonly [FOREIGN_BORROWED_MARKER]?: true;
};
