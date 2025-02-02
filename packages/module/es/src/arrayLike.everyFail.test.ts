// run with
// bun test ./packages/module/es/src/arrayLike.everyFail.bunTest.ts --timeout 50

import {
  array0to999,
  gen0to999,
  gen0to999Async,
  gen0to999AsyncSlow,
  gen0to999error,
  gen0to999errorAsync,
  gen0to999errorAsyncSlow,
  logtapeConfiguration,
  logtapeConfigure,
  wait,
} from '@monochromatic-dev/module-es/ts';
import {
  describe,
  expect,
  test,
} from 'bun:test';
import {
  everyFailArrayLike,
  everyFailArrayLikeAsync,
} from './arrayLike.everyFail.ts';

await logtapeConfigure(logtapeConfiguration());

describe('everyFailArrayLike', () => {
  describe('Array', () => {
    test('empty', () => {
      // See https://stackoverflow.com/questions/34137250/why-does-array-prototype-every-return-true-on-an-empty-array
      // for why we're expecting truthiness when running every.
      expect(everyFailArrayLike(Boolean, [])).toBe(true);
    });
    test('one', () => {
      expect(everyFailArrayLike(Boolean, [1])).toBe(false);
    });
    test('two', () => {
      expect(everyFailArrayLike(Boolean, [1, 2])).toBe(false);
    });
    test('two[1] - false', () => {
      expect(everyFailArrayLike(Boolean, [1, 0])).toBe(false);
    });
    test('two[0] - false', () => {
      expect(everyFailArrayLike(Boolean, [0, 1])).toBe(false);
    });

    // demo of how diff every... and noneFail... is
    // if (element === 999) {throw new RangeError(`999 is not allowed`)}
    // return false;
    // every would not throw an error and return false.
    // noneFail would throw an error for sure.
    test('fail fast - testingFn throws on the last element - false', () => {
      expect(() => {
        everyFailArrayLike((element: number) => {
          if (element === 999) { throw new RangeError(`999 is not allowed`); }
          return false;
        }, array0to999);
      })
        .toThrow('999 is not allowed');
    });
  });

  describe('Iterable', () => {
    test('empty', () => {
      expect(everyFailArrayLike(Boolean, (function*() {
        // Intentionally left empty for testing.
      })()))
        .toBe(true);
    });
    test('one', () => {
      expect(everyFailArrayLike(Boolean, (function*() {
        yield 1;
      })()))
        .toBe(false);
    });
    test('two', () => {
      expect(everyFailArrayLike(Boolean, (function*() {
        yield 1;
        yield 2;
      })()))
        .toBe(false);
    });
    test('two[1] - false', () => {
      expect(everyFailArrayLike(Boolean, (function*() {
        yield 1;
        yield 0;
      })()))
        .toBe(false);
    });
    test('two[0] - false', () => {
      expect(everyFailArrayLike(Boolean, (function*() {
        yield 0;
        yield 1;
      })()))
        .toBe(false);
    });

    test('fail fast - testingFn throws on the last element - false', () => {
      expect(() => {
        everyFailArrayLike((element: number) => {
          if (element === 999) { throw new RangeError(`999 is not allowed`); }
          return false;
        }, gen0to999());
      })
        .toThrow('999 is not allowed');
    });

    test('iterable throws - fail fast - false', () => {
      expect(() => {
        everyFailArrayLike(() => false, gen0to999error());
      })
        .toThrow();
    });
  });
});

