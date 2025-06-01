import {
  isIterable,
  isMaybeAsyncIterable,
} from './iterable.is.ts';
import type {MaybeAsyncIterable} from './iterable.type.maybe.ts';
import {
  bigint0,
  isBigint,
  isIntBigint,
  isNumber,
  isNumeric,
} from './numeric.is.ts';
import type {Numeric} from './numeric.type.int.ts';

// Helper functions to reduce duplication
function validateAndProcessIterable<T extends number | bigint, >(
  items: any[],
  typeValidator: (item: any) => boolean,
  initialValue: T,
  converter?: (item: any) => T,
): T {
  const items0 = items[0];
  let total = initialValue;

  if (items.length === 1 && isIterable(items0)) {
    const items0Arr = [...items0];
    for (const item of items0Arr) {
      if (!typeValidator(item)) {
        throw new Error('invalid arguments');
      }
      total = total + (converter ? converter(item) : item) as T;
    }
  } else if (items.every(typeValidator)) {
    for (const item of items) {
      total = total + (converter ? converter(item) : item) as T;
    }
  } else {
    throw new Error('invalid arguments');
  }

  return total;
}

async function validateAndProcessAsyncIterable<T extends number | bigint, >(
  items: any[],
  typeValidator: (item: any) => boolean,
  initialValue: T,
  converter?: (item: any) => T,
): Promise<T> {
  const items0 = items[0];
  let total = initialValue;

  if (items.length === 1 && isMaybeAsyncIterable(items0)) {
    const items0Arr = await Array.fromAsync(items0);
    for (const item of items0Arr) {
      if (!typeValidator(item)) {
        throw new Error('invalid arguments');
      }
      total = total + (converter ? converter(item) : item) as T;
    }
  } else if (items.every(typeValidator)) {
    for (const item of items) {
      total = total + (converter ? converter(item) : item) as T;
    }
  } else {
    throw new Error('invalid arguments');
  }

  return total;
}

// Numbers
/* @__NO_SIDE_EFFECTS__ */
export async function addNumbersAsync(
  numbers: MaybeAsyncIterable<number>,
): Promise<number>;
/* @__NO_SIDE_EFFECTS__ */
export async function addNumbersAsync(
  ...numbers: number[]
): Promise<number>;
export async function addNumbersAsync(...numbers: any): Promise<number> {
  if (!Array.isArray(numbers)) {
    throw new Error("numbers isn't an iterable");
  }

  return await validateAndProcessAsyncIterable(
    numbers,
    isNumber,
    0,
  );
}

/* @__NO_SIDE_EFFECTS__ */
export function addNumbers(
  numbers: Iterable<number>,
): number;
/* @__NO_SIDE_EFFECTS__ */
export function addNumbers(
  ...numbers: number[]
): number;
export function addNumbers(...numbers: any): number {
  if (!Array.isArray(numbers)) {
    throw new Error("numbers isn't an iterable");
  }

  return validateAndProcessIterable(
    numbers,
    isNumber,
    0,
  );
}

// Bigints
/* @__NO_SIDE_EFFECTS__ */
export async function addBigintsAsync(
  bigints: MaybeAsyncIterable<bigint>,
): Promise<bigint>;
/* @__NO_SIDE_EFFECTS__ */
export async function addBigintsAsync(
  ...bigints: bigint[]
): Promise<bigint>;
export async function addBigintsAsync(...bigints: any): Promise<bigint> {
  if (!Array.isArray(bigints)) {
    throw new Error("numbers isn't an iterable");
  }

  return await validateAndProcessAsyncIterable(
    bigints,
    isBigint,
    bigint0,
  );
}

export function addBigints(bigints: Iterable<bigint>): bigint;
export function addBigints(...bigints: bigint[]): bigint;
export function addBigints(...bigints: any): bigint {
  if (!Array.isArray(bigints)) {
    throw new Error("numbers isn't an iterable");
  }

  return validateAndProcessIterable(
    bigints,
    isBigint,
    bigint0,
  );
}

// Numerics
export async function addNumericsAsync<
  T extends MaybeAsyncIterable<Numeric>,
>(
  numerics: T,
): Promise<T extends MaybeAsyncIterable<number> ? number : bigint | number>;
export async function addNumericsAsync<T extends Numeric[], >(
  ...numerics: T
): Promise<T extends number[] ? number : bigint | number>;
export async function addNumericsAsync(...numerics: any): Promise<Numeric> {
  if (!Array.isArray(numerics)) {
    throw new Error("numbers isn't an iterable");
  }

  const total = await validateAndProcessAsyncIterable(
    numerics,
    isNumeric,
    0n,
    BigInt,
  );

  return isIntBigint(total) ? Number(total) : total;
}

export function addNumerics<T extends Iterable<Numeric>, >(
  numerics: T,
): T extends Iterable<number> ? number : bigint | number;
export function addNumerics<T extends Numeric[], >(
  ...numerics: T
): T extends number[] ? number : bigint | number;
export function addNumerics(...numerics: any): Numeric {
  if (!Array.isArray(numerics)) {
    throw new Error("numbers isn't an iterable");
  }

  const total = validateAndProcessIterable(
    numerics,
    isNumeric,
    0n,
    BigInt,
  );

  return isIntBigint(total) ? Number(total) : total;
}
