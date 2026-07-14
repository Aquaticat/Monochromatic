/**
 * Readonly classification singleton and constituent combination.
 *
 * @module
 */

import type { ReadonlyClassification, } from './readonly-classifier.ts';

/**
 * Honest readonly singleton result.
 */
export const HONEST_READONLY: ReadonlyClassification = { kind: 'honest-readonly', };

/**
 * Combines constituent classifications by diagnostic priority.
 *
 * @param classifications - Results from union or intersection constituents.
 *
 * @returns highest-priority non-readonly classification or honest readonly.
 *
 * @example
 * ```ts
 * combineClassifications([{ kind: 'honest-readonly' }]);
 * ```
 */
export function combineClassifications(
  classifications: readonly ReadonlyClassification[],
): ReadonlyClassification {
  return classifications.find(function dishonest(result,): boolean {
    return result.kind === 'dishonest-readonly';
  },)
    ?? classifications.find(function opaque(result,): boolean {
      return result.kind === 'opaque-capability';
    },)
    ?? classifications.find(function mutable(result,): boolean {
      return result.kind === 'mutable';
    },)
    ?? HONEST_READONLY;
}
