import type { MaybeAsyncIterable, } from './iterable.basic.ts';
import {
  reduceIterable,
  reduceIterableAsync,
} from './iterable.reduce.ts';

import type { Numeric, } from './numeric.int.ts';

/**
 * Adds two numbers together using standard JavaScript addition operator.
 *
 * This function serves as a named reference to addition operation, useful for functional programming patterns
 * like reduce operations and function composition. Provides explicit typing for number addition operations.
 *
 * @param previousValue - First number to add
 * @param currentValue - Second number to add
 * @returns Sum of the two numbers
 *
 * @example
 * Basic addition:
 * ```ts
 * const result = addTwoNumbers(5, 3);
 * console.log(result); // 8
 * ```
 *
 * @example
 * Using with reduce for array summation:
 * ```ts
 * const numbers = [1, 2, 3, 4, 5];
 * const total = numbers.reduce(addTwoNumbers, 0);
 * console.log(total); // 15
 * ```
 */
export function addTwoNumbers(previousValue: number, currentValue: number,): number {
  return previousValue + currentValue;
}

/**
 * Sums multiple numbers using variadic parameters, calculating the total of all provided number arguments.
 *
 * Uses functional reduction with addTwoNumbers for consistent addition behavior.
 * Handles any number of arguments including zero arguments (returns 0).
 * Optimized for readability and type safety in mathematical computations.
 *
 * @param numbers - Variable number of numeric values to sum together
 * @returns Total sum of all provided numbers, or 0 if no arguments
 *
 * @example
 * Basic summation:
 * ```ts
 * const total = sumNumbers(1, 2, 3, 4, 5);
 * console.log(total); // 15
 * ```
 *
 * @example
 * Calculating averages:
 * ```ts
 * const values = [10, 20, 30];
 * const sum = sumNumbers(...values);
 * const average = sum / values.length;
 * console.log(average); // 20
 * ```
 *
 * @example
 * Empty arguments handling:
 * ```ts
 * sumNumbers() // 0
 * sumNumbers(42) // 42
 * ```
 */
export function sumNumbers(...numbers: number[]): number {
  return numbers.reduce(addTwoNumbers, 0,);
}

/**
 * Adds two bigint values together using JavaScript bigint addition operator.
 *
 * Provides named reference for bigint addition in functional programming contexts.
 * Essential for working with large integers that exceed Number.MAX_SAFE_INTEGER limits.
 * Maintains full precision for arbitrary-precision integer arithmetic.
 *
 * @param previousValue - First bigint value to add
 * @param currentValue - Second bigint value to add
 * @returns Sum of the two bigint values
 *
 * @example
 * Basic bigint addition:
 * ```ts
 * const result = addTwoBigints(100n, 200n);
 * console.log(result); // 300n
 * ```
 *
 * @example
 * Large number arithmetic:
 * ```ts
 * const large1 = BigInt(Number.MAX_SAFE_INTEGER) + 1n;
 * const large2 = BigInt(Number.MAX_SAFE_INTEGER) + 2n;
 * const sum = addTwoBigints(large1, large2);
 * console.log(sum); // Very large bigint result
 * ```
 */
export function addTwoBigints(previousValue: bigint, currentValue: bigint,): bigint {
  return previousValue + currentValue;
}

/**
 * Sums multiple bigint values using variadic parameters, calculating total of all provided bigint arguments.
 *
 * Uses functional reduction with addTwoBigints for consistent arbitrary-precision arithmetic.
 * Handles any number of bigint arguments including zero arguments (returns 0n).
 * Ideal for financial calculations and large integer computations requiring exact precision.
 *
 * @param bigints - Variable number of bigint values to sum together
 * @returns Total sum of all provided bigints, or 0n if no arguments
 *
 * @example
 * Basic bigint summation:
 * ```ts
 * const total = sumBigints(100n, 200n, 300n);
 * console.log(total); // 600n
 * ```
 *
 * @example
 * Financial calculations:
 * ```ts
 * const amounts = [1000n, 2500n, 750n]; // cents
 * const totalCents = sumBigints(...amounts);
 * console.log(totalCents); // 4250n
 * ```
 *
 * @example
 * Large number calculations:
 * ```ts
 * const largeValues = [
 *   BigInt('123456789012345678901234567890'),
 *   BigInt('987654321098765432109876543210')
 * ];
 * const sum = sumBigints(...largeValues);
 * // Exact precision maintained
 * ```
 */
export function sumBigints(...bigints: bigint[]): bigint {
  // eslint-disable-next-line no-magic-numbers -- Zero bigint as initial value
  return bigints.reduce(addTwoBigints, 0n,);
}

