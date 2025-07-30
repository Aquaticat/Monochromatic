// Don't test fixtures.

//region Generator Test Fixtures -- Provides generator functions that yield numbers from 0 to 999 for testing synchronous generators, asynchronous generators, error handling, and performance scenarios

/**
 * Synchronous generator that yields integers from 0 to 999 inclusive.
 *
 * This generator provides a straightforward way to test synchronous iteration
 * patterns and generator behavior with predictable numeric sequences. It yields
 * exactly 1000 values before completing naturally.
 *
 * @returns Generator that yields consecutive integers from 0 to 999
 *
 * @example
 * Basic iteration with for-of loop:
 * ```ts
 * import { gen0to999 } from '@monochromatic-dev/module-es';
 *
 * for (const value of gen0to999()) {
 *   console.log(value); // 0, 1, 2, ..., 999
 *   if (value === 5) break; // Stop early if needed
 * }
 * ```
 *
 * @example
 * Manual iteration with next():
 * ```ts
 * import { gen0to999 } from '@monochromatic-dev/module-es';
 *
 * const iterator = gen0to999();
 * const first = iterator.next(); // { value: 0, done: false }
 * const second = iterator.next(); // { value: 1, done: false }
 *
 * // Skip to the end
 * let result;
 * do {
 *   result = iterator.next();
 * } while (!result.done);
 * // result is { value: undefined, done: true }
 * ```
 *
 * @example
 * Converting to array for testing:
 * ```ts
 * import { gen0to999 } from '@monochromatic-dev/module-es';
 *
 * const allValues = [...gen0to999()];
 * console.log(allValues.length); // 1000
 * console.log(allValues[0]); // 0
 * console.log(allValues[999]); // 999
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function* gen0to999(): Generator<number> {
  for (let value = 0; value < 1000; value++)
    yield value;
}

/**
 * Synchronous generator that yields integers from 0 to 998, then throws an error.
 *
 * This generator is designed for testing error handling in synchronous iteration
 * scenarios. It yields 999 values (0 through 998) and then throws a RangeError
 * to simulate failure conditions. Essential for testing robust iteration patterns
 * and error recovery mechanisms.
 *
 * @returns Generator that yields consecutive integers from 0 to 998, then throws
 * @throws {RangeError} Always throws when reaching the end (after yielding 999 values)
 *
 * @example
 * Testing error handling with try-catch:
 * ```ts
 * import { gen0to999error } from '@monochromatic-dev/module-es';
 *
 * let count = 0;
 * try {
 *   for (const value of gen0to999error()) {
 *     count++;
 *     console.log(value); // 0, 1, 2, ..., 998
 *   }
 * } catch (error) {
 *   console.log(`Caught error after ${count} values`); // 999 values
 *   console.log(error.message); // "fixture reached 999"
 * }
 * ```
 *
 * @example
 * Manual iteration with error detection:
 * ```ts
 * import { gen0to999error } from '@monochromatic-dev/module-es';
 *
 * const iterator = gen0to999error();
 * const values: number[] = [];
 *
 * try {
 *   let result = iterator.next();
 *   while (!result.done) {
 *     values.push(result.value);
 *     result = iterator.next(); // This will eventually throw
 *   }
 * } catch (error) {
 *   console.log(`Collected ${values.length} values before error`); // 999
 * }
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export function* gen0to999error(): Generator<number> {
  for (let value = 0; value < 999; value++)
    yield value;
  throw new RangeError(`fixture reached 999`,);
}

/**
 * Asynchronous generator that yields integers from 0 to 999 inclusive.
 *
 * This async generator provides a way to test asynchronous iteration patterns
 * and async generator behavior with predictable numeric sequences. Unlike its
 * synchronous counterpart, this can be used with for-await-of loops and other
 * async iteration utilities.
 *
 * @returns AsyncGenerator that yields consecutive integers from 0 to 999
 *
 * @example
 * Basic async iteration with for-await-of:
 * ```ts
 * import { gen0to999Async } from '@monochromatic-dev/module-es';
 *
 * async function processValues(): Promise<void> {
 *   for await (const value of gen0to999Async()) {
 *     console.log(value); // 0, 1, 2, ..., 999
 *     if (value === 10) break; // Stop early if needed
 *   }
 * }
 * ```
 *
 * @example
 * Manual async iteration:
 * ```ts
 * import { gen0to999Async } from '@monochromatic-dev/module-es';
 *
 * async function manualIteration(): Promise<void> {
 *   const iterator = gen0to999Async();
 *   const first = await iterator.next(); // { value: 0, done: false }
 *   const second = await iterator.next(); // { value: 1, done: false }
 *
 *   // Process remaining values
 *   let result = await iterator.next();
 *   while (!result.done) {
 *     console.log(result.value);
 *     result = await iterator.next();
 *   }
 * }
 * ```
 *
 * @example
 * Converting to array with Promise.all:
 * ```ts
 * import { gen0to999Async } from '@monochromatic-dev/module-es';
 *
 * async function collectAll(): Promise<number[]> {
 *   const values: number[] = [];
 *   for await (const value of gen0to999Async()) {
 *     values.push(value);
 *   }
 *   return values; // [0, 1, 2, ..., 999]
 * }
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export async function* gen0to999Async(): AsyncGenerator<
  number
> {
  for (let value = 0; value < 1000; value++)
    yield value;
}

/**
 * Asynchronous generator that yields integers from 0 to 998, then throws an error.
 *
 * This async generator is designed for testing error handling in asynchronous
 * iteration scenarios. It yields 999 values (0 through 998) and then throws a
 * RangeError to simulate async failure conditions. Critical for testing robust
 * async iteration patterns and error recovery in async workflows.
 *
 * @returns AsyncGenerator that yields consecutive integers from 0 to 998, then throws
 * @throws {RangeError} Always throws when reaching the end (after yielding 999 values)
 *
 * @example
 * Testing async error handling:
 * ```ts
 * import { gen0to999errorAsync } from '@monochromatic-dev/module-es';
 *
 * async function testAsyncError(): Promise<void> {
 *   let count = 0;
 *   try {
 *     for await (const value of gen0to999errorAsync()) {
 *       count++;
 *       console.log(value); // 0, 1, 2, ..., 998
 *     }
 *   } catch (error) {
 *     console.log(`Caught async error after ${count} values`); // 999 values
 *     console.log(error.message); // "fixture reached 999"
 *   }
 * }
 * ```
 *
 * @example
 * Error handling with manual async iteration:
 * ```ts
 * import { gen0to999errorAsync } from '@monochromatic-dev/module-es';
 *
 * async function manualAsyncWithError(): Promise<void> {
 *   const iterator = gen0to999errorAsync();
 *   const results: number[] = [];
 *
 *   try {
 *     let result = await iterator.next();
 *     while (!result.done) {
 *       results.push(result.value);
 *       result = await iterator.next(); // Will eventually throw
 *     }
 *   } catch (error) {
 *     console.log(`Processed ${results.length} values before error`); // 999
 *   }
 * }
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export async function* gen0to999errorAsync(): AsyncGenerator<
  number
> {
  for (let value = 0; value < 999; value++)
    yield value;
  throw new RangeError(`fixture reached 999`,);
}

/**
 * Asynchronous generator that yields integers from 0 to 999 with progressive delays.
 *
 * This async generator introduces timing delays that increase with each yielded
 * value, making it perfect for testing performance characteristics, timeout
 * handling, and async iteration behavior under realistic timing conditions.
 * Each value i has a delay of i milliseconds, so the sequence becomes progressively
 * slower to emulate real-world async operations with varying response times.
 *
 * @returns AsyncGenerator that yields consecutive integers from 0 to 999 with increasing delays
 *
 * @example
 * Testing with progressive timing:
 * ```ts
 * import { gen0to999AsyncSlow } from '@monochromatic-dev/module-es';
 *
 * async function testSlowIteration(): Promise<void> {
 *   const start = Date.now();
 *   let count = 0;
 *
 *   for await (const value of gen0to999AsyncSlow()) {
 *     count++;
 *     if (count === 10) break; // Stop early to avoid long wait
 *   }
 *
 *   const elapsed = Date.now() - start;
 *   console.log(`Processed ${count} values in ${elapsed}ms`);
 *   // Approximate total delay: 0+1+2+...+9 = 45ms plus overhead
 * }
 * ```
 *
 * @example
 * Testing timeout scenarios:
 * ```ts
 * import { gen0to999AsyncSlow } from '@monochromatic-dev/module-es';
 *
 * async function testWithTimeout(): Promise<void> {
 *   const iterator = gen0to999AsyncSlow();
 *
 *   try {
 *     // Set a timeout for the first few values
 *     const timeoutPromise = new Promise((_, reject) =>
 *       setTimeout(() => reject(new Error('Timeout')), 100)
 *     );
 *
 *     const values: number[] = [];
 *     for (let iteration = 0; iteration < 20; iteration++) {
 *       const result = await Promise.race([
 *         iterator.next(),
 *         timeoutPromise
 *       ]);
 *       if (result.done) break;
 *       values.push(result.value);
 *     }
 *   } catch (error) {
 *     console.log('Operation timed out or failed');
 *   }
 * }
 * ```
 *
 * @example
 * Performance testing different async patterns:
 * ```ts
 * import { gen0to999AsyncSlow } from '@monochromatic-dev/module-es';
 *
 * async function performanceComparison(): Promise<void> {
 *   const iterator = gen0to999AsyncSlow();
 *   const start = Date.now();
 *
 *   // Test first 50 values to avoid excessive delay
 *   const results = [];
 *   for (let milliseconds = 0; milliseconds < 50; milliseconds++) {
 *     const result = await iterator.next();
 *     if (result.done) break;
 *     results.push(result.value);
 *   }
 *
 *   const elapsed = Date.now() - start;
 *   console.log(`Average time per value: ${elapsed / results.length}ms`);
 * }
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export async function* gen0to999AsyncSlow(): AsyncGenerator<
  number
> {
  for (let delayMilliseconds = 0; delayMilliseconds < 1000; delayMilliseconds++) {
    await (new Promise(resolve => setTimeout(resolve, delayMilliseconds,)));
    yield delayMilliseconds;
  }
}

/**
 * Asynchronous generator that yields integers from 0 to 998 with progressive delays, then throws an error.
 *
 * This async generator combines the progressive timing delays of the slow variant
 * with error throwing behavior. It's designed for testing error handling under
 * realistic async conditions where operations take increasing amounts of time
 * before eventually failing. Each value i has a delay of i milliseconds before
 * being yielded, and after 999 values, it throws a RangeError.
 *
 * @returns AsyncGenerator that yields consecutive integers from 0 to 998 with increasing delays, then throws
 * @throws {RangeError} Always throws when reaching the end (after yielding 999 values with delays)
 *
 * @example
 * Testing async error handling with realistic timing:
 * ```ts
 * import { gen0to999errorAsyncSlow } from '@monochromatic-dev/module-es';
 *
 * async function testSlowErrorHandling(): Promise<void> {
 *   let count = 0;
 *   const start = Date.now();
 *
 *   try {
 *     for await (const value of gen0to999errorAsyncSlow()) {
 *       count++;
 *       if (count === 20) break; // Stop early to avoid long delays
 *     }
 *   } catch (error) {
 *     const elapsed = Date.now() - start;
 *     console.log(`Error after ${count} values in ${elapsed}ms`);
 *     console.log(error.message); // "fixture reached 999"
 *   }
 * }
 * ```
 *
 * @example
 * Timeout testing with slow error generator:
 * ```ts
 * import { gen0to999errorAsyncSlow } from '@monochromatic-dev/module-es';
 *
 * async function testTimeoutWithSlowError(): Promise<void> {
 *   const iterator = gen0to999errorAsyncSlow();
 *   const timeout = 1000; // 1 second timeout
 *
 *   try {
 *     let count = 0;
 *     while (true) {
 *       const timeoutPromise = new Promise((_, reject) =>
 *         setTimeout(() => reject(new Error('Timeout')), timeout)
 *       );
 *
 *       const result = await Promise.race([
 *         iterator.next(),
 *         timeoutPromise
 *       ]);
 *
 *       if (result.done) break;
 *       count++;
 *     }
 *   } catch (error) {
 *     console.log(`Stopped due to: ${error.message}`);
 *   }
 * }
 * ```
 *
 * @example
 * Performance analysis of slow failing operations:
 * ```ts
 * import { gen0to999errorAsyncSlow } from '@monochromatic-dev/module-es';
 *
 * async function analyzeSlowFailure(): Promise<void> {
 *   const iterator = gen0to999errorAsyncSlow();
 *   const timings: number[] = [];
 *
 *   try {
 *     for (let valueIndex = 0; valueIndex < 30; valueIndex++) { // Test first 30 to keep reasonable timing
 *       const start = Date.now();
 *       const result = await iterator.next();
 *       const elapsed = Date.now() - start;
 *
 *       if (result.done) break;
 *       timings.push(elapsed);
 *     }
 *   } catch (error) {
 *     console.log('Average timing per operation:',
 *       timings.reduce((a, b) => a + b, 0) / timings.length);
 *   }
 * }
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export async function* gen0to999errorAsyncSlow(): AsyncGenerator<
  number
> {
  for (let delayMilliseconds = 0; delayMilliseconds < 999; delayMilliseconds++) {
    await (new Promise(resolve => setTimeout(resolve, delayMilliseconds,)));
    yield delayMilliseconds;
  }
  throw new RangeError(`fixture reached 999`,);
}

//endregion Generator Test Fixtures
