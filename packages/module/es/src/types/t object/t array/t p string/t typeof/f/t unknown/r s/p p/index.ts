import stringify from 'safe-stringify';
import type { $ as TypeOf, } from '../../../../t/index.ts';

const noFurtherTypeOf = ['undefined', 'symbol',] as const;

/**
 * Enhanced typeof function that provides detailed type information as discriminated union.
 * Returns complex type information including sign information for numbers/bignums,
 * truthiness for booleans, async/generator flags for functions, and detailed
 * prototype information for objects.
 *
 * @param value - Value to determine detailed type for
 * @returns Discriminated union with detailed type information
 * @example
 * ```ts
 * $(42n); // ['bigint', { sign: 'positive' }]
 * $(true); // ['boolean', { true: true }]
 * $(() => {}); // ['function', { async: false, generator: false }]
 * $([1, 2, 3]); // ['object', { prototype: 'Array' }]
 * $(new Date()); // ['object', { prototype: 'Date' }]
 * ```
 */
export function $(value: unknown,): TypeOf {
  const typeOf = typeof value;

  if (noFurtherTypeOf.includes(typeOf,))
    return typeOf as (typeof noFurtherTypeOf)[number];

  if (typeOf === 'bigint') {
    const myValue = value as bigint;
    if (myValue === 0n)
      return [typeOf, { sign: 0, },];
    if (myValue > 0n)
      return [typeOf, { sign: 'positive', },];
    if (myValue < 0n)
      return [typeOf, { sign: 'negative', },];
    throw new Error(`bigint ${stringify(myValue,)} not equal, >, < 0n`,);
  }

  if (typeOf === 'boolean') {
    const myValue = value as boolean;
    return [typeOf, { true: myValue, },];
  }

  const prototypeString = Object.prototype.toString.call(value,);

  if (typeOf === 'function') {
    if (prototypeString === '[object Function]')
      return [typeOf, { async: false, generator: false, },];
    if (prototypeString === '[object AsyncFunction]')
      return [typeOf, { async: true, generator: false, },];
    if (prototypeString === '[object GeneratorFunction]')
      return [typeOf, { async: false, generator: true, },];
    if (prototypeString === '[object AsyncGeneratorFunction]')
      return [typeOf, { async: true, generator: true, },];
  }

  if (typeOf === 'number') {
    const myValue = value as number;
    if (Number.isNaN(myValue,))
      throw new Error(`number ${stringify(myValue,)} is NaN`,);

    const sign = myValue === 0 ? 0 : myValue > 0 ? 'positive' : 'negative';
    const float = !Number.isInteger(myValue,);
    return [typeOf, { sign, float, },];
  }

  if (typeOf === 'string') {
    const myValue = value as string;
    if (myValue.length === 0)
      return [typeOf, { empty: true, },];

    // Check if string contains any characters
    const hasChars = myValue.length > 0;
    if (!hasChars)
      return [typeOf, { empty: true, },];

    // For now, return basic string info - char analysis could be added later
    return [typeOf, { empty: [false, { char: false, },], },];
  }

  if (typeOf === 'object') {
    if (value === null)
      throw new Error('null should be handled by noFurtherTypeOf',);

    // Handle special object types based on prototype string
    if (prototypeString === '[object Array]')
      return [typeOf, { prototype: 'Array', },];
    if (prototypeString === '[object Date]')
      return [typeOf, { prototype: 'Date', },];
    if (prototypeString === '[object Map]')
      return [typeOf, { prototype: 'Map', },];
    if (prototypeString === '[object Set]')
      return [typeOf, { prototype: 'Set', },];
    if (prototypeString === '[object Promise]')
      return [typeOf, { prototype: 'Promise', },];
    if (prototypeString === '[object RegExp]') {
      const regexp = value as RegExp;
      return [typeOf, { prototype: ['RegExp', { global: regexp.global, },], },];
    }

    // Handle iterable objects
    if (typeof (value as any)[Symbol.iterator] === 'function')
      return [typeOf, { prototype: ['Object', { iterable: true, },], },];

    // Default plain object
    return [typeOf, { prototype: ['Object', { iterable: false, },], },];
  }

  throw new TypeError(
    `Unhandled value with typeof "${typeOf}" and prototype "${prototypeString}"`,
  );
}
