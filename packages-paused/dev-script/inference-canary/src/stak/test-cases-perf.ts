/**
 * Performance test program for the Stak codegen probe.
 *
 * 10,000,000 iterations of a linear congruential generator, printing every
 * 1000th state. Produces 10,000 lines of irregular output (not a monotone
 * sequence).
 *
 * LCG parameters: a=1664525, c=1013904223, m=2000000000, seed=42.
 * At 1M iterations models completed in 125-623ms (5x range). Scaling to 10M
 * makes that 1.25-6.23s; wide enough for PERF_FAST_MS/PERF_SLOW_MS to
 * differentiate. Expected output is precomputed in perf-expected-output.ts to
 * avoid an 8s module-load delay.
 */

/**
 * Performance test program: 10,000,000 iterations of an LCG, printing every 1000th state.
 *
 * @example
 * ```ts
 * import { PERF_TEST_INPUT } from './test-cases-perf.ts';
 * const result = await runInContainer({ source, stdinData: PERF_TEST_INPUT, signal });
 * ```
 */
export const PERF_TEST_INPUT: string = [
  '42',
  'STORE state',
  '0',
  'STORE i',
  'LABEL loop',
  'LOAD i',
  '10000000',
  'SUB',
  'JUMPZ done',
  'LOAD state',
  '1664525',
  'MUL',
  '1013904223',
  'ADD',
  '2000000000',
  'MOD',
  'STORE state',
  'LOAD i',
  '1',
  'ADD',
  'STORE i',
  'LOAD i',
  '1000',
  'MOD',
  'JUMPZ print_val',
  'JUMP loop',
  'LABEL print_val',
  'LOAD state',
  'PRINT',
  'JUMP loop',
  'LABEL done',
]
  .join('\n',);
