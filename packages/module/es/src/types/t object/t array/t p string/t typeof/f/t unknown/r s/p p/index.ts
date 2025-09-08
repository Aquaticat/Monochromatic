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
    const sign = myValue === 0n ? 0 : myValue > 0n ? 'positive' : 'negative';
    return [typeOf, { sign, },];
  }

  if (typeOf === 'boolean') {
    const myValue = value as boolean;
    return [typeOf, { true: myValue, },];
  }

  if (typeOf === 'number') {
    const myValue = value as number;
    if (Number.isNaN(myValue,))
      return [typeOf, { NaN: true, },];

    const sign = myValue === 0 ? 0 : myValue > 0 ? 'positive' : 'negative';
    const float = !Number.isInteger(myValue,);
    return [typeOf, { NaN: [false, { sign, float, },], },];
  }

  if (typeOf === 'string') {
    const myValue = value as string;
    if (myValue.length === 0)
      return [typeOf, { empty: true, },];

    return [typeOf, {
      empty: [false, { char: myValue
          .length !== 1
        ? false
        : [
          true,
          /\p{Upper}/v.test(myValue,)
            ? 'uppercaseLetter'
            : /\p{Lower}/v.test(myValue,)
            ? 'lowercaseLetter'
            : 'nonLetter',
        ], },],
    },];
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

  if (typeOf === 'object') {
    if (value === null)
      return [typeOf, { prototype: 'Null', },];

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

    const myValue = value as object;

    // Default plain object
    return [typeOf, {
      prototype: ['Object', {
        iterable: typeof (
            // @ts-expect-error -- Might be Async Iterable
            myValue[Symbol.asyncIterator]
          ) === 'function'
          ? [true, { async: true, },]
          : typeof (
              // @ts-expect-error -- Might be Iterable
              myValue[Symbol.iterator]
            ) === 'function'
          ? [true, { async: false, },]
          : false,
      },],
    },];
  }

  throw new TypeError(
    `This shouldn't happen. Unhandled value with typeof "${typeOf}" and prototype "${prototypeString}"`,
  );
}