/**
 * Adds two numeric values (number or bigint) with intelligent type-preserving behavior.
 *
 * When both values are numbers, returns number result for optimal performance.
 * When either value is bigint, converts both to bigint and returns bigint for precision.
 * Provides seamless mixed-type arithmetic with automatic type promotion strategy.
 *
 * @template Prev - Type of first numeric value (number or bigint)
 * @template Curr - Type of second numeric value (number or bigint)
 * @template Returns - Conditional return type: number if both inputs are numbers, otherwise bigint
 * @param previousValue - First numeric value to add
 * @param currentValue - Second numeric value to add
 * @returns Sum with appropriate type based on input types
 *
 * @example
 * Number + Number = Number:
 * ```ts
 * const result = addTwoNumerics(5, 3);
 * console.log(result); // 8 (number)
 * ```
 *
 * @example
 * Mixed types promote to bigint:
 * ```ts
 * const result1 = addTwoNumerics(5, 3n);
 * console.log(result1); // 8n (bigint)
 *
 * const result2 = addTwoNumerics(100n, 50);
 * console.log(result2); // 150n (bigint)
 * ```
 *
 * @example
 * BigInt + BigInt = BigInt:
 * ```ts
 * const result = addTwoNumerics(1000n, 2000n);
 * console.log(result); // 3000n (bigint)
 * ```
 */
export function addTwoNumerics<const Prev extends number | bigint,
  const Curr extends number | bigint,
  const Returns extends Prev extends number ? Curr extends number ? number : bigint
    : bigint,>(
  previousValue: Prev,
  currentValue: Curr,
): Returns {
  if (typeof previousValue === 'number' && typeof currentValue === 'number')
    return previousValue + currentValue as Returns;

  return BigInt(previousValue,) + BigInt(currentValue,) as Returns;
}

/**
 * Sums multiple numeric values (numbers and/or bigints) with intelligent type resolution.
 *
 * When all values are numbers, returns number for performance optimization.
 * When any value is bigint, promotes all to bigint and returns bigint for precision.
 * Provides seamless mixed-type arithmetic with variadic parameter support.
 *
 * @template T - Array type containing numbers and/or bigints
 * @template Returns - Conditional return type: number if all inputs are numbers, otherwise bigint
 * @param numerics - Variable number of numeric values to sum together
 * @returns Total sum with appropriate type based on input types
 *
 * @example
 * All numbers return number:
 * ```ts
 * const result = sumNumerics(1, 2, 3, 4, 5);
 * console.log(result); // 15 (number)
 * ```
 *
 * @example
 * Mixed types promote to bigint:
 * ```ts
 * const result = sumNumerics(1, 2n, 3, 4);
 * console.log(result); // 10n (bigint)
 * ```
 *
 * @example
 * All bigints return bigint:
 * ```ts
 * const result = sumNumerics(100n, 200n, 300n);
 * console.log(result); // 600n (bigint)
 * ```
 *
 * @example
 * Financial calculations with mixed precision:
 * ```ts
 * const prices = [19.99, 25n, 12.50]; // Mixed cents/dollars
 * const total = sumNumerics(...prices);
 * // Promotes to bigint for precision
 * ```
 */
export function sumNumerics<const T extends (bigint | number)[],
  Returns extends T extends number[] ? number : bigint,>(
  ...numerics: T
): Returns {
  return numerics.reduce(
    addTwoNumerics,
    0,
  ) as Returns;
}

/**
 * Asynchronously sums numbers from an async iterable source using reduction pattern.
 *
 * Processes streaming numeric data with memory-efficient iteration over async sources.
 * Handles arrays, async generators, and other async iterables uniformly.
 * Uses addTwoNumbers reducer for consistent arithmetic behavior across sync/async contexts.
 *
 * @param numbers - Async iterable containing numbers to sum
 * @returns Total sum of all numbers in the async iterable
 *
 * @example
 * Basic async summation:
 * ```ts
 * const numbers = [1, 2, 3, 4, 5];
 * const total = await addNumbersAsync(numbers);
 * console.log(total); // 15
 * ```
 *
 * @example
 * Working with async generators:
 * ```ts
 * async function* generateNumbers() {
 *   for (let i = 1; i <= 10; i++) {
 *     await new Promise(resolve => setTimeout(resolve, 10));
 *     yield i;
 *   }
 * }
 *
 * const sum = await addNumbersAsync(generateNumbers());
 * console.log(sum); // 55
 * ```
 *
 * @example
 * Processing streaming data:
 * ```ts
 * async function* fetchPrices() {
 *   const urls = ['api/price1', 'api/price2', 'api/price3'];
 *   for (const url of urls) {
 *     const response = await fetch(url);
 *     const data = await response.json();
 *     yield data.price;
 *   }
 * }
 *
 * const totalPrice = await addNumbersAsync(fetchPrices());
 * ```
 */
