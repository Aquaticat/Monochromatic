import type { MaybeAsyncIterable, } from '../iterable/iterable.basic.ts';
import {
  isIterable,
  isMaybeAsyncIterable,
} from '../iterable/iterable.is.ts';
import { anyToSchemaSync, } from './any.toSchemaSync.ts';
import { arrayFromAsyncBasic, } from './array.fromAsyncBasic.ts';
import { notEmptyOrThrow, } from './error.throw.ts';
import type { SchemaSync, } from './schema.basic.ts';
import {
  isMaybeAsyncSchema,
  isSchema,
  type MaybeAsyncSchema,
  maybeAsyncSchemaToAsyncSchema,
} from './schema.basic.ts';
import type { Logger, } from './string.log.ts';
import { consoleLogger, } from './string.log.ts';

/**
 * Extract properties from an object based on keys or validation schemas with transformation support.
 * Processes each extraction layer and collects all matching properties, allowing key transformations.
 *
 * Unlike pick which selects specific keys, extract applies transformations through schemas
 * and collects all properties that pass validation, potentially with renamed keys.
 *
 * @param params - Configuration object for extraction operation
 * @param params.obj - Input object to extract properties from
 * @param params.extracted - Keys or schemas to extract and transform
 * @param params.l - Logger for tracing operations during validation
 * @returns Object containing extracted and potentially transformed properties
 * @throws {TypeError} When extracted array is empty
 *
 * @example
 * ```ts
 * // Extract specific key
 * objectExtractSync({ obj: {a: 1, b: 2}, extracted: ['a'] });
 * // Returns: {a: 1}
 *
 * // Extract with schema transformation
 * const startsWithA = {
 *   parse: (key: string) => key.startsWith('a') ? key : throw new Error()
 * };
 * objectExtractSync({ obj: {a1: 1, a2: 2, b1: 3}, extracted: [startsWithA] });
 * // Returns: {a1: 1, a2: 2}
 *
 * // Transform keys during extraction
 * const addSuffix = {
 *   parse: (key: string) => key.startsWith('a') ? `${key}_new` : throw new Error()
 * };
 * objectExtractSync({ obj: {a1: 1, a2: 2}, extracted: [addSuffix] });
 * // Returns: {a1_new: 1, a2_new: 2}
 * ```
 */
export function objectExtractSync<
  const TObject extends Record<string, unknown>,
  const TExtracted extends SchemaSync<keyof TObject, string> | Iterable<
    keyof TObject
  >,
>(
  {
    obj,
    extracted,
    l = consoleLogger,
  }: {
    readonly obj: TObject;
    readonly extracted: TExtracted;
    readonly l?: Logger;
  },
): Record<string, unknown> {
  l.trace('objectExtractSync',);

  // Handle single schema validation
  if (isSchema(extracted,)) {
    l.trace('Using single schema validation',);
    const result: Record<string, unknown> = {};

    for (const key of Object.keys(obj,)) {
      try {
        const transformedKey = extracted.parse(key,);
        result[transformedKey] = obj[key];
      }
      catch {
        // Skip keys that don't match the schema
        l.trace(`Key "${key}" didn't match schema`,);
      }
    }

    return result;
  }

  // Handle iterable of keys/schemas
  if (isIterable(extracted,)) {
    const extractedArray = [...extracted,];

    // Throw if extracted array is empty
    notEmptyOrThrow(extractedArray,);

    const result: Record<string, unknown> = {};
    const processedKeys = new Set<string>();

    // Process each extraction layer
    for (const extractor of extractedArray) {
      if (isSchema(extractor,)) {
        // Apply schema to all unprocessed keys
        for (const key of Object.keys(obj,)) {
          if (processedKeys.has(key,))
            continue;

          try {
            const transformedKey = extractor.parse(key,);
            result[transformedKey] = obj[key];
            processedKeys.add(key,);
          }
          catch {
            // Key doesn't match this schema
            l.trace(`Key "${key}" didn't match schema`,);
          }
        }
      }
      else {
        // Direct key extraction
        const stringKey = String(extractor,);
        if (stringKey in obj && !processedKeys.has(stringKey,)) {
          result[stringKey] = obj[stringKey as keyof TObject];
          processedKeys.add(stringKey,);
        }
      }
    }

    return result;
  }

  throw new TypeError('extracted must be a schema or iterable of keys/schemas',);
}

