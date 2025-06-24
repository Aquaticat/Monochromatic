import {
  joinStrings,
  joinStringsAsync,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es/.js';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe(joinStrings, () => {
  test('joins array of strings with separator', () => {
    const strings = ['a', 'b', 'c'];
    expect(joinStrings('-', strings)).toBe('a-b-c');
  });

  test('joins iterable of strings with separator', () => {
    const strings = new Set(['a', 'b', 'c']);
    expect(joinStrings(':', strings)).toBe('a:b:c');
  });

  test('returns empty string for empty array', () => {
    expect(joinStrings(',', [])).toBe('');
  });

  test('returns empty string for empty iterable', () => {
    expect(joinStrings(',', new Set())).toBe('');
  });

  test('works with single element', () => {
    expect(joinStrings('-', ['single'])).toBe('single');
  });
});

describe(joinStringsAsync, () => {
  test('joins array of strings with separator', async () => {
    const strings = ['a', 'b', 'c'];
    expect(await joinStringsAsync('-', strings)).toBe('a-b-c');
  });

  test('joins async iterable of strings with separator', async () => {
    // Create an async iterable
    const asyncIterable = {
      async *[Symbol.asyncIterator]() {
        yield 'a';
        yield 'b';
        yield 'c';
      },
    };
    expect(await joinStringsAsync(':', asyncIterable)).toBe('a:b:c');
  });

  test('returns empty string for empty array', async () => {
    expect(await joinStringsAsync(',', [])).toBe('');
  });

  test('returns empty string for empty async iterable', async () => {
    const emptyAsyncIterable = {
      async *[Symbol.asyncIterator]() {
        // Yields nothing
      },
    };
    expect(await joinStringsAsync(',', emptyAsyncIterable)).toBe('');
  });

  test('works with single element async iterable', async () => {
    const singleAsyncIterable = {
      async *[Symbol.asyncIterator]() {
        yield 'single';
      },
    };
    expect(await joinStringsAsync('-', singleAsyncIterable)).toBe('single');
  });
});
