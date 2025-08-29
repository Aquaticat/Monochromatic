/**
 * Pick utility type implementation that creates a new type by selecting specific properties from an existing type.
 *
 * Constructs a type by picking the set of properties Keys (string literal or union of string literals) from Type.
 * Handles single keys, iterables of keys, and schema-based validation for flexible property selection.
 *
 * @param object - Input object to pick properties from
 * @param keys - Keys to pick from the object or schema for validation
 * @returns Object containing only the picked properties
 * @throws {Error} When a key doesn't exist in the object
 * @throws {TypeError} When keys parameter is invalid type
 *
 * @example
 * Basic property picking:
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
 * const basic = $(todo, ["title", "completed"]);
 * console.log(basic); // { title: "Clean room", completed: false }
 * ```
 *
 * @example
 * Single key picking:
 * ```ts
 * const user = { id: 1, name: 'Alice', email: 'alice@example.com' };
 * const nameOnly = $(user, ['name']);
 * console.log(nameOnly); // { name: 'Alice' }
 * ```
 *
 * @example
 * Working with complex nested objects:
 * ```ts
 * const config = {
 *   database: { host: 'localhost', port: 5432, ssl: true },
 *   api: { endpoint: '/api/v1', timeout: 5000 },
 *   debug: true,
 *   version: '1.0.0'
 * };
 * 
 * const essentials = $(config, ['database', 'api']);
 * console.log(essentials); // { database: {...}, api: {...} }
 * ```
 *
 * @example
 * Error handling for missing keys:
 * ```ts
 * const obj = { a: 1, b: 2 };
 * try {
 *   const invalid = $(obj, ['a', 'c']); // 'c' doesn't exist
 * } catch (error) {
 *   console.log(error.message); // 'Key "c" does not exist in object'
 * }
 * ```
 *
 * @example
 * Dynamic key picking:
 * ```ts
 * const data = { x: 10, y: 20, z: 30, w: 40 };
 * const coordinates = ['x', 'y', 'z'];
 * const picked = $(data, coordinates);
 * console.log(picked); // { x: 10, y: 20, z: 30 }
 * ```
 *
 * @example
 * Working with Set for unique keys:
 * ```ts
 * const obj = { a: 1, b: 2, c: 3, d: 4 };
 * const uniqueKeys = new Set(['a', 'b', 'a']); // Duplicates removed
 * const result = $(obj, uniqueKeys);
 * console.log(result); // { a: 1, b: 2 }
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function $<
  const TObject extends Record<string, unknown>,
  const TKeys extends keyof TObject | Iterable<keyof TObject>,
>(
  object: TObject,
  keys: TKeys,
): TKeys extends Iterable<infer U>
  ? Pick<TObject, Extract<keyof TObject, U>>
  : Pick<TObject, Extract<keyof TObject, TKeys>> {
  
  // Handle iterable of keys (including arrays)
  if (typeof keys === 'object' && keys !== null && Symbol.iterator in keys) {
    const keysArray = [...(keys as Iterable<keyof TObject>)];
    const result: Record<string, unknown> = {};

    for (const key of keysArray) {
      // Check if key exists in object
      if (!(key in object)) {
        throw new Error(`Key "${String(key)}" does not exist in object`);
      }

      // Convert key to string and add to result
      const stringKey = String(key);
      result[stringKey] = object[key as keyof TObject];
    }

    return result as any;
  }

  throw new TypeError('keys must be an iterable of keys');
}