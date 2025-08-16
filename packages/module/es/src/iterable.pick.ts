import {
  equal,
  equalAsync,
  isIterable,
} from '@monochromatic-dev/module-es';
import {
  consoleLogger,
  type Logger,
  logtapeGetLogger,
} from '@monochromatic-dev/module-es';
import type { Promisable, } from 'type-fest';

/**
 * Generic schema interface that any validation library can implement
 */
type Schema = {
  readonly parse: <const Input = unknown, const Output = unknown,>(
    value: Input,
  ) => Output;
};

type AsyncSchema = {
  readonly parseAsync: <const Input = unknown, const Output = unknown,>(
    value: Input,
  ) => Promisable<Output>;
};

type MaybeAsyncSchema = {
  readonly parse: <const Input = unknown, const Output = unknown,>(
    value: Input,
  ) => Promisable<Output>;
} | AsyncSchema;

/**
 * Type guard to check if value has a parse method (generic schema)
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

function isMaybeAsyncSchema(value: unknown,): value is Schema {
  if (value === null)
    return false;
  if (typeof value !== 'object')
    return false;
  if (!(value as { parse: unknown; }).parse)
    return false;
  return typeof ((value as { parse: unknown; }).parse) === 'function';
}

function isAsyncSchema(value: unknown,): value is AsyncSchema {
  if (value === null)
    return false;
  if (typeof value !== 'object')
    return false;
  if (!(value as { parseAsync: unknown; }).parseAsync)
    return false;
  return typeof ((value as { parseAsync: unknown; }).parseAsync) === 'function';
}

function asyncSchema(schema: MaybeAsyncSchema,): AsyncSchema {
  if (isAsyncSchema(schema,))
    return schema;
  return { ...schema, parseAsync: schema.parse, };
}

/**
 * Picks elements from an iterable that match the provided shape or schema.
 *
 * When using schemas (objects with parse method), validates each element.
 * When using exact shapes, performs deep equality comparison.
 * When using arrays with schemas, takes first N elements and validates them.
 *
 * @param params - Parameters object
 * @param params.iterable - to validate against the shape
 * @param params.picked - Expected shape, schema, or function returning shape/schema
 * @param params.logger - for logging operations
 * @returns The picked shape or validated result
 * @throws When iterable doesn't match the expected shape or schema validation fails
 *
 * @example
 * ```ts
 * // With exact shape matching
 * iterablePick({ iterable: [1, 2, 3], picked: [1, 2, 3] }); // returns [1, 2, 3]
 *
 * // With schema validation (any object with parse method)
 * const numberArraySchema = { parse: (val) => val as number[] };
 * iterablePick({ iterable: [1, 2], picked: numberArraySchema }); // returns [1, 2]
 *
 * // With mixed array containing schemas
 * const numberSchema = { parse: (val) => val as number };
 * iterablePick({ iterable: [1, 2], picked: [numberSchema] }); // returns [1]
 * ```
 */
export function iterablePick<const MyIterable extends Iterable<unknown>,>({
  iterable,
  picked,
  l = consoleLogger,
}: {
  readonly iterable: MyIterable;
  readonly picked: Partial<MyIterable> | Schema;
  readonly l?: Logger;
},): any {
  l.trace('iterablePick',);
  const iterableArray = [...iterable,];
  // Handle schema validation (any object with parse method)
  if (isSchema(picked,)) {
    l.trace('Using schema validation',);
    return picked.parse(iterableArray,);
  }

  // Handle arrays that might contain schemas
  if (isIterable(picked,)) {
    const pickedArray: unknown[] = [...picked,];

    if (pickedArray.length > iterableArray.length)
      throw new RangeError('pickedArray longer than iterableArray',);

    // Validate each element against corresponding schema or exact value
    const validated = iterableArray.map((element, elementIndex,) => {
      const expectedAtIndex = pickedArray[elementIndex];
      if (isSchema(expectedAtIndex,))
        return expectedAtIndex.parse(element,);
      // For non-schema elements, check exact equality
      if (!equal(element, expectedAtIndex,)) {
        throw new Error(
          `Element at index ${elementIndex} does not match expected value`,
        );
      }
      return element;
    },);

    return validated;
  }

  throw new TypeError('picked',);
}

