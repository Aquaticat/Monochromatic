/**
 * Readonly classification singleton and constituent combination.
 *
 * @module
 */

import type { ReadonlyClassification, } from './readonly-classifier.ts';

/**
 * Deep-readonly singleton result.
 */
export const DEEP_READONLY: ReadonlyClassification = { kind: 'deep-readonly', };

/**
 * Combines constituent classifications by diagnostic priority.
 *
 * @param classifications - Results from union or intersection constituents.
 *
 * @returns highest-priority non-readonly classification or sound readonly.
 *
 * @example
 * ```ts
 * combineClassifications([{ kind: 'deep-readonly' }]);
 * ```
 */
export function combineClassifications(
  classifications: readonly ReadonlyClassification[],
): ReadonlyClassification {
  return classifications.find(function projectedCapability(result,): boolean {
    return result.kind === 'projected-readonly-capability';
  },)
    ?? classifications.find(function opaque(result,): boolean {
      return result.kind === 'opaque-capability';
    },)
    ?? classifications.find(function mutable(result,): boolean {
      return result.kind === 'mutable';
    },)
    ?? DEEP_READONLY;
}
