// run with
// bun test ./packages/module/es/src/arrayLike.every.bunTest.ts --timeout 50

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
  everyArrayLike,
  everyArrayLikeAsync,
} from './arrayLike.every.ts';

await logtapeConfigure(await logtapeConfiguration());

describe('everyArrayLike', () => {
  describe('Array', () => {
    test('empty', () => {
      // See https://stackoverflow.com/questions/34137250/why-does-array-prototype-every-return-true-on-an-empty-array
      // for why we're expecting truthiness when running every.
      expect(everyArrayLike(Boolean, [])).toBe(true);
    });
    test('one', () => {
      expect(everyArrayLike(Boolean, [1])).toBe(true);
    });
    test('two', () => {
      expect(everyArrayLike(Boolean, [1, 2])).toBe(true);
    });
    test('two[1] - false', () => {
      expect(everyArrayLike(Boolean, [1, 0])).toBe(false);
    });
    test('two[0] - false', () => {
      expect(everyArrayLike(Boolean, [0, 1])).toBe(false);
    });

    // demo of how diff every... and noneFail... is
    // if (element === 999) {throw new RangeError(`999 is not allowed`)}
    // return false;
    // every would not throw an error and return false.
    // noneFail would throw an error for sure.
    test('fail fast - testingFn throws on the last element - false', () => {
      expect(everyArrayLike((element: number) => {
        if (element === 999) { throw new RangeError(`999 is not allowed`); }
        return false;
      }, array0to999))
        .toBe(false);
    });
  });

  describe('Iterable', () => {
    test('empty', () => {
      expect(everyArrayLike(Boolean, (function*() {
        // Intentionally left empty for testing.
      })()))
        .toBe(true);
    });
    test('one', () => {
      expect(everyArrayLike(Boolean, (function*() {
        yield 1;
      })()))
        .toBe(true);
    });
    test('two', () => {
      expect(everyArrayLike(Boolean, (function*() {
        yield 1;
        yield 2;
      })()))
        .toBe(true);
    });
    test('two[1] - false', () => {
      expect(everyArrayLike(Boolean, (function*() {
        yield 1;
        yield 0;
      })()))
        .toBe(false);
    });
    test('two[0] - false', () => {
      expect(everyArrayLike(Boolean, (function*() {
        yield 0;
        yield 1;
      })()))
        .toBe(false);
    });

    test('fail fast - false', () => {
      expect(everyArrayLike((element) => {
        if (element === 999) { throw new RangeError(`999 is not allowed`); }
        return false;
      }, gen0to999()))
        .toBe(false);
    });

    test('iterable throws - fail fast - false', () => {
      expect(everyArrayLike(() => false, gen0to999error()))
        .toBe(false);
    });
  });
});

describe('everyArrayLikeAsync', () => {
  describe('Array', () => {
    test('empty', () => {
      // See https://stackoverflow.com/questions/34137250/why-does-array-prototype-every-return-true-on-an-empty-array
      // for why we're expecting truthiness when running every.
      expect(everyArrayLikeAsync(Boolean, [])).resolves.toBe(true);
    });
    test('one', () => {
      expect(everyArrayLikeAsync(Boolean, [1])).resolves.toBe(true);
    });
    test('two', () => {
      expect(everyArrayLikeAsync(Boolean, [1, 2])).resolves.toBe(true);
    });
    test('two[1] - false', () => {
      expect(everyArrayLikeAsync(Boolean, [1, 0])).resolves.toBe(false);
    });
    test('two[0] - false', () => {
      expect(everyArrayLikeAsync(Boolean, [0, 1])).resolves.toBe(false);
    });

    // demo of how diff every... and noneFail... is
    // if (element === 999) {throw new RangeError(`999 is not allowed`)}
    // return false;
    // every would not throw an error and return false.
    // noneFail would throw an error for sure.
    test('fail fast - testingFn throws on the last element - false', () => {
      expect(everyArrayLikeAsync((element: number) => {
        if (element === 999) { throw new RangeError(`999 is not allowed`); }
        return false;
      }, array0to999))
        .resolves
        .toBe(false);
    });
    // MAYBE: Add timeLimit-ed tests.

    test.todo('fail fast - testingFn takes too long on some elements - false', () => {
      expect(everyArrayLikeAsync(async (element: number) => {
        if (element <= 100) {
          await wait(1);
          return true;
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
    test('empty', () => {
      expect(everyArrayLikeAsync(Boolean, (function*() {
        // Intentionally left empty for testing.
      })()))
        .resolves
        .toBe(true);
    });
    test('one', () => {
      expect(everyArrayLikeAsync(Boolean, (function*() {
        yield 1;
      })()))
        .resolves
        .toBe(true);
    });
    test('two', () => {
      expect(everyArrayLikeAsync(Boolean, (function*() {
        yield 1;
        yield 2;
      })()))
        .resolves
        .toBe(true);
    });
    test('two[1] - false', () => {
      expect(everyArrayLikeAsync(Boolean, (function*() {
        yield 1;
        yield 0;
      })()))
        .resolves
        .toBe(false);
    });
    test('two[0] - false', () => {
      expect(everyArrayLikeAsync(Boolean, (function*() {
        yield 0;
        yield 1;
      })()))
        .resolves
        .toBe(false);
    });

    test('fail fast - false', () => {
      expect(everyArrayLikeAsync((element) => {
        if (element === 999) { throw new RangeError(`999 is not allowed`); }
        return false;
      }, gen0to999()))
        .resolves
        .toBe(false);
    });

    test('iterable throws - fail fast - false', () => {
      expect(everyArrayLikeAsync(() => false, gen0to999error()))
        .resolves
        .toBe(false);
    });
  });

  describe('AsyncIterable', () => {
    test('empty', () => {
      expect(everyArrayLikeAsync(Boolean, (async function*() {
        // Intentionally left empty for testing.
      })()))
        .resolves
        .toBe(true);
    });
    test('one', () => {
      expect(everyArrayLikeAsync(Boolean, (async function*() {
        yield 1;
      })()))
        .resolves
        .toBe(true);
    });
    test('two', () => {
      expect(everyArrayLikeAsync(Boolean, (async function*() {
        yield 1;
        yield 2;
      })()))
        .resolves
        .toBe(true);
    });
    test('two[1] - false', () => {
      expect(everyArrayLikeAsync(Boolean, (async function*() {
        yield 1;
        yield 0;
      })()))
        .resolves
        .toBe(false);
    });
    test('two[0] - false', () => {
      expect(everyArrayLikeAsync(Boolean, (async function*() {
        yield 0;
        yield 1;
      })()))
        .resolves
        .toBe(false);
    });

    test('fail fast - false', () => {
      expect(everyArrayLikeAsync((element) => {
        if (element === 999) { throw new RangeError(`999 is not allowed`); }
        return false;
      }, gen0to999Async()))
        .resolves
        .toBe(false);
    });

    test('iterable throws - fail fast - false', () => {
      expect(everyArrayLikeAsync(() => false, gen0to999errorAsync()))
        .resolves
        .toBe(false);
    });

    test('fail fast - false && fast', () => {
      expect(everyArrayLikeAsync((element) => {
        if (element === 999) { throw new RangeError(`999 is not allowed`); }
        return false;
      }, gen0to999AsyncSlow()))
        .resolves
        .toBe(false);
    });

    test('iterable throws - fail fast - false', () => {
      expect(everyArrayLikeAsync(() => false, gen0to999errorAsyncSlow()))
        .resolves
        .toBe(false);
    });
  });
});
