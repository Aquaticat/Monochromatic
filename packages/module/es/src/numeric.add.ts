import { binary } from './function.nary.ts';
import {
  isIterable,
  isMaybeAsyncIterable,
} from './iterable.is.ts';
import {
  reduceIterable,
  reduceIterableAsync,
  reduceIterableAsyncGen,
} from './iterable.reduce.ts';
import type { MaybeAsyncIterable } from './iterable.type.maybe.ts';
import {
  bigint0,
  isBigint,
  isIntBigint,
  isNumber,
  isNumeric,
} from './numeric.is.ts';
import type { Numeric } from './numeric.type.int.ts';

export function addTwoNumbers(previousValue: number, currentValue: number): number {
  return previousValue + currentValue;
}

export function sumNumbers(...numbers: number[]): number {
  return numbers.reduce(addTwoNumbers, 0);
}

export function addTwoBigints(previousValue: bigint, currentValue: bigint): bigint {
  return previousValue + currentValue;
}

export function sumBigints(...bigints: bigint[]): bigint {
  return bigints.reduce(addTwoBigints, 0n);
}

export function addTwoNumerics<const Prev extends number | bigint,
  const Curr extends number | bigint,
  const Returns extends Prev extends number ? Curr extends number ? number : bigint
    : bigint,>(
  previousValue: Prev,
  currentValue: Curr,
): Returns {
  if (typeof previousValue === 'number' && typeof currentValue === 'number') {
    return previousValue + currentValue as Returns;
  }

  return BigInt(previousValue) + BigInt(currentValue) as Returns;
}

export function sumNumerics<const T extends (bigint | number)[],
  Returns extends T extends number[] ? number : bigint,>(
  ...numerics: T
): Returns {
  return numerics.reduce(
    addTwoNumerics,
    0,
  ) as Returns;
}

export async function addNumbersAsync(
  numbers: MaybeAsyncIterable<number>,
): Promise<number> {
  return await reduceIterableAsync(0, addTwoNumbers, numbers);
}

export function addNumbers(
  numbers: Iterable<number>,
): number {
  return reduceIterable(0, addTwoNumbers, numbers);
}

export async function addBigintsAsync(
  bigints: MaybeAsyncIterable<bigint>,
): Promise<bigint> {
  return await reduceIterableAsync(0n, addTwoBigints, bigints);
}

export function addBigints(bigints: Iterable<bigint>): bigint {
  return reduceIterable(0n, addTwoBigints, bigints);
}

export async function addNumericsAsync<
  const T extends MaybeAsyncIterable<Numeric>,
  const Returns extends T extends MaybeAsyncIterable<number> ? number : bigint,
>(
  numerics: T,
): Promise<Returns> {
  return await reduceIterableAsync(0, addTwoNumerics, numerics) as Returns;
}

export function addNumerics<
  const T extends Iterable<Numeric>,
  const Returns extends T extends Iterable<number> ? number : bigint,
>(
  numerics: T,
): Returns {
  return reduceIterable(0, addTwoNumerics, numerics) as Returns;
}
