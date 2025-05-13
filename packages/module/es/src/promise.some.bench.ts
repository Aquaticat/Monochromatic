import {
  beforeAll,
  bench,
  describe,
} from 'vitest';
import { somePromises } from './promise.some.ts';

const SMALL_SIZE = 100;
const MEDIUM_SIZE = 100_000;
const LARGE_SIZE = 1_000_000;

// eslint-disable-next-line init-declarations
let smallArray: number[];
// eslint-disable-next-line init-declarations
let mediumArray: number[];
// eslint-disable-next-line init-declarations
let largeArray: number[];

beforeAll(() => {
  smallArray = Array.from({ length: SMALL_SIZE }, (_, i) => i);
  mediumArray = Array.from({ length: MEDIUM_SIZE }, (_, i) => i);
  largeArray = Array.from({ length: LARGE_SIZE }, (_, i) => i);
});

bench('performs well with matching item at beginning', async () => {
  // const startTime = performance.now();

  const result = await somePromises(
    (val) => val === 0,
    largeArray,
  );

  // const endTime = performance.now();
  // const elapsedMs = endTime - startTime;

  // expect(result).toBe(true);
  // expect(elapsedMs).toBeLessThan(15_000);
  // expect(elapsedMs).toBeLessThan(2000);
});

bench('performs well with matching item at end', async () => {
  // const startTime = performance.now();

  const result = await somePromises(
    (val) => val === LARGE_SIZE - 1,
    largeArray,
  );

  // const endTime = performance.now();
  // const elapsedMs = endTime - startTime;

  // expect(result).toBe(true);
  // expect(elapsedMs).toBeLessThan(15_000);
  // expect(elapsedMs).toBeLessThan(2000);
});

bench('performs well when no match exists', async () => {
  // const startTime = performance.now();

  const result = await somePromises(
    (val) => val > LARGE_SIZE,
    largeArray,
  );

  // const endTime = performance.now();
  // const elapsedMs = endTime - startTime;

  // expect(result).toBe(false);
  // expect(elapsedMs).toBeLessThan(15_000);
  // expect(elapsedMs).toBeLessThan(2000);
});

bench('works with async predicates', async () => {
  await somePromises(
    async (val) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      return val > 5;
    },
    [1, 3, 7, 2],
  );
});
