import type { UnknownRecord } from 'type-fest';

/* @__NO_SIDE_EFFECTS__ */ export const isArray: typeof Array.isArray = Array.isArray;

/**
 Tests if something is an Iterable and not an AsyncIterable.
 @param value the thing you want to check
 @returns boolean
 */
/* @__NO_SIDE_EFFECTS__ */ export function isIterable(
  value: any,
): value is Iterable<any> {
  return typeof value?.[Symbol.iterator] === 'function';
}

/* @__NO_SIDE_EFFECTS__ */ export function isAsyncIterable(
  value: any,
): value is AsyncIterable<any> {
  return typeof value?.[Symbol.asyncIterator] === 'function';
}

/* @__NO_SIDE_EFFECTS__ */ export function isMaybeAsyncIterable(
  value: any,
): value is Iterable<any> | AsyncIterable<any> {
  return typeof value?.[Symbol.iterator] === 'function'
    || typeof value?.[Symbol.asyncIterator] === 'function';
}

// Special handling in includesArrayLike for performance.
// TODO: Test if this expectedly returns false instead of unexpectedly throwing an error
//       when encountering a primitive value.
/* @__NO_SIDE_EFFECTS__ */ export function isMap(value: any): value is Map<any, any> {
  return Object.prototype.toString.call(value) === '[object Map]';
}

/* @__NO_SIDE_EFFECTS__ */ export function isWeakMap(
  value: any,
): value is WeakMap<any, any> {
  return Object.prototype.toString.call(value) === '[object WeakMap]';
}

// Special handling in includesArrayLike for performance.
/* @__NO_SIDE_EFFECTS__ */ export function isSet(value: any): value is Set<any> {
  return Object.prototype.toString.call(value) === '[object Set]';
}

/* @__NO_SIDE_EFFECTS__ */ export function isWeakSet(value: any): value is WeakSet<any> {
  return Object.prototype.toString.call(value) === '[object WeakSet]';
}

/* @__NO_SIDE_EFFECTS__ */ export function isObject(value: any): value is UnknownRecord {
  return Object.prototype.toString.call(value) === '[object Object]';
}

/* @__NO_SIDE_EFFECTS__ */ export function isAsyncGenerator(
  value: any,
): value is AsyncGenerator {
  return Object.prototype.toString.call(value) === '[object AsyncGenerator]';
}

/* @__NO_SIDE_EFFECTS__ */ /* @__NO_SIDE_EFFECTS__ */ export function isGenerator(
  value: any,
): value is Generator {
  return Object.prototype.toString.call(value) === '[object Generator]';
}

/* @__NO_SIDE_EFFECTS__ */ export function isEmptyArray(value: any): value is never[] {
  return isArray(value) && value.length === 0;
}

/* @__NO_SIDE_EFFECTS__ */ export function isArrayEmpty(
  value: readonly any[],
): value is never[] {
  return value.length === 0;
}

export function isArrayNonEmpty<const T,>(
  value: readonly T[],
): value is [T, ...T[]] {
  return Array.isArray(value) && value.length > 0;
}

/* @__NO_SIDE_EFFECTS__ */ export function isNonEmptyArray<const T_value,>(
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- unknown is required.
  value: T_value | unknown,
): value is [
  T_value extends (infer Element)[] ? Element : never,
  ...(T_value extends (infer Element)[] ? Element : never)[],
] {
  return isArray(value) && value.length > 0;
}

/* @__NO_SIDE_EFFECTS__ */ export function arrayIsNonEmpty<
  T_value extends readonly any[],
>(
  // eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents -- unknown is required.
  value: T_value | unknown,
): value is [
  T_value extends (infer Element)[] ? Element : never,
  ...(T_value extends (infer Element)[] ? Element : never)[],
] {
  return isArray(value) && value.length > 0;
}

export type IsTupleArray<T,> = T extends readonly [] ? true
  : T extends readonly [unknown, ...readonly unknown[]] ? true
  : false;

export type TupleArray<T,> = T extends readonly [unknown, ...readonly [unknown]] ? T
  : never;

export type ArrayNonFixedLengthOrNever<T,> = T extends readonly unknown[]
  ? number extends T['length'] ? T
  : never
  : never;

export type ArrayFixedLengthOrNever<T,> = T extends readonly unknown[]
  ? number extends T['length'] ? never : T
  : never;

// Impossible.
// export type ArrayNonFixedLength = ArrayFixedLengthOrNever<any>;

export type IsArrayFixedLength<T extends readonly unknown[],> = number extends T['length']
  ? false
  : true;

export function isArrayOfLength1<const T,>(
  value: readonly T[],
): value is readonly [T] {
  return Array.isArray(value) && value.length === 1;
}
