import { isJsonRecord, } from './json-guard.ts';
import {
  PreparationRootError,
  type PreparationRootFailure,
} from './preparation-root-error.ts';

//region Typed frozen-selection values

/**
 * Canonical SHA-256 text extent.
 */
const SHA256_LENGTH = 64;
/**
 * Allowed lowercase digest characters, checked by a bounded linear scan.
 */
const HEX_CHARACTERS = '0123456789abcdef';

/**
 * Reads a plain parsed object without treating arrays as records.
 *
 * @param value - parsed selection field
 *
 * @returns Record for explicit field-level checks
 *
 * @throws PreparationRootError when object shape is absent
 *
 * @example
 * ```ts
 * const sampler = selectionRecord(value);
 * ```
 */
export function selectionRecord(value: unknown,): Record<string, unknown> {
  if (Array.isArray(value,) || (!isJsonRecord(value,)))
    throw new PreparationRootError({ kind: 'selection-shape', },);
  return value;
}

/**
 * Reads nonblank text while retaining its original bytes.
 *
 * @param value - parsed selection field
 *
 * @returns Unchanged nonblank text
 *
 * @throws PreparationRootError when text is absent
 *
 * @example
 * ```ts
 * const nodeVersion = selectionString(value);
 * ```
 */
export function selectionString(value: unknown,): string {
  if (((typeof value) !== 'string') || (value.trim()
    .length
    === 0))
    throw new PreparationRootError({ kind: 'selection-shape', },);
  return value;
}

/**
 * Reads a collection without accepting a missing field as an empty inventory.
 *
 * @param value - parsed selection field
 *
 * @returns Parsed entries for semantic validation
 *
 * @throws PreparationRootError when collection shape is absent
 *
 * @example
 * ```ts
 * const entries = selectionArray(value);
 * ```
 */
export function selectionArray(value: unknown,): readonly unknown[] {
  if (!Array.isArray(value,))
    throw new PreparationRootError({ kind: 'selection-shape', },);
  return value;
}

/**
 * Checks a finite canonical SHA-256 digest without unbounded string iteration.
 *
 * @param value - parsed digest field
 *
 * @param kind - fixed affected-input diagnostic
 *
 * @returns Canonical digest text
 *
 * @throws PreparationRootError when digest grammar differs
 *
 * @example
 * ```ts
 * const digest = selectionDigest({ value, kind: 'selection-references' });
 * ```
 */
export function selectionDigest({
  value,
  kind = 'selection-shape',
}: {
  readonly value: unknown;
  readonly kind?: PreparationRootFailure
},): string {
  if (((typeof value) !== 'string') || (value.length !== SHA256_LENGTH))
    throw new PreparationRootError({ kind, },);
  for (let index = 0; index < value.length; index += 1) {
    if (!HEX_CHARACTERS.includes(value.charAt(index,),))
      throw new PreparationRootError({ kind, },);
  }
  return value;
}

//endregion Typed frozen-selection values
