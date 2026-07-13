/**
 * Project-owned marker key preserving transparent runtime representation.
 */
declare const FOREIGN_BORROWED_MARKER: unique symbol;

/**
 * Marks mutable handle whose ownership and parameter type are dictated by foreign interface.
 *
 * Type remains assignable to and from original foreign contract.
 * Readonly parameter analysis recognizes exact alias as an ownership marker,
 * not an immutability claim.
 *
 * @typeParam Value - Foreign handle type imposed by upstream interface.
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