/**
 * Async version of objectExtractSync that handles MaybeAsyncSchema and MaybeAsyncIterable.
 * Processes each extraction layer asynchronously and collects all matching properties.
 *
 * @param params - Configuration object for async extraction operation
 * @param params.obj - Input object to extract properties from
 * @param params.extracted - Keys or schemas to extract and transform
 * @param params.l - Logger for tracing operations during validation
 * @returns Promise resolving to object containing extracted and transformed properties
 * @throws {TypeError} When extracted array is empty
 *
 * @example
 * ```ts
 * // Async schema with validation
 * const asyncValidator = {
 *   parseAsync: async (key: string) => {
 *     await someAsyncValidation(key);
 *     return key.toUpperCase();
 *   }
 * };
 *
 * await objectExtract({
 *   obj: {a: 1, b: 2},
 *   extracted: [asyncValidator]
 * });
 * // Returns: {A: 1, B: 2}
 * ```
 */
export async function objectExtract<
  const TObject extends Record<string, unknown>,
  const TExtracted extends keyof TObject | MaybeAsyncSchema<keyof TObject, string>
    | MaybeAsyncIterable<keyof TObject | MaybeAsyncSchema<keyof TObject, string>>,
>(
  {
    obj,
    extracted,
    l = consoleLogger,
  }: {
    readonly obj: TObject;
    readonly extracted: TExtracted;
    readonly l?: Logger;
  },
): Promise<Record<string, unknown>> {
  l.trace('objectExtract',);

  // Handle single schema validation
  if (isMaybeAsyncSchema(extracted,)) {
    l.trace('Using single async schema validation',);
    const asyncSchema = maybeAsyncSchemaToAsyncSchema({ schema: extracted, },);
    const result: Record<string, unknown> = {};

    for (const key of Object.keys(obj,)) {
      try {
        const transformedKey = await asyncSchema.parseAsync(key,);
        result[transformedKey] = obj[key];
      }
      catch {
        // Skip keys that don't match the schema
        l.trace(`Key "${key}" didn't match schema`,);
      }
    }

    return result;
  }

  // Handle iterable of keys/schemas
  if (isMaybeAsyncIterable(extracted,)) {
    const extractedArray = await arrayFromAsyncBasic({ iterable: extracted, },);

    // Throw if extracted array is empty
    notEmptyOrThrow(extractedArray,);

    const result: Record<string, unknown> = {};
    const processedKeys = new Set<string>();

    // Process each extraction layer
    for (const extractor of extractedArray) {
      if (isMaybeAsyncSchema(extractor,)) {
        // Convert to async schema and apply to all unprocessed keys
        const asyncSchema = maybeAsyncSchemaToAsyncSchema({ schema: extractor, l, },);

        for (const key of Object.keys(obj,)) {
          if (processedKeys.has(key,))
            continue;

          try {
            const transformedKey = await asyncSchema.parseAsync(key,);
            result[transformedKey] = obj[key];
            processedKeys.add(key,);
          }
          catch {
            // Key doesn't match this schema
            l.trace(`Key "${key}" didn't match schema`,);
          }
        }
      }
      else {
        // Direct key extraction or convert to schema
        const stringKey = String(extractor,);
        const keySchema = maybeAsyncSchemaToAsyncSchema({
          schema: anyToSchemaSync({ input: stringKey, l, },),
          l,
        },);

        for (const key of Object.keys(obj,)) {
          if (processedKeys.has(key,))
            continue;

          try {
            const transformedKey = await keySchema.parseAsync(key,);
            result[transformedKey] = obj[key];
            processedKeys.add(key,);
          }
          catch {
            // Key doesn't match
            l.trace(`Key "${key}" didn't match ${stringKey}`,);
          }
        }
      }
    }

    return result;
  }

  throw new TypeError('extracted must be a schema or iterable of keys/schemas',);
}
