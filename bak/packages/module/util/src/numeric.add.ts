import type { MaybeAsyncIterable } from './arrayLike.ts';

// The performance cannot be optimized for this function overload signature when calling with an AsyncIterable argument, because we always have to wait for the current number to be retrived.
/* @__NO_SIDE_EFFECTS__ */ export async function addNumbersAsync(
  numbers: MaybeAsyncIterable<number>,
): Promise<number>;
/* @__NO_SIDE_EFFECTS__ */ export async function addNumbersAsync(
  ...numbers: number[]
): Promise<number>;
/**
 Returns the total of an Iterable of numbers as a number, can be passed as a single argument or a argument list.

 @remarks
 From https://selfrefactor.github.io/rambdax
 We're not using Iterator helpers. See https://bugzilla.mozilla.org/show_bug.cgi?id=1568906
 */
/* @__NO_SIDE_EFFECTS__ */ export async function addNumbersAsync(
  ...numbers: any
): Promise<number> {
  let total = 0;
  for await (const number of numbers) {
    total += number;
  }
  return total;
}

/* @__NO_SIDE_EFFECTS__ */ export function addNumbers(numbers: Iterable<number>): number;
/* @__NO_SIDE_EFFECTS__ */ export function addNumbers(...numbers: number[]): number;
/** {@inheritDoc addNumbersAsync} */
/* @__NO_SIDE_EFFECTS__ */ export function addNumbers(...numbers: any): number {
  let total = 0;
  for (const numberItem of numbers) {
    total += numberItem;
  }
  return total;
}

/* @__NO_SIDE_EFFECTS__ */ export async function addBigintsAsync(
  bigint: MaybeAsyncIterable<bigint>,
): Promise<bigint>;
/* @__NO_SIDE_EFFECTS__ */ export async function addBigintsAsync(
  ...bigints: bigint[]
): Promise<bigint>;
/**
 Returns the total of an Iterable of bigints as a bigint, can be passed as a single argument or a argument list.
 */
/* @__NO_SIDE_EFFECTS__ */ export async function addBigintsAsync(
  ...bigints: any
): Promise<bigint> {
  let total = 0n;
  for await (const bigintItem of bigints) {
    total += bigintItem;
  }
  return total;
}

/* @__NO_SIDE_EFFECTS__ */ export function addBigints(bigints: Iterable<bigint>): bigint;
/* @__NO_SIDE_EFFECTS__ */ export function addBigints(...bigints: bigint[]): bigint;
/** {@inheritDoc addBigintsAsync} */
/* @__NO_SIDE_EFFECTS__ */ export function addBigints(...numbers: any): bigint {
  let total = 0n;
  for (const bigintItem of numbers) {
    total += bigintItem;
  }
  return total;
}

/* @__NO_SIDE_EFFECTS__ */ export type numeric = number | bigint;

/* @__NO_SIDE_EFFECTS__ */ export async function addNumericsAsync<
  T extends MaybeAsyncIterable<numeric>,
>(
  numerics: T,
): Promise<
  T extends (MaybeAsyncIterable<number>) ? number : bigint
>;
/* @__NO_SIDE_EFFECTS__ */ export async function addNumericsAsync<T extends numeric[],>(
  ...numerics: T
): Promise<T extends number[] ? number : bigint>;
/* @__NO_SIDE_EFFECTS__ */ export async function addNumericsAsync(
  ...numerics: any
): Promise<numeric> {
  // Here is a rare case where dynamic typing saved us.
  let total: number | bigint = 0;
  for await (const numericItem of numerics) {
    if (typeof numericItem === 'bigint' && typeof total !== 'bigint') {
      total = BigInt(total) + numericItem;
      continue;
    }
    total += numericItem;
  }
  return total;
}

/* @__NO_SIDE_EFFECTS__ */ export function addNumerics<T extends Iterable<numeric>,>(
  numerics: T,
): T extends Iterable<number> ? number : bigint;
/* @__NO_SIDE_EFFECTS__ */ export function addNumerics<T extends numeric[],>(
  ...numerics: T
): T extends number[] ? number : bigint;
/* @__NO_SIDE_EFFECTS__ */ export function addNumerics(...numerics: any): numeric {
  // Here is a rare case where dynamic typing saved us.
  let total: number | bigint = 0;
  for (const numericItem of numerics) {
    if (typeof numericItem === 'bigint' && typeof total !== 'bigint') {
      total = BigInt(total) + numericItem;
      continue;
    }
    total += numericItem;
  }
  return total;
}