/**
 * Async version of iterablePick - picks elements from an async iterable that match the provided shape or schema.
 *
 * When using schemas (objects with parse method), validates each element.
 * When using exact shapes, performs deep equality comparison.
 * When using arrays with schemas, takes first N elements and validates them.
 *
 * @param params - Parameters object
 * @param params.iterable - to validate against the shape
 * @param params.picked - Expected shape, schema, or function returning shape/schema
 * @param params.logger - for logging operations
 * @returns Promise resolving to the picked shape or validated result
 * @throws When iterable doesn't match the expected shape or schema validation fails
 *
 * @example
 * ```ts
 * // With exact shape matching
 * await iterablePickAsync({ iterable: asyncIterable([1, 2]), picked: [1, 2] }); // returns [1, 2]
 *
 * // With schema validation
 * const schema = { parse: (val) => val as number[] };
 * await iterablePickAsync({ iterable: asyncIterable([1, 2]), picked: schema }); // returns [1, 2]
 * ```
 */
async function iterablePickAsync({
  iterable,
  picked,
  logger = consoleLogger,
}: {
  readonly iterable: AsyncIterable<unknown>;
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- Function type needed alongside unknown
  readonly picked: unknown | (() => unknown | Promise<unknown>);
  readonly logger?: Logger;
},): Promise<any> {
  const loggerInstance = logtapeGetLogger(['m', 'iterablePickAsync',],);
  loggerInstance.debug('Starting async iterable pick operation',);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call -- Function may return unknown
  const resolvedPicked = typeof picked === 'function' ? await picked() : picked;

  // Handle schema validation (any object with parse method)
  if (isSchema(resolvedPicked,)) {
    loggerInstance.debug('Using schema validation',);
    const iterableArray = [];
    for await (const item of iterable)
      iterableArray.push(item,);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Schema parse method returns unknown
    return resolvedPicked.parse(iterableArray,);
  }

  // Handle arrays that might contain schemas
  if (Array.isArray(resolvedPicked,)) {
    const iterableArray = [];
    for await (const item of iterable)
      iterableArray.push(item,);

    // Check if array contains any schemas
    // eslint-disable-next-line unicorn/no-array-callback-reference -- Using callback reference for clarity
    const hasSchemas = resolvedPicked.some(item => isSchema(item,));

    if (hasSchemas) {
      loggerInstance.debug('Using mixed array validation with schemas',);
      // Take first N elements where N is length of picked array
      const sliced = iterableArray.slice(0, resolvedPicked.length,);

      // Validate each element against corresponding schema or exact value
      const validated = sliced.map((element, elementIndex,) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- Array access may return any
        const expectedAtIndex = resolvedPicked[elementIndex];
        if (isSchema(expectedAtIndex,)) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Schema parse method returns unknown
          return expectedAtIndex.parse(element,);
        }
        // For non-schema elements, check exact equality
        if (!equal(element, expectedAtIndex,)) {
          throw new Error(
            `Element at index ${elementIndex} does not match expected value`,
          );
        }
        return element;
      },);

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Mixed validation returns unknown
      return validated;
    }
  }

  // Handle exact shape matching (original behavior)
  loggerInstance.debug('Using exact shape matching',);

  const iterableArray = [];
  for await (const item of iterable)
    iterableArray.push(item,);

  // Validate that iterable matches the exact picked shape
  if (!(await equalAsync(iterableArray, resolvedPicked,)))
    throw new Error('Async iterable does not match the expected shape',);

  // eslint-disable-next-line @typescript-eslint/no-unsafe-return -- Return type depends on picked parameter
  return resolvedPicked;
}
