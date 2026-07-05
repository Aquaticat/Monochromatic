/**
 * Typed access to oxc ESTree child nodes.
 *
 * @example
 * ```ts
 * childNode({ node: binaryExpression, key: 'left' });
 * ```
 */

import { isEstreeNode, } from './walk.ts';
import type { EstreeNode, } from './types.ts';

/**
 * Reads one required child node property, throwing on shape mismatch.
 *
 * Operators only run on node types they matched, so a missing child means
 * the AST shape assumption broke; failing loudly beats emitting a mutant
 * with a garbage span.
 *
 * @param options - Parent node and child property key.
 *
 * @returns Child node.
 *
 * @throws Error when property is not an ESTree node.
 *
 * @example
 * ```ts
 * childNode({ node, key: 'left' });
 * ```
 */
export function childNode(options: {
  readonly node: EstreeNode;
  readonly key: string;
},): EstreeNode {
  /**
   * Raw child property value before shape validation.
   */
  const value = options.node[options.key];

  if (!isEstreeNode(value,))
    throw new Error(`expected ${options.node.type}.${options.key} to be a node`,);

  return value;
}

/**
 * Reads one optional child node property.
 *
 * @param options - Parent node and child property key.
 *
 * @returns Child node, or undefined when absent or not a node.
 *
 * @example
 * ```ts
 * maybeChildNode({ node: forStatement, key: 'test' });
 * ```
 */
export function maybeChildNode(options: {
  readonly node: EstreeNode;
  readonly key: string;
},): EstreeNode | undefined {
  /**
   * Raw child property value before shape validation.
   */
  const value = options.node[options.key];
  return isEstreeNode(value,) ? value : undefined;
}
