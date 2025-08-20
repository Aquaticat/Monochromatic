import { anyToSchemaSync, } from './any.toSchemaSync.ts';
import { arrayFromAsyncBasic, } from './array.fromAsyncBasic.ts';
import type { MaybeAsyncIterable, } from './iterable.basic.ts';
import {
  isIterable,
  isMaybeAsyncIterable,
} from './iterable.is.ts';
import type {
  SchemaAsync,
  SchemaSync,
} from './schema.basic.ts';
import {
  isMaybeAsyncSchema,
  isSchema,
  type MaybeAsyncSchema,
  maybeAsyncSchemaToAsyncSchema,
} from './schema.basic.ts';
import type { Logger, } from './string.log.ts';
import { consoleLogger, } from './string.log.ts';

/**
 * Pick utility type implementation that creates a new type by selecting specific properties from an existing type.
 *
 * Constructs a type by picking the set of properties Keys (string literal or union of string literals) from Type.
 *
 * @param params - Configuration object for picking operation
 * @param params.object - Input object to pick properties from
 * @param params.keys - Keys to pick from the object or schema for validation
 * @param params.l - Logger for tracing operations during validation
 * @returns Object containing only the picked properties
 * @throws {Error} When a key doesn't exist in the object
 *
 * @example
 * ```ts
 * interface Todo {
 *   title: string;
 *   description: string;
 *   completed: boolean;
 * }
 *
 * const todo = {
 *   title: "Clean room",
 *   description: "Clean the room thoroughly",
 *   completed: false
 * };
 *
 * objectPickSync({ object: todo, keys: ["title", "completed"] });
 * // Returns: { title: "Clean room", completed: false }
 * ```
 */
export function objectPickSync<
  const TObject extends Record<string, unknown>,
  const TKeys extends keyof TObject | SchemaSync | Iterable<keyof TObject | SchemaSync>,
>({
  object,
  keys,
  l = consoleLogger,
}: {
  readonly object: TObject;
  readonly keys: TKeys;
  readonly l?: Logger;
},):
  | Pick<TObject, Extract<keyof TObject, TKeys extends Iterable<infer U> ? U : TKeys>>
  | (TKeys extends SchemaSync<infer _, infer Output> ? Output : never)
{
  l.trace('objectPickSync',);

  // Handle schema validation
  if (isSchema(keys,)) {
    l.trace('Using schema validation',);
    return keys.parse(object,) as any;
  }

  // Handle iterable of keys (including arrays)
  if (isIterable(keys,)) {
    const keysArray = [...keys,];
    const result: Record<string, unknown> = {};

    for (const key of keysArray) {
      // Handle schema within iterable
      if (isSchema(key,)) {
        // This would be for validating the entire object with a schema
        return key.parse(object,) as any;
      }

      // Check if key exists in object
      if (!(key in object))
        throw new Error(`Key "${String(key,)}" does not exist in object`,);

      // Convert key to string and add to result
      const stringKey = String(key,);
      result[stringKey] = object[key as keyof TObject];
    }

    return result as any;
  }

  throw new TypeError('keys must be a schema, iterable of keys, or a single key',);
}

/**
 * Async version of objectPickSync that handles MaybeAsyncSchema and MaybeAsyncIterable
 *
 * @param params - Configuration object for async picking operation
 * @param params.object - Input object to pick properties from
 * @param params.keys - Keys to pick from the object or schema for validation
 * @param params.l - Logger for tracing operations during validation
 * @returns Object containing only the picked properties
 * @throws {Error} When a key doesn't exist in the object
 */
export async function objectPick<
  const TObject extends Record<string, unknown>,
  const TKeys extends keyof TObject | MaybeAsyncSchema<TObject> | MaybeAsyncIterable<keyof TObject | MaybeAsyncSchema<keyof TObject, string>>,
>({
  object,
  keys,
  l = consoleLogger,
}: {
  readonly object: TObject;
  readonly keys: TKeys;
  readonly l?: Logger;
},): Promise<
  TKeys extends MaybeAsyncSchema<TObject, infer Output> 
    ? Output 
    : TKeys extends MaybeAsyncIterable<infer U> 
      ? Pick<TObject, Extract<keyof TObject, U extends MaybeAsyncSchema<keyof TObject, infer SchemaOutput> ? SchemaOutput : U>>
      : Pick<TObject, Extract<keyof TObject, TKeys>>
> {
  l.trace('objectPick',);

  // Handle schema validation (sync or async)
  if (isMaybeAsyncSchema(keys,)) {
    l.trace('Using schema validation',);
    return await maybeAsyncSchemaToAsyncSchema({ schema: keys, },).parseAsync(
      object,
    ) as TKeys extends MaybeAsyncSchema<TObject, infer Output> ? Output
      : never;
  }

  // Handle iterable of keys (including arrays)
  if (isMaybeAsyncIterable(keys,)) {
    const keysArray = await arrayFromAsyncBasic({ iterable: keys, },);
    const keysAsyncSchemaArray = keysArray.map(
      function toAsyncSchema(
        key: keyof TObject | MaybeAsyncSchema<keyof TObject>,
      ): SchemaAsync<keyof TObject, string> {
        if (isMaybeAsyncSchema(key,)) {
          return maybeAsyncSchemaToAsyncSchema({ schema: key, l, },) as SchemaAsync<
            keyof TObject,
            string
          >;
        }
        return maybeAsyncSchemaToAsyncSchema({
          schema: anyToSchemaSync({ input: key, l, },),
          l,
        },) as SchemaAsync<keyof TObject, string>;
      },
    );
    const objectKeysSet = new Set(Object.keys(object,),);
    const result: Partial<TObject> = {};

    for (const keyAsyncSchema of keysAsyncSchemaArray) {
      let objectKeysSetHasDeletionsForThisKey = false;
      for (const objectKey of objectKeysSet) {
        try {
          const parsed = await keyAsyncSchema.parseAsync(objectKey,);

          Object.assign(result, { [parsed]: object[objectKey as keyof TObject], },);
          objectKeysSetHasDeletionsForThisKey = true;
          objectKeysSet.delete(objectKey,);
        }
        catch (error: unknown) {
          l.info(`${JSON.stringify(error,)}`,);
        }
      }
      if (!objectKeysSetHasDeletionsForThisKey)
        throw new TypeError('unpickable',);
    }
    return result as any;
  }

  throw new TypeError('keys must be a schema, iterable of keys|schemas',);
}
