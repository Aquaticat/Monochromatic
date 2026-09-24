/**
 Structural comparison and snapshots for merge inputs and outputs.

 `shapeMismatch` is stricter than a generic deep-equal on purpose: it
 compares prototypes, own-key order, array holes, Set and Map iteration
 order, and leaf identity (`Object.is`), because each is observable merge
 behaviour. `snapshot` copies the containers of a tree while keeping leaf
 identity, so an input can be checked for mutation after a merge and a
 fast-check value can be mutated without corrupting later shrink attempts.

 Both walk trees only; callers never pass cyclic values.

 @module
 */

import { kindOf, } from './model.ts';

/**
 Describe the key at one step of a mismatch path.

 @param key - Record key, Map key, or index.

 @returns Readable path segment.

 @example
 ```ts
 segment('a'); // '.a'
 ```
 */
function segment(key: unknown,): string {
  if ((typeof key) === 'symbol')
    return `[${String(key,)}]`;
  if ((typeof key) === 'number')
    return `[${String(key,)}]`;
  return `.${String(key,)}`;
}

/**
 Compare two ordered key lists by `Object.is`.

 @param left - Keys of the actual value.
 @param right - Keys of the expected value.

 @returns Whether both lists hold the same keys in the same order.

 @example
 ```ts
 sameKeys(['a',], ['a',]); // true
 ```
 */
function sameKeys(left: readonly unknown[], right: readonly unknown[],): boolean {
  return (left.length === right.length) && left.every((key, index,) => Object.is(key, right[index],));
}

/**
 Find the first structural difference between two trees.

 @param actual - Value produced by the implementation under test.
 @param expected - Value predicted by the model or captured by `snapshot`.
 @param path - Location of this pair, for the report.

 @returns Human-readable mismatch location and reason, or `undefined` when
   the trees match.

 @example
 ```ts
 shapeMismatch({ actual: [1,], expected: [1,], }); // undefined
 ```
 */
export function shapeMismatch(
  { actual, expected, path = '$', }: {
    readonly actual: unknown;
    readonly expected: unknown;
    readonly path?: string;
  },
): string | undefined {
  if (Object.is(actual, expected,))
    return undefined;
  /**
   Bucket of the actual value; the expected one must match it.
   */
  const kind = kindOf(actual,);
  if ((kind === 'other') || (kind !== kindOf(expected,)))
    return `${path}: expected ${String(expected,)}, got ${String(actual,)}`;
  if (Object.getPrototypeOf(actual,) !== Object.getPrototypeOf(expected,))
    return `${path}: prototype differs`;
  if ((actual instanceof Set) && (expected instanceof Set)) {
    return sameKeys([...actual,], [...expected,],)
      ? undefined
      : `${path}: Set elements or order differ`;
  }
  if ((actual instanceof Map) && (expected instanceof Map)) {
    if (!sameKeys([...actual.keys(),], [...expected.keys(),],))
      return `${path}: Map keys or order differ`;
    return [...actual.keys(),]
      .map((key,) => shapeMismatch({ actual: actual.get(key,), expected: expected.get(key,), path: `${path}${segment(key,)}`, },))
      .find((mismatch,) => mismatch !== undefined);
  }
  /**
   Own keys including holes' absence and non-enumerable properties.
   */
  const actualKeys = Reflect.ownKeys(actual as object,);
  if (!sameKeys(actualKeys, Reflect.ownKeys(expected as object,),))
    return `${path}: own keys differ (${actualKeys.map(String,).join(', ',)})`;
  return actualKeys
    .map((key,) =>
      shapeMismatch({
        actual: Reflect.get(actual as object, key,),
        expected: Reflect.get(expected as object, key,),
        path: `${path}${segment(key,)}`,
      },)
    )
    .find((mismatch,) => mismatch !== undefined);
}

/**
 Copy every container of a tree, keeping leaves and property descriptors.

 Records keep their prototype, enumerability, and accessors; arrays keep
 holes; Sets keep elements by identity; Maps keep keys by identity and
 snapshot their values.

 @param value - Tree to copy.

 @returns Structurally identical tree sharing no container with `value`.

 @example
 ```ts
 const copy = snapshot({ a: [1,], });
 ```
 */
export function snapshot<const T,>(value: T,): T {
  /**
   Bucket deciding how to copy this node.
   */
  const kind = kindOf(value,);
  if (kind === 'other')
    return value;
  if (value instanceof Set)
    return new Set(value,) as T;
  if (value instanceof Map)
    return new Map([...value,].map(([key, entry,],) => [key, snapshot(entry,),]),) as T;
  /**
   Fresh container with the same prototype as the original.
   */
  const copy: object = Array.isArray(value,) ? [] : Object.create(Object.getPrototypeOf(value,),);
  for (const key of Reflect.ownKeys(value as object,)) {
    /**
     Original descriptor; data values are copied recursively.
     */
    const descriptor = Reflect.getOwnPropertyDescriptor(value as object, key,);
    if (descriptor === undefined)
      throw new Error(`snapshot: own key ${String(key,)} vanished during the copy`,);
    Reflect.defineProperty(
      copy,
      key,
      ('value' in descriptor) ? { ...descriptor, value: snapshot(descriptor.value,), } : descriptor,
    );
  }
  if (Object.isFrozen(value,))
    Object.freeze(copy,);
  return copy as T;
}
