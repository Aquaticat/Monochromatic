/**
 * Readonly classification combination by diagnostic priority.
 *
 * @module
 */

import {
  DEEP_READONLY,
  normalizeWritablePaths,
  type ReadonlyClassification,
} from './readonly-classification-model.ts';

export { DEEP_READONLY, } from './readonly-classification-model.ts';

/**
 * Combines constituent classifications by diagnostic priority.
 *
 * Projected and opaque capability evidence withhold preference reporting,
 * so either outranks mutable data paths.
 * When every non-readonly branch is mutable,
 * every distinct writable path is retained without a presentation budget.
 *
 * @param classifications - Results from union,
 * intersection,
 * property,
 * element,
 * or index constituents.
 *
 * @returns highest-priority capability classification,
 * complete mutable evidence,
 * or sound readonly.
 *
 * @example
 * ```ts
 * combineClassifications([{ kind: 'deep-readonly' }]);
 * ```
 */
export function combineClassifications(
  classifications: readonly ReadonlyClassification[],
): ReadonlyClassification {
  /**
   * First projected capability preserving established diagnostic priority.
   */
  const projected = classifications.find(function projectedCapability(result,): boolean {
    return result.kind === 'projected-readonly-capability';
  },);
  if (projected !== undefined)
    return projected;
  /**
   * First unresolved capability preserving fail-closed preference behavior.
   */
  const opaque = classifications.find(function opaqueCapability(result,): boolean {
    return result.kind === 'opaque-capability';
  },);
  if (opaque !== undefined)
    return opaque;
  /**
   * Every writable path from otherwise compatible mutable branches.
   */
  const writablePaths = normalizeWritablePaths(
    classifications.flatMap(function mutablePaths(result,) {
      return result.kind === 'mutable' ? result.writablePaths : [];
    },),
  );
  return writablePaths.length === 0
    ? DEEP_READONLY
    : {
      kind: 'mutable',
      writablePaths,
    };
}
