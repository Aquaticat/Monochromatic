import type { SyncSchema } from './schema.basic.ts';
import type { MaybeAsyncIterable } from './iterable.basic.ts';
import { isIterable, isMaybeAsyncIterable } from './iterable.is.ts';
import { 
  isSchema, 
  isMaybeAsyncSchema,
  maybeAsyncSchemaToAsyncSchema,
  type MaybeAsyncSchema 
} from './schema.basic.ts';
import { equal, equalAsync } from './any.equal.ts';
import type { Logger } from './string.log.ts';
import { consoleLogger } from './string.log.ts';

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
  const TKeys extends keyof TObject | SyncSchema | Iterable<keyof TObject | SyncSchema> | MaybeAsyncIterable<keyof TObject | SyncSchema>
>({
  object,
  keys,
  l = consoleLogger,
}: {
  readonly object: TObject;
  readonly keys: TKeys;
  readonly l?: Logger;
}): unknown {
  l.trace('objectPickSync');
  
  // Handle schema validation
  if (isSchema(keys)) {
    l.trace('Using schema validation');
    return keys.parse(object);
  }
  
  // Handle iterable of keys (including arrays)
  if (isIterable(keys)) {
    const keysArray = [...keys];
    const result: Record<string, unknown> = {};
    
    for (const key of keysArray) {
      // Handle schema within iterable
      if (isSchema(key)) {
        // This would be for validating the entire object with a schema
        return key.parse(object);
      }
      
      // Check if key exists in object
      if (!(key in object)) {
        throw new Error(`Key "${String(key)}" does not exist in object`);
      }
      
      result[String(key)] = object[key as keyof TObject];
    }
    
    return result;
  }
  
  // Handle async iterable of keys
  if (isMaybeAsyncIterable(keys)) {
    throw new Error('Sync function cannot handle async iterables');
  }
  
  throw new TypeError('keys must be a schema, iterable of keys, or a single key');
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
  const TKeys extends keyof TObject | MaybeAsyncSchema | Iterable<keyof TObject | SyncSchema> | MaybeAsyncIterable<keyof TObject | SyncSchema>
>({
  object,
  keys,
  l = consoleLogger,
}: {
  readonly object: TObject;
  readonly keys: TKeys;
  readonly l?: Logger;
}): Promise<unknown> {
  l.trace('objectPick');
  
  // Handle schema validation (sync or async)
  if (isMaybeAsyncSchema(keys)) {
    l.trace('Using schema validation');
    return await maybeAsyncSchemaToAsyncSchema(keys).parseAsync(object);
  }
  
  // Handle iterable of keys (including arrays)
  if (isIterable(keys)) {
    const keysArray = [...keys];
    const result: Record<string, unknown> = {};
    
    for (const key of keysArray) {
      // Handle schema within iterable
      if (isSchema(key)) {
        // This would be for validating the entire object with a schema
        return key.parse(object);
      }
      
      // Check if key exists in object
      if (!(key in object)) {
        throw new Error(`Key "${String(key)}" does not exist in object`);
      }
      
      result[String(key)] = object[key as keyof TObject];
    }
    
    return result;
  }
  
  // Handle async iterable of keys
  if (isMaybeAsyncIterable(keys)) {
    const keysArray = await Array.fromAsync(keys);
    const result: Record<string, unknown> = {};
    
    for (const key of keysArray) {
      // Handle schema within iterable
      if (isSchema(key)) {
        // This would be for validating the entire object with a schema
        return await maybeAsyncSchemaToAsyncSchema(key).parseAsync(object);
      }
      
      // Check if key exists in object
      if (!(key in object)) {
        throw new Error(`Key "${String(key)}" does not exist in object`);
      }
      
      result[String(key)] = object[key as keyof TObject];
    }
    
    return result;
  }
  
  throw new TypeError('keys must be a schema, iterable of keys, or a single key');
}