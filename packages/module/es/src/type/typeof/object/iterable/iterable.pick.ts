import { mapIterableAsync, } from '../../../../index.ts';
import {
  equal,
  equalAsync,
} from './any.equal.ts';
import type { MaybeAsyncIterable, } from './iterable.basic.ts';
import {
  isIterable,
  isMaybeAsyncIterable,
} from './iterable.is.ts';
import {
  isMaybeAsyncSchema,
  isSchema,
  type MaybeAsyncSchema,
  maybeAsyncSchemaToAsyncSchema,
  type SchemaSync,
} from './schema.basic.ts';
import {
  consoleLogger,
  type Logger,
} from './string.log.ts';

/**
 * Picks elements from an iterable that match provided shape or schema validation.
 *
 * When using a schema (object with parse method), validates entire iterable as single unit.
 * When using an iterable, validates only elements corresponding to positions in picked iterable.
 * Picked iterable cannot be longer than input iterable.
 *
 * @param params - Configuration object for picking operation
 * @param params.iterable - Input iterable to validate and extract from
 * @param params.picked - Expected shape (iterable) or schema (object with parse method)
 * @param params.l - Logger for tracing operations during validation
 * @returns Array containing elements from picked array length (for iterable) or schema validation result
 * @throws {RangeError} When picked iterable is longer than input iterable
 * @throws {Error} When elements don't match expected values or schema validation fails
 * @throws {TypeError} When picked is neither schema nor iterable
 *
 * @example
 * ```ts
 * // With schema validation - validates entire iterable as one unit
 * const numberArraySchema = { parse: (val) => val as number[] };
 * iterableSyncPickSync({ iterable: [1, 2], picked: numberArraySchema }); // returns [1, 2]
 *
 * // With exact value matching - validates corresponding elements only
 * iterableSyncPickSync({ iterable: [1, 2, 3], picked: [1, 2] }); // returns [1, 2] (validates first 2 elements)
 *
 * // With mixed array containing schemas - validates corresponding elements
 * const numberSchema = { parse: (val) => val as number };
 * iterableSyncPickSync({ iterable: [1, 2], picked: [numberSchema, numberSchema] }); // returns [1, 2]
 *
 * // Error: picked longer than iterable
 * iterableSyncPickSync({ iterable: [1], picked: [1, 2] }); // throws RangeError
 * ```
 */
export function iterableSyncPickSync<const MyIterable extends Iterable<unknown>,>({
  iterable,
  picked,
  l = consoleLogger,
}: {
  readonly iterable: MyIterable;
  readonly picked: Iterable<unknown> | SchemaSync;
  readonly l?: Logger;
},): unknown {
  l.trace('iterablePick',);
  /** Array representation of input iterable for validation and processing */
  const iterableArray = [...iterable,];
  // Handle schema validation (any object with parse method)
  if (isSchema(picked,)) {
    l.trace('Using schema validation',);
    return picked.parse(iterableArray,);
  }

  // Handle arrays that might contain schemas
  if (isIterable(picked,)) {
    /** Array representation of picked iterable for element-wise validation */
    const pickedArray: unknown[] = [...picked,];

    if (pickedArray.length > iterableArray.length)
      throw new RangeError('pickedArray longer than iterableArray',);

    // Validate each element against corresponding schema or exact value
    /** Array of validated elements after schema parsing or equality checking */
    const validatedArray = pickedArray.map(function validated(expected, index,) {
      /** Current element from input iterable at corresponding index */
      const actual = iterableArray[index];
      if (isSchema(expected,))
        return expected.parse(actual,);
      // For non-schema elements, check exact equality
      if (!equal(expected, actual,)) {
        throw new Error(
          `Element at index ${index} does not match expected value`,
        );
      }
      return actual;
    },);

    return validatedArray;
  }

  throw new TypeError('picked',);
}

/**
 * Picks elements from async iterable that match provided shape or schema validation.
 *
 * When using a schema (object with parse or parseAsync method), validates entire iterable as single unit.
 * When using async iterable, validates only elements corresponding to positions in picked iterable.
 * Picked iterable cannot be longer than input iterable.
 *
 * @param params - Configuration object for async picking operation
 * @param params.iterable - Input async iterable to validate and extract from
 * @param params.picked - Expected shape (async iterable) or schema (object with parse/parseAsync method)
 * @param params.l - Logger for tracing operations during validation
 * @returns Array containing elements from picked array length (for iterable) or schema validation result
 * @throws {RangeError} When picked iterable is longer than input iterable
 * @throws {Error} When elements don't match expected values or schema validation fails
 * @throws {TypeError} When picked is neither schema nor async iterable
 *
 * @example
 * ```ts
 * // With schema validation - validates entire iterable as one unit
 * const schema = { parse: (val) => val as number[] };
 * await iterablePickAsync({ iterable: asyncIterable([1, 2]), picked: schema }); // returns [1, 2]
 *
 * // With exact value matching - validates corresponding elements only
 * await iterablePickAsync({ iterable: asyncIterable([1, 2, 3]), picked: [1, 2] }); // returns [1, 2]
 *
 * // With mixed array containing schemas - validates corresponding elements
 * const numberSchema = { parse: (val) => val as number };
 * await iterablePickAsync({ iterable: asyncIterable([1, 2]), picked: [numberSchema, numberSchema] }); // returns [1, 2]
 *
 * // Error: picked longer than iterable
 * await iterablePickAsync({ iterable: asyncIterable([1]), picked: [1, 2] }); // throws RangeError
 * ```
 */
export async function iterablePick<
  const MyIterable extends MaybeAsyncIterable,
>(
  {
    iterable,
    picked,
    l = consoleLogger,
  }: {
    readonly iterable: MyIterable;
    readonly picked: MaybeAsyncIterable | MaybeAsyncSchema;
    readonly l?: Logger;
  },
): Promise<unknown> {
  l.trace('iterablePickAsync',);

  /** Array representation of async input iterable for validation and processing */
  const iterableArray = await Array.fromAsync(iterable,);

  // Handle schema validation (any object with parse method)
  if (isMaybeAsyncSchema(picked,)) {
    l.trace('Using schema validation',);
    return await maybeAsyncSchemaToAsyncSchema(picked,).parseAsync(
      iterableArray,
    );
  }

  // Handle arrays that might contain schemas
  if (isMaybeAsyncIterable(picked,)) {
    /** Array representation of async picked iterable for element-wise validation */
    const pickedArray: unknown[] = await Array.fromAsync(picked,);

    if (pickedArray.length > iterableArray.length)
      throw new RangeError('pickedArray longer than iterableArray',);

    // Validate each element against corresponding schema or exact value
    /** Array of validated elements after async schema parsing or equality checking */
    const validated = await mapIterableAsync(
      async (expected: unknown, index: number,) => {
        /** Current element from async input iterable at corresponding index */
        const actual = iterableArray[index];
        if (isSchema(expected,))
          return await maybeAsyncSchemaToAsyncSchema(expected,).parseAsync(actual,);
        // For non-schema elements, check exact equality
        if (!(await equalAsync(expected, actual,))) {
          throw new Error(
            `Element at index ${index} does not match expected value`,
          );
        }
        return actual;
      },
      pickedArray,
    );

    return validated;
  }

  throw new TypeError('picked',);
}
