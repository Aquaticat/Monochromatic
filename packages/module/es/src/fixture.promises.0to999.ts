//region Promise Test Fixtures -- Provides an array of 1000 promises with progressive timing delays for testing asynchronous operations, concurrent processing, and performance characteristics

/**
 * Array of 1000 promises that resolve to consecutive integers from 0 to 999 with progressive delays.
 *
 * This fixture provides a comprehensive set of promises for testing various asynchronous
 * scenarios including concurrent execution, Promise.all/allSettled patterns, timeout
 * handling, and performance characteristics. Each promise resolves to its index value
 * after a delay equal to that index in milliseconds, creating a realistic simulation
 * of async operations with varying response times.
 *
 * Key characteristics:
 * - Promise at index 0 resolves immediately (0ms delay) to value 0
 * - Promise at index 1 resolves after 1ms to value 1
 * - Promise at index 999 resolves after 999ms to value 999
 * - Total execution time when awaited sequentially: ~499,500ms (sum of 0+1+...+999)
 * - All promises resolve successfully (no rejections)
 *
 * @example
 * Testing concurrent promise execution with Promise.all:
 * ```ts
 * import { promises0to999 } from '@monochromatic-dev/module-es';
 *
 * async function testConcurrentExecution(): Promise<void> {
 *   const start = Date.now();
 *
 *   // Take first 10 promises for reasonable test duration
 *   const firstTen = promises0to999.slice(0, 10);
 *   const results = await Promise.all(firstTen);
 *
 *   const elapsed = Date.now() - start;
 *   console.log(`Results: ${results}`); // [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
 *   console.log(`Concurrent execution took: ${elapsed}ms`); // ~9ms (longest delay)
 * }
 * ```
 *
 * @example
 * Testing sequential promise execution:
 * ```ts
 * import { promises0to999 } from '@monochromatic-dev/module-es';
 *
 * async function testSequentialExecution(): Promise<void> {
 *   const start = Date.now();
 *   const results: number[] = [];
 *
 *   // Process first 10 promises sequentially
 *   for (let i = 0; i < 10; i++) {
 *     const result = await promises0to999[i];
 *     results.push(result);
 *   }
 *
 *   const elapsed = Date.now() - start;
 *   console.log(`Results: ${results}`); // [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
 *   console.log(`Sequential execution took: ${elapsed}ms`); // ~45ms (0+1+2+...+9)
 * }
 * ```
 *
 * @example
 * Testing timeout scenarios with Promise.race:
 * ```ts
 * import { promises0to999 } from '@monochromatic-dev/module-es';
 *
 * async function testWithTimeout(): Promise<void> {
 *   const timeout = 50; // 50ms timeout
 *
 *   try {
 *     const results = await Promise.all(
 *       promises0to999.slice(0, 100).map(promise =>
 *         Promise.race([
 *           promise,
 *           new Promise((_, reject) =>
 *             setTimeout(() => reject(new Error('Timeout')), timeout)
 *           )
 *         ])
 *       )
 *     );
 *     console.log(`Completed ${results.length} promises within timeout`);
 *   } catch (error) {
 *     console.log('Some promises timed out');
 *   }
 * }
 * ```
 *
 * @example
 * Testing Promise.allSettled for handling mixed results:
 * ```ts
 * import { promises0to999 } from '@monochromatic-dev/module-es';
 *
 * async function testAllSettled(): Promise<void> {
 *   // Combine some fast promises with timeout racing
 *   const mixedPromises = promises0to999.slice(0, 20).map((promise, index) => {
 *     if (index > 15) {
 *       // Make some promises timeout by racing with 10ms timeout
 *       return Promise.race([
 *         promise,
 *         new Promise((_, reject) =>
 *           setTimeout(() => reject(new Error('Timeout')), 10)
 *         )
 *       ]);
 *     }
 *     return promise;
 *   });
 *
 *   const results = await Promise.allSettled(mixedPromises);
 *
 *   const fulfilled = results.filter(r => r.status === 'fulfilled').length;
 *   const rejected = results.filter(r => r.status === 'rejected').length;
 *
 *   console.log(`Fulfilled: ${fulfilled}, Rejected: ${rejected}`);
 * }
 * ```
 *
 * @example
 * Performance testing and benchmarking:
 * ```ts
 * import { promises0to999 } from '@monochromatic-dev/module-es';
 *
 * async function benchmarkDifferentStrategies(): Promise<void> {
 *   const testPromises = promises0to999.slice(0, 50);
 *
 *   // Test concurrent execution
 *   const concurrentStart = Date.now();
 *   await Promise.all(testPromises);
 *   const concurrentTime = Date.now() - concurrentStart;
 *
 *   // Test batched execution (5 at a time)
 *   const batchedStart = Date.now();
 *   for (let i = 0; i < testPromises.length; i += 5) {
 *     const batch = testPromises.slice(i, i + 5);
 *     await Promise.all(batch);
 *   }
 *   const batchedTime = Date.now() - batchedStart;
 *
 *   console.log(`Concurrent: ${concurrentTime}ms, Batched: ${batchedTime}ms`);
 * }
 * ```
 *
 * @example
 * Testing promise resolution order and timing:
 * ```ts
 * import { promises0to999 } from '@monochromatic-dev/module-es';
 *
 * async function testResolutionOrder(): Promise<void> {
 *   const resolutionOrder: number[] = [];
 *
 *   // Start all promises but track completion order
 *   const trackingPromises = promises0to999.slice(0, 10).map(async (promise, index) => {
 *     const result = await promise;
 *     resolutionOrder.push(result);
 *     return result;
 *   });
 *
 *   await Promise.all(trackingPromises);
 *   console.log(`Resolution order: ${resolutionOrder}`); // [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
 * }
 * ```
 */
/* @__NO_SIDE_EFFECTS__ */ export const promises0to999: Promise<number>[] = Array.from(
  { length: 1000 },
  (_, i) => new Promise((resolve) => setTimeout(() => resolve(i), i)),
);

//endregion Promise Test Fixtures
