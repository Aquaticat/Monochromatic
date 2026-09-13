import { type Logger, tagged, } from '@monochromatic-dev/module-logger/ts';
import { PreparationRootError, } from './preparation-root-error.ts';

//region Caller-loaded artifact descriptor reads

/**
 * Reads a controlled descriptor property without retaining an input-bearing accessor exception.
 * @param record - caller-supplied array or non-array record
 * @param key - fixed descriptor field or checked inventory index
 * @param kind - affected inventory or byte-content boundary
 * @param l - caller logger retaining frozen evidence scope
 * @returns Unknown property value for explicit type and identity checking
 * @throws PreparationRootError when the accessor throws
 * @example
 * ```ts
 * const content = preparationArtifactProperty({ record, key: 'content', kind: 'reference-content', l });
 * ```
 */
export function preparationArtifactProperty({ record, key, kind, l, }: {
  readonly record: object;
  readonly key: 'path' | 'content' | 'length' | number;
  readonly kind: 'reference-inventory' | 'reference-content';
  readonly l: Logger;
},): unknown {
  /** Accessor diagnostics disclose only the controlled operation and error category. */
  const pl = tagged({ tag: preparationArtifactProperty.name, l, },);
  try {
    return Reflect.get(record, key,) as unknown;
  }
  catch (error) {
    if (error instanceof Error)
      pl.warn('supporting artifact property threw an Error; input-bearing details were not retained',);
    else
      pl.warn('supporting artifact property threw a non-Error value; input-bearing details were not retained',);
    throw new PreparationRootError({ kind, },);
  }
}

//endregion Caller-loaded artifact descriptor reads
