/**
 * Library surface of the oxc-based container-native mutation tester.
 *
 * @example
 * ```ts
 * import { enumerateMutants } from '@monochromatic-dev/cli-mutation-test/ts';
 * ```
 */

export {
  enumerateMutants,
  type EnumerationResult,
  type IgnoredMutant,
} from './engine/enumerate.ts';
export {
  lineStarts,
  positionAt,
} from './engine/lines.ts';
export { mutantId, } from './engine/mutant-id.ts';
export { findOperatorToken, } from './engine/operator-token.ts';
export {
  allOperators,
  type OperatorFn,
} from './engine/operators/index.ts';
export { spliceReplacement, } from './engine/splice.ts';
export {
  matchingSuppressions,
  suppressionRules,
  type OxcComment,
  type SuppressionRule,
} from './engine/suppression.ts';
export type {
  EstreeNode,
  Mutant,
  MutantStatus,
  OperatorName,
  Replacement,
} from './engine/types.ts';
export {
  isEstreeNode,
  walk,
} from './engine/walk.ts';
