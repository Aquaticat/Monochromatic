import {
  logtapeConfiguration,
  logtapeConfigure,
  reduceIterable,
  reduceIterableAsync,
  reduceIterableAsyncGen,
  reduceIterableGen,
} from '@monochromatic-dev/module-es/.js';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration(),);

describe(reduceIterable, () => {
  test('reduces array to a single value', () => {
    const array = [1, 2, 3, 4,];
    const sum = reduceIterable(0, (acc: number, val: number,) => acc + val, array,);
    expect(sum,).toBe(10,);
  });

  test('works with empty arrays', () => {
    const array: number[] = [];
    const sum = reduceIterable(0, (acc: number, val: number,) => acc + val, array,);
    expect(sum,).toBe(0,);
  });

  test('uses index in reducer', () => {
    const array = ['a', 'b', 'c',];
    const result = reduceIterable('',
      (acc: string, val: string, idx: number,) => acc + val + idx, array,);
    expect(result,).toBe('a0b1c2',);
  });

  test('works with non-array iterables', () => {
    const set = new Set([1, 2, 3, 4,],);
    const sum = reduceIterable(0, (acc: number, val: number,) => acc + val, set,);
    expect(sum,).toBe(10,);
  });
},);

describe(reduceIterableAsync, () => {
  test('reduces array to a single value asynchronously', async () => {
    const array = [1, 2, 3, 4,];
    const sum = await reduceIterableAsync(0,
      async (acc: number, val: number,) => acc + val, array,);
    expect(sum,).toBe(10,);
  });

  test('works with empty arrays', async () => {
    const array: number[] = [];
    const sum = await reduceIterableAsync(0,
      async (acc: number, val: number,) => acc + val, array,);
    expect(sum,).toBe(0,);
  });

  test('works with async iterables', async () => {
    async function* asyncSource() {
      yield 1;
      yield 2;
      yield 3;
    }

    const sum = await reduceIterableAsync(0,
      async (acc: number, val: number,) => acc + val, asyncSource(),);
    expect(sum,).toBe(6,);
  });

  test('processes elements in sequence', async () => {
    const array = [1, 2, 3,];
    const operations: string[] = [];

    await reduceIterableAsync(0, async (acc: number, val: number,) => {
      operations.push(`Processing ${val}`,);
      return acc + val;
    }, array,);

    expect(operations,).toEqual(['Processing 1', 'Processing 2', 'Processing 3',],);
  });
},);

describe(reduceIterableGen, () => {
  test('yields each accumulator state', () => {
    const array = [1, 2, 3, 4,];
    const generator = reduceIterableGen(0, (acc: number, val: number,) => acc + val,
      array,);

    expect(generator.next().value,).toBe(0,); // Initial value
    expect(generator.next().value,).toBe(1,); // After processing 1
    expect(generator.next().value,).toBe(3,); // After processing 2
    expect(generator.next().value,).toBe(6,); // After processing 3
    expect(generator.next().value,).toBe(10,); // After processing 4
    expect(generator.next().done,).toBe(true,);
  });

  test('works with empty arrays', () => {
    const array: number[] = [];
    const generator = reduceIterableGen(0, (acc: number, val: number,) => acc + val,
      array,);

    expect(generator.next().value,).toBe(0,); // Initial value
    expect(generator.next().done,).toBe(true,);
  });

  test('uses index in reducer', () => {
    const array = ['a', 'b', 'c',];
    const generator = reduceIterableGen('', (acc: string, val, idx,) => acc + val + idx,
      array,);

    const results: any[] = [];
    for (const value of generator)
      results.push(value,);

    expect(results,).toEqual(['', 'a0', 'a0b1', 'a0b1c2',],);
  });
},);

describe(reduceIterableAsyncGen, () => {
  test('yields each accumulator state asynchronously', async () => {
    const array = [1, 2, 3,];
    const generator = reduceIterableAsyncGen(0,
      async (acc: number, val: number,) => acc + val, array,);

    expect((await generator.next()).value,).toBe(0,); // Initial value
    expect((await generator.next()).value,).toBe(1,); // After processing 1
    expect((await generator.next()).value,).toBe(3,); // After processing 2
    expect((await generator.next()).value,).toBe(6,); // After processing 3
    expect((await generator.next()).done,).toBe(true,);
  });

  test('works with async iterables', async () => {
    async function* asyncSource() {
      yield 1;
      yield 2;
      yield 3;
    }

    const generator = reduceIterableAsyncGen(0,
      async (acc: number, val: number,) => acc + val, asyncSource(),);

    const results: any[] = [];
    for await (const value of generator)
      results.push(value,);

    expect(results,).toEqual([0, 1, 3, 6,],);
  });

  test('processes elements in sequence', async () => {
    const array = [1, 2, 3,];
    const operations: string[] = [];

    const generator = reduceIterableAsyncGen(0, async (acc: number, val: number,) => {
      operations.push(`Processing ${val}`,);
      return acc + val;
    }, array,);

    // Consume the generator
    for await (const _ of generator) {
      /* consume */
    }

    expect(operations,).toEqual(['Processing 1', 'Processing 2', 'Processing 3',],);
  });
},);