export async function addNumbersAsync(
  numbers: MaybeAsyncIterable<number>,
): Promise<number> {
  return await reduceIterableAsync(0, addTwoNumbers, numbers,);
}

/**
 * Sums numbers from a synchronous iterable source using reduction pattern.
 *
 * Processes numeric data from arrays, Sets, generators, and other synchronous iterables.
 * Uses addTwoNumbers reducer for consistent arithmetic behavior and optimal performance.
 * Memory-efficient iteration suitable for large datasets.
 *
 * @param numbers - Synchronous iterable containing numbers to sum
 * @returns Total sum of all numbers in the iterable
 *
 * @example
 * Basic array summation:
 * ```ts
 * const numbers = [1, 2, 3, 4, 5];
 * const total = addNumbers(numbers);
 * console.log(total); // 15
 * ```
 *
 * @example
 * Working with Sets for unique values:
 * ```ts
 * const uniqueNumbers = new Set([1, 2, 2, 3, 3, 4]);
 * const sum = addNumbers(uniqueNumbers);
 * console.log(sum); // 10 (1+2+3+4)
 * ```
 *
 * @example
 * Using with generators:
 * ```ts
 * function* generateSquares(max: number) {
 *   for (let i = 1; i <= max; i++) {
 *     yield i * i;
 *   }
 * }
 *
 * const sumOfSquares = addNumbers(generateSquares(5));
 * console.log(sumOfSquares); // 55 (1+4+9+16+25)
 * ```
 */
export function addNumbers(
  numbers: Iterable<number>,
): number {
  return reduceIterable(0, addTwoNumbers, numbers,);
}

/**
 * Asynchronously sums bigint values from an async iterable source using reduction pattern.
 *
 * Processes streaming bigint data with memory-efficient iteration over async sources.
 * Maintains arbitrary precision for large integer arithmetic in async contexts.
 * Uses addTwoBigints reducer for consistent bigint behavior across sync/async operations.
 *
 * @param bigints - Async iterable containing bigint values to sum
 * @returns Total sum of all bigints in the async iterable
 *
 * @example
 * Basic async bigint summation:
 * ```ts
 * const bigints = [100n, 200n, 300n];
 * const total = await addBigintsAsync(bigints);
 * console.log(total); // 600n
 * ```
 *
 * @example
 * Working with async generators for large numbers:
 * ```ts
 * async function* generateLargeNumbers() {
 *   for (let i = 1n; i <= 5n; i++) {
 *     await new Promise(resolve => setTimeout(resolve, 10));
 *     yield BigInt(Number.MAX_SAFE_INTEGER) + i;
 *   }
 * }
 *
 * const sum = await addBigintsAsync(generateLargeNumbers());
 * // Very large bigint sum
 * ```
 *
 * @example
 * Financial calculations with precision:
 * ```ts
 * async function* fetchTransactions() {
 *   const ids = ['tx1', 'tx2', 'tx3'];
 *   for (const id of ids) {
 *     const tx = await fetchTransaction(id);
 *     yield BigInt(tx.amountInCents);
 *   }
 * }
 *
 * const totalCents = await addBigintsAsync(fetchTransactions());
 * ```
 */
export async function addBigintsAsync(
  bigints: MaybeAsyncIterable<bigint>,
): Promise<bigint> {
  // eslint-disable-next-line no-magic-numbers -- Zero bigint as initial value
  return await reduceIterableAsync(0n, addTwoBigints, bigints,);
}

/**
 * Sums bigint values from a synchronous iterable source using reduction pattern.
 *
 * Processes bigint data from arrays, Sets, generators maintaining arbitrary precision.
 * Uses addTwoBigints reducer for consistent large integer arithmetic behavior.
 * Memory-efficient iteration suitable for financial and cryptographic calculations.
 *
 * @param bigints - Synchronous iterable containing bigint values to sum
 * @returns Total sum of all bigints in the iterable
 *
 * @example
 * Basic bigint array summation:
 * ```ts
 * const bigints = [100n, 200n, 300n];
 * const total = addBigints(bigints);
 * console.log(total); // 600n
 * ```
 *
 * @example
 * Working with large financial amounts:
 * ```ts
 * const transactionAmounts = new Set([
 *   1000000n, // $10,000.00 in cents
 *   2500000n, // $25,000.00 in cents
 *   750000n   // $7,500.00 in cents
 * ]);
 * const totalCents = addBigints(transactionAmounts);
 * console.log(totalCents); // 4250000n ($42,500.00)
 * ```
 *
 * @example
 * Cryptographic number calculations:
 * ```ts
 * function* generatePrimes() {
 *   const primes = [2n, 3n, 5n, 7n, 11n, 13n];
 *   for (const prime of primes) {
 *     yield prime ** 10n; // Very large prime powers
 *   }
 * }
 *
 * const sumOfPowers = addBigints(generatePrimes());
 * ```
 */
