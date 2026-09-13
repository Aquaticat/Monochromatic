import { isDeepStrictEqual, } from 'node:util';
import { isJsonRecord, } from './json-guard.ts';
import {
  PreparationRootError,
  type PreparationRootFailure,
} from './preparation-root-error.ts';

//region Private semantic values from already byte-bound JSON

/**
 * Reads a parsed object without granting arrays record semantics.
 *
 * @param value - owned parsed JSON value
 *
 * @returns Read-only record for explicit relationship checks
 *
 * @throws PreparationRootError when object shape is absent
 *
 * @example
 * ```ts
 * const journal = preparationRootRecord(value);
 * ```
 */
export function preparationRootRecord(value: unknown,): Readonly<Record<string, unknown>> {
  if (Array.isArray(value,) || (!isJsonRecord(value,)))
    throw new PreparationRootError({ kind: 'reference-role', },);
  return value;
}

/**
 * Reads an explicit parsed collection rather than inventing an empty inventory.
 *
 * @param value - owned parsed JSON collection
 *
 * @returns Explicit entries for semantic validation
 *
 * @throws PreparationRootError when collection shape is absent
 *
 * @example
 * ```ts
 * const entries = preparationRootArray(journal.entries);
 * ```
 */
export function preparationRootArray(value: unknown,): readonly unknown[] {
  if (!Array.isArray(value,))
    throw new PreparationRootError({ kind: 'reference-role', },);
  return value as readonly unknown[];
}

/**
 * Reads nonblank text without normalizing frozen locators or notes.
 *
 * @param value - owned parsed JSON field
 *
 * @returns Unchanged required text
 *
 * @throws PreparationRootError when text is absent or blank
 *
 * @example
 * ```ts
 * const path = preparationRootString(note.path);
 * ```
 */
export function preparationRootString(value: unknown,): string {
  if (((typeof value) !== 'string') || (value.trim()
    .length
    === 0))
    throw new PreparationRootError({ kind: 'reference-role', },);
  return value;
}

/**
 * Compares independent current reconstruction with byte-bound historical claims without exposing either body.
 *
 * @param actual - current native reconstruction or claimed relationship being checked
 *
 * @param expected - independently bound comparison value
 *
 * @param kind - fixed affected-input diagnostic
 *
 * @param input - optional safe locator or identity, never either compared body
 *
 * @throws PreparationRootError when complete structural equality differs
 *
 * @example
 * ```ts
 * assertPreparationRootEqual({ actual: current.population, expected: pool.population, kind: 'population' });
 * ```
 */
export function assertPreparationRootEqual({
  actual,
  expected,
  kind,
  input,
}: {
  readonly actual: unknown;
  readonly expected: unknown;
  readonly kind: PreparationRootFailure;
  readonly input?: string;
},): void {
  if (!isDeepStrictEqual(
    actual,
    expected,
  ))
    throw new PreparationRootError({
      kind,
      ...input === undefined ? {} : { input, },
    },);
}

//endregion Private semantic values from already byte-bound JSON
