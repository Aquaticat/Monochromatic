import type { Promisable, } from 'type-fest';
import { equal, equalAsync, } from './boolean.equal.ts';
import { mapIterableAsync, } from './index.ts';
import {
  isIterable,
  isMaybeAsyncIterable,
} from './iterable.is.ts';
import type { MaybeAsyncIterable, } from './iterable.type.maybe.ts';
import {
  consoleLogger,
  type Logger,
} from './string.log.ts';

/**
 * Generic schema interface that validation libraries can implement for parsing values.
 * Provides synchronous or asynchronous parsing capability through a unified parse method.
 *
 * @example
 * ```ts
 * const numberSchema: Schema = {
 *   parse: (value) => {
 *     if (typeof value === 'number') return value;
 *     throw new Error('Expected number');
 *   }
 * };
 * ```
 */
type Schema = {
  readonly parse: <const Input = unknown, const Output = unknown,>(
    value: Input,
  ) => Promisable<Output>;
};

/**
 * Schema interface for synchronous validation only.
 * Restricts parsing to synchronous operations by returning non-Promise values.
 *
 * @example
 * ```ts
 * const syncSchema: SyncSchema = {
 *   parse: (value) => {
 *     if (typeof value === 'string') return value;
 *     throw new Error('Expected string');
 *   }
 * };
 * ```
 */
type SyncSchema = {
  readonly parse: (value: unknown,) => unknown;
};

/**
 * Schema interface for asynchronous validation.
 * Provides parseAsync method for handling Promise-based validation logic.
 *
 * @example
 * ```ts
 * const asyncSchema: AsyncSchema = {
 *   parseAsync: async (value) => {
 *     const result = await validateAsync(value);
 *     return result;
 *   }
 * };
 * ```
 */
type AsyncSchema = {
  readonly parseAsync: (value: unknown,) => Promisable<unknown>;
};

/**
 * Union type combining synchronous and asynchronous schema interfaces.
 * Allows validation functions to accept either sync or async schema objects.
 *
 * @example
 * ```ts
 * function validateWith(schema: MaybeAsyncSchema, value: unknown) {
 *   if ('parseAsync' in schema) {
 *     return schema.parseAsync(value);
 *   }
 *   return schema.parse(value);
 * }
 * ```
 */
type MaybeAsyncSchema = {
  readonly parse: (value: unknown,) => Promisable<unknown>;
} | AsyncSchema;

/**
 * Type guard determining if value implements the generic Schema interface.
 * Checks for presence and function type of parse method to ensure schema compatibility.
 *
 * @param value - Value to test for Schema interface compliance
 * @returns True if value has callable parse method, false otherwise
 *
 * @example
 * ```ts
 * const maybeSchema = { parse: (x) => x };
 * if (isSchema(maybeSchema)) {
 *   // TypeScript knows maybeSchema has parse method
 *   const result = maybeSchema.parse(input);
 * }
 * ```
 */
function isSchema(value: unknown,): value is Schema {
  if (value === null)
    return false;
  if (typeof value !== 'object')
    return false;
  if (!(value as { parse: unknown; }).parse)
    return false;
  return typeof ((value as { parse: unknown; }).parse) === 'function';
}

/**
 * Type guard determining if value implements the AsyncSchema interface.
 * Validates presence and function type of parseAsync method for async schema detection.
 *
 * @param value - Value to test for AsyncSchema interface compliance
 * @returns True if value has callable parseAsync method, false otherwise
 *
 * @example
 * ```ts
 * const asyncValidator = { parseAsync: async (x) => x };
 * if (isAsyncSchema(asyncValidator)) {
 *   // TypeScript knows asyncValidator has parseAsync method
 *   const result = await asyncValidator.parseAsync(input);
 * }
 * ```
 */
function isAsyncSchema(value: unknown,): value is AsyncSchema {
  if (value === null)
    return false;
  if (typeof value !== 'object')
    return false;
  if (!(value as { parse: unknown; }).parse)
    return false;
  return typeof ((value as { parseAsync: unknown; }).parseAsync) === 'function';
}

/**
 * Type guard determining if value implements either Schema or AsyncSchema interface.
 * Provides unified detection for both synchronous and asynchronous validation schemas.
 *
 * @param value - Value to test for schema interface compliance
 * @returns True if value implements any schema interface, false otherwise
 *
 * @example
 * ```ts
 * function processSchema(schema: unknown) {
 *   if (isMaybeAsyncSchema(schema)) {
 *     // Can safely use schema for validation
 *     return convertToAsync(schema);
 *   }
 *   throw new Error('Invalid schema');
 * }
 * ```
 */
function isMaybeAsyncSchema(value: unknown,): value is MaybeAsyncSchema {
  return isSchema(value,) || isAsyncSchema(value,);
}

/**
 * Converts any schema type to AsyncSchema interface for unified async processing.
 * Wraps synchronous parse method with parseAsync when needed for consistency.
 *
 * @param schema - Schema to convert to async interface
 * @returns AsyncSchema with parseAsync method available
 *
 * @example
 * ```ts
 * const syncSchema = { parse: (x) => x };
 * const asyncVersion = maybeAsyncSchemaToAsyncSchema(syncSchema);
 * // asyncVersion.parseAsync is now available
 * const result = await asyncVersion.parseAsync(value);
 * ```
 */
function maybeAsyncSchemaToAsyncSchema(schema: MaybeAsyncSchema,): AsyncSchema {
  if (isAsyncSchema(schema,))
    return schema;
  return { ...schema, parseAsync: schema.parse, };
}

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
 * iterablePick({ iterable: [1, 2], picked: numberArraySchema }); // returns [1, 2]
 *
 * // With exact value matching - validates corresponding elements only
 * iterablePick({ iterable: [1, 2, 3], picked: [1, 2] }); // returns [1, 2] (validates first 2 elements)
 *
 * // With mixed array containing schemas - validates corresponding elements
 * const numberSchema = { parse: (val) => val as number };
 * iterablePick({ iterable: [1, 2], picked: [numberSchema, numberSchema] }); // returns [1, 2]
 *
 * // Error: picked longer than iterable
 * iterablePick({ iterable: [1], picked: [1, 2] }); // throws RangeError
 * ```
 */
export function iterablePick<const MyIterable extends Iterable<unknown>,>({
  iterable,
  picked,
  l = consoleLogger,
}: {
  readonly iterable: MyIterable;
  readonly picked: Iterable<unknown> | SyncSchema;
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
export async function iterablePickAsync<
  const MyIterable extends MaybeAsyncIterable<unknown>,
>(
  {
    iterable,
    picked,
    l = consoleLogger,
  }: {
    readonly iterable: MyIterable;
    readonly picked: MaybeAsyncIterable<unknown> | MaybeAsyncSchema;
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
