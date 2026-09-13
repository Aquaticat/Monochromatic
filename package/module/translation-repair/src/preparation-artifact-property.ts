import {
  type Logger,
  tagged,
} from '@monochromatic-dev/module-logger/ts';
import { PreparationRootError, } from './preparation-root-error.ts';

//region Caller-loaded artifact descriptor reads

/**
 * Reports an observation failure without retaining caller-controlled exception details.
 *
 * @param error - observed exception used only for its category
 *
 * @param kind - fixed input boundary
 *
 * @param l - caller logger retaining operation provenance
 *
 * @throws PreparationRootError for every observation failure
 *
 * @example
 * ```ts
 * preparationArtifactObservationFailure({ error, kind: 'reference-inventory', l });
 * ```
 */
function preparationArtifactObservationFailure({ error, kind, l, }: {
  readonly error: unknown;
  readonly kind: 'reference-inventory' | 'reference-content';
  readonly l: Logger;
},): never {
  /** Controlled diagnostics never inspect caller-supplied error properties. */
  const pl = tagged({ tag: preparationArtifactObservationFailure.name, l, },);
  if (Error.isError(error,))
    pl.warn('supporting artifact observation threw an Error; input-bearing details were not retained',);
  else
    pl.warn('supporting artifact observation threw a non-Error value; input-bearing details were not retained',);
  throw new PreparationRootError({ kind, },);
}

/**
 * Observes array shape while converting revoked-proxy failures to fixed inventory diagnostics.
 *
 * @param value - caller-loaded inventory or descriptor
 *
 * @param l - caller logger retaining inventory scope
 *
 * @returns Whether native array shape was observed
 *
 * @throws PreparationRootError when array shape cannot be observed
 *
 * @example
 * ```ts
 * const array = preparationArtifactIsArray({ value, l });
 * ```
 */
export function preparationArtifactIsArray({ value, l, }: {
  readonly value: unknown;
  readonly l: Logger;
},): boolean {
  /** Shape observation does not claim descriptor ownership. */
  const pl = tagged({ tag: preparationArtifactIsArray.name, l, },);
  try {
    return Array.isArray(value,);
  }
  catch (error) {
    return preparationArtifactObservationFailure({ error, kind: 'reference-inventory', l: pl, },);
  }
}

/**
 * Reads a controlled descriptor property without retaining an input-bearing accessor exception.
 *
 * @param record - caller-supplied array or non-array record
 *
 * @param key - fixed descriptor field or checked inventory index
 *
 * @param kind - affected inventory or byte-content boundary
 *
 * @param l - caller logger retaining frozen evidence scope
 *
 * @returns Unknown property value for explicit type and identity checking
 *
 * @throws PreparationRootError when the accessor throws
 *
 * @example
 * ```ts
 * const content = preparationArtifactProperty({ record, key: 'content', kind: 'reference-content', l });
 * ```
 */
export function preparationArtifactProperty({
  record,
  key,
  kind,
  l,
}: {
  readonly record: object;
  readonly key: 'path' | 'content' | 'length' | number;
  readonly kind: 'reference-inventory' | 'reference-content';
  readonly l: Logger;
},): unknown {
  /**
   * Accessor diagnostics disclose only the controlled operation and error category.
   */
  const pl = tagged({
    tag: preparationArtifactProperty.name,
    l,
  },);
  try {
    return Reflect.get(
      record,
      key,
    ) as unknown;
  }
  catch (error) {
    return preparationArtifactObservationFailure({ error, kind, l: pl, },);
  }
}

//endregion Caller-loaded artifact descriptor reads