describe('everyFailArrayLikeAsync', () => {
  describe('Array', () => {
    test('empty', async () => {
      // See https://stackoverflow.com/questions/34137250/why-does-array-prototype-every-return-true-on-an-empty-array
      // for why we're expecting truthiness when running every.
      await expect(everyFailArrayLikeAsync(Boolean, [])).resolves.toBe(true);
    });
    test('one', async () => {
      await expect(everyFailArrayLikeAsync(Boolean, [1])).resolves.toBe(false);
    });
    test('two', async () => {
      await expect(everyFailArrayLikeAsync(Boolean, [1, 2])).resolves.toBe(false);
    });
    test('two[1] - false', async () => {
      await expect(everyFailArrayLikeAsync(Boolean, [1, 0])).resolves.toBe(false);
    });
    test('two[0] - false', async () => {
      await expect(everyFailArrayLikeAsync(Boolean, [0, 1])).resolves.toBe(false);
    });

    // demo of how diff every... and noneFail... is
    // if (element === 999) {throw new RangeError(`999 is not allowed`)}
    // return false;
    // every would not throw an error and return false.
    // noneFail would throw an error for sure.
    test('fail fast - testingFn throws on the last element - false', async () => {
      await expect(everyFailArrayLikeAsync((element: number) => {
        if (element === 999) { throw new RangeError(`999 is not allowed`); }
        return false;
      }, array0to999))
        .rejects
        .toThrowError('999 is not allowed');
    });
    // MAYBE: Add timeLimit-ed tests.

    test.todo('fail fast - testingFn takes too long on some elements - false', async () => {
      await expect(everyFailArrayLikeAsync(async (element: number) => {
        if (element <= 100) {
          await wait(1);
          return false;
        }
        if (element < 999) {
          return true;
        }
        return false;
      }, array0to999))
        .resolves
        .toBe(false);
    });
  });

  describe('Iterable', () => {
    test('empty', async () => {
      await expect(everyFailArrayLikeAsync(Boolean, (function*() {
        // Intentionally left empty for testing.
      })()))
        .resolves
        .toBe(true);
    });
    test('one', async () => {
      await expect(everyFailArrayLikeAsync(Boolean, (function*() {
        yield 1;
      })()))
        .resolves
        .toBe(false);
    });
    test('two', async () => {
      await expect(everyFailArrayLikeAsync(Boolean, (function*() {
        yield 1;
        yield 2;
      })()))
        .resolves
        .toBe(false);
    });
    test('two[1] - false', async () => {
      await expect(everyFailArrayLikeAsync(Boolean, (function*() {
        yield 1;
        yield 0;
      })()))
        .resolves
        .toBe(false);
    });
    test('two[0] - false', async () => {
      await expect(everyFailArrayLikeAsync(Boolean, (function*() {
        yield 0;
        yield 1;
      })()))
        .resolves
        .toBe(false);
    });

    test('fail fast - false', async () => {
      await expect(everyFailArrayLikeAsync((element) => {
        if (element === 999) { throw new RangeError(`999 is not allowed`); }
        return false;
      }, gen0to999()))
        .rejects
        .toThrowError('999 is not allowed');
    });

    test('iterable throws - fail fast - false', async () => {
      await expect(everyFailArrayLikeAsync(() => false, gen0to999error()))
        .rejects
        .toThrowError();
    });
  });

  describe('AsyncIterable', () => {
    test('empty', async () => {
      await expect(everyFailArrayLikeAsync(Boolean, (async function*() {
        // Intentionally left empty for testing.
      })()))
        .resolves
        .toBe(true);
    });
    test('one', async () => {
      await expect(everyFailArrayLikeAsync(Boolean, (async function*() {
        yield 1;
      })()))
        .resolves
        .toBe(false);
    });
    test('two', async () => {
      await expect(everyFailArrayLikeAsync(Boolean, (async function*() {
        yield 1;
        yield 2;
      })()))
        .resolves
        .toBe(false);
    });
    test('two[1] - false', async () => {
      await expect(everyFailArrayLikeAsync(Boolean, (async function*() {
        yield 1;
        yield 0;
      })()))
        .resolves
        .toBe(false);
    });
    test('two[0] - false', async () => {
      await expect(everyFailArrayLikeAsync(Boolean, (async function*() {
        yield 0;
        yield 1;
      })()))
        .resolves
        .toBe(false);
    });

    test('fail fast - false', async () => {
      await expect(everyFailArrayLikeAsync((element) => {
        if (element === 999) { throw new RangeError(`999 is not allowed`); }
        return false;
      }, gen0to999Async()))
        .rejects
        .toThrowError('999 is not allowed');
    });

    test('iterable throws - fail fast - false', async () => {
      await expect(everyFailArrayLikeAsync(() => false, gen0to999errorAsync()))
        .rejects
        .toThrowError();
    });
  });
});
