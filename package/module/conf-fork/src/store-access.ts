/**
 Key access over the in-memory store object.
 
 Wraps upstream `conf`'s `dot-prop` dependency so dot-notation semantics
 (escapes,
 bracket segments,
 prototype guards) stay identical while the
 store's non-dot mode keeps upstream's literal-key behavior.
 
 @module
 */

import {
  deleteProperty,
  getProperty,
  hasProperty,
  setProperty,
} from 'dot-prop';

//region Constants

/**
 Creates a store object with a null prototype,
 so no key can ever reach `Object.prototype`.
 
 @returns Empty object whose prototype is `null`.
 
 @example
 ```ts
 const store = createPlainObject();
 Object.getPrototypeOf(store); // => null
 ```
 */
export function createPlainObject(): Record<string, unknown> {
  return Object.create(null,) as Record<string, unknown>;
}

/**
 Key names the non-dot write path refuses to assign,
 mirroring upstream `conf`'s prototype-pollution guard.
 
 @example
 ```ts
 NON_DOT_FORBIDDEN_KEYS.has('__proto__'); // => true
 ```
 */
const NON_DOT_FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
  '__proto__',
  'constructor',
  'prototype',
],);

//endregion Constants

//region Reads

/**
 Reads one key from the store,
 in dot-notation or literal-key mode.
 
 @param store - Store object to read from.
 @param key - Key path as the caller wrote it.
 @param defaultValue - Value returned when the key is absent.
 @param accessPropertiesByDotNotation - Whether dots address nested
 properties.
 
 @returns Stored value or `defaultValue`.
 
 @example
 ```ts
 getStoreValue({
   store: { nested: { theme: 'dark', }, },
   key: 'nested.theme',
   defaultValue: 'light',
   accessPropertiesByDotNotation: true,
 }); // => 'dark'
 ```
 */
export function getStoreValue({
  store,
  key,
  defaultValue,
  accessPropertiesByDotNotation,
}: {
  readonly store: Record<string, unknown>;
  readonly key: string;
  readonly defaultValue?: unknown;
  readonly accessPropertiesByDotNotation: boolean;
},): unknown {
  if (accessPropertiesByDotNotation)
    return getProperty(store, key, defaultValue,);
  return key in store ? store[key] : defaultValue;
}

/**
 Reports whether one key exists in the store,
 in dot-notation or literal-key mode.
 
 @param store - Store object to probe.
 @param key - Key path as the caller wrote it.
 @param accessPropertiesByDotNotation - Whether dots address nested
 properties.
 
 @returns `true` when the key resolves to a present value.
 
 @example
 ```ts
 hasStoreValue({
   store: { theme: 'dark', },
   key: 'theme',
   accessPropertiesByDotNotation: true,
 }); // => true
 ```
 */
export function hasStoreValue({
  store,
  key,
  accessPropertiesByDotNotation,
}: {
  readonly store: Record<string, unknown>;
  readonly key: string;
  readonly accessPropertiesByDotNotation: boolean;
},): boolean {
  if (accessPropertiesByDotNotation)
    return hasProperty(store, key,);
  return key in store;
}

//endregion Reads

//region Writes

/**
 Assigns one key in the store,
 in dot-notation or literal-key mode.
 
 The literal-key mode silently refuses `__proto__`,
 `constructor`,
 and `prototype` keys exactly as upstream `conf` does.
 
 @param store - Store object to mutate.
 @param key - Key path as the caller wrote it.
 @param value - JSON-representable value to place.
 @param accessPropertiesByDotNotation - Whether dots address nested
 properties.
 
 @example
 ```ts
 setStoreValue({
   store,
   key: 'nested.theme',
   value: 'dark',
   accessPropertiesByDotNotation: true,
 });
 ```
 */
export function setStoreValue({
  store,
  key,
  value,
  accessPropertiesByDotNotation,
}: {
  readonly store: Record<string, unknown>;
  readonly key: string;
  readonly value: unknown;
  readonly accessPropertiesByDotNotation: boolean;
},): void {
  if (accessPropertiesByDotNotation) {
    setProperty(store, key, value,);
    return;
  }
  if (NON_DOT_FORBIDDEN_KEYS.has(key,))
    return;
  store[key] = value;
}

/**
 Removes one key from the store,
 in dot-notation or literal-key mode.
 
 @param store - Store object to mutate.
 @param key - Key path as the caller wrote it.
 @param accessPropertiesByDotNotation - Whether dots address nested
 properties.
 
 @example
 ```ts
 deleteStoreValue({
   store,
   key: 'nested.theme',
   accessPropertiesByDotNotation: true,
 });
 ```
 */
export function deleteStoreValue({
  store,
  key,
  accessPropertiesByDotNotation,
}: {
  readonly store: Record<string, unknown>;
  readonly key: string;
  readonly accessPropertiesByDotNotation: boolean;
},): void {
  if (accessPropertiesByDotNotation) {
    deleteProperty(store, key,);
    return;
  }
  delete store[key];
}

//endregion Writes
