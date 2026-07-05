/**
 * Compatibility exports for analyzer visitors.
 *
 * @module
 */

export {
  visitArithmetic,
  visitTest,
} from './visit-expression.ts';
export { visitNode, } from './visit-node.ts';
export { visitRedirectsItem, } from './visit-node-remaining.ts';
export {
  visitParts,
  visitWord,
} from './visit-word.ts';
