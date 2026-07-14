import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

/** Mutable child shape imposed by parser-like API. */
type Child = {
  value: string;
};

/** Mutable tree shape imposed by parser-like API. */
type Tree = {
  child: Child;
};

/**
 * Reads child reached by both foreign and owned call paths.
 *
 * @param child - Child whose ownership is not guaranteed foreign.
 *
 * @returns child value.
 */
function readChild(child: Child,): string {
  return child.value;
}

/**
 * Reads child from explicit foreign boundary.
 *
 * @param tree - Root foreign tree.
 *
 * @returns child value.
 */
export function readForeignTree(tree: ForeignBorrowed<Tree>,): string {
  return readChild(tree.child,);
}

/**
 * Reads child from ordinary caller-owned input.
 *
 * @param tree - Root caller-owned tree.
 *
 * @returns child value.
 */
export function readOwnedTree(tree: Tree,): string {
  return readChild(tree.child,);
}