export function addBigints(bigints: Iterable<bigint>,): bigint {
  // eslint-disable-next-line no-magic-numbers -- Zero bigint as initial value
  return reduceIterable(0n, addTwoBigints, bigints,);
}

/**
 * Asynchronously sums numeric values (numbers/bigints) from async iterable with intelligent type resolution.
 *
 * Processes streaming mixed numeric data with memory-efficient async iteration.
 * When all values are numbers, returns number for performance optimization.
 * When any value is bigint, promotes result to bigint for precision preservation.
 *
 * @template T - Async iterable type containing numbers and/or bigints
 * @template Returns - Conditional return type: number if all values are numbers, otherwise bigint
 * @param numerics - Async iterable containing numeric values to sum
 * @returns Total sum with appropriate type based on iterable content
 *
 * @example
 * All numbers in async context:
 * ```ts
 * const numbers = [1, 2, 3, 4, 5];
 * const total = await addNumericsAsync(numbers);
 * console.log(total); // 15 (number)
 * ```
 *
 * @example
 * Mixed types promote to bigint:
 * ```ts
 * async function* generateMixedNumerics() {
 *   yield 100;   // number
 *   yield 200n;  // bigint
 *   yield 300;   // number
 * }
 *
 * const sum = await addNumericsAsync(generateMixedNumerics());
 * console.log(sum); // 600n (bigint)
 * ```
 *
 * @example
 * Financial data processing:
 * ```ts
 * async function* fetchAccountBalances() {
 *   const accounts = ['acc1', 'acc2', 'acc3'];
 *   for (const account of accounts) {
 *     const balance = await getBalance(account);
 *     yield balance.precision === 'exact' ?
 *       BigInt(balance.cents) : balance.dollars;
 *   }
 * }
 *
 * const totalBalance = await addNumericsAsync(fetchAccountBalances());
 * ```
 */
export async function addNumericsAsync<
  const T extends MaybeAsyncIterable<Numeric>,
  const Returns extends T extends MaybeAsyncIterable<number> ? number : bigint,
>(
  numerics: T,
): Promise<Returns> {
  return await reduceIterableAsync(0, addTwoNumerics, numerics,) as Returns;
}

/**
 * Sums numeric values (numbers/bigints) from synchronous iterable with intelligent type resolution.
 *
 * Processes mixed numeric data from arrays, Sets, generators with optimal type handling.
 * When all values are numbers, returns number for performance optimization.
 * When any value is bigint, promotes result to bigint for precision preservation.
 *
 * @template T - Iterable type containing numbers and/or bigints
 * @template Returns - Conditional return type: number if all values are numbers, otherwise bigint
 * @param numerics - Synchronous iterable containing numeric values to sum
 * @returns Total sum with appropriate type based on iterable content
 *
 * @example
 * All numbers remain number type:
 * ```ts
 * const numbers = [1, 2, 3, 4, 5];
 * const total = addNumerics(numbers);
 * console.log(total); // 15 (number)
 * ```
 *
 * @example
 * Mixed types promote to bigint:
 * ```ts
 * const mixed = new Set([100, 200n, 300]);
 * const sum = addNumerics(mixed);
 * console.log(sum); // 600n (bigint)
 * ```
 *
 * @example
 * Financial precision calculations:
 * ```ts
 * function* generateInvoiceAmounts() {
 *   const amounts = [
 *     { dollars: 19.99, exact: false },
 *     { cents: 2500n, exact: true },
 *     { dollars: 12.50, exact: false }
 *   ];
 *
 *   for (const amount of amounts) {
 *     yield amount.exact ? amount.cents : amount.dollars;
 *   }
 * }
 *
 * const total = addNumerics(generateInvoiceAmounts());
 * // Returns bigint for precision when any exact amounts present
 * ```
 */
export function addNumerics<
  const T extends Iterable<Numeric>,
  const Returns extends T extends Iterable<number> ? number : bigint,
>(
  numerics: T,
): Returns {
  return reduceIterable(0, addTwoNumerics, numerics,) as Returns;
}
