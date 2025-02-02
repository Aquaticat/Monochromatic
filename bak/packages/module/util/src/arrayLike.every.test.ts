import { configure } from '@logtape/logtape';
import {
  logtapeConfiguration,
  suite,
  test,
} from '@monochromatic-dev/module-util/ts';
import {
  everyArrayLikeAsync,
  noneFailArrayLikeAsync,
} from './arrayLike.every.ts';
import {
  assertFalse,
  assertThrowRangeErrorAsync,
  assertTrue,
} from './error.ts';
import {
  array0to999,
  gen0to999,
  gen0to999Async,
  gen0to999AsyncSlow,
  gen0to999error,
  gen0to999errorAsync,
  gen0to999errorAsyncSlow,
} from './fixture.ts';

await configure(logtapeConfiguration());

suite('everyArrayLikeAsync', [
  suite('Array', [
    test('empty', async () => {
      // See https://stackoverflow.com/questions/34137250/why-does-array-prototype-every-return-true-on-an-empty-array
      // for why we're expecting truthiness when running every.
      assertTrue(await everyArrayLikeAsync(Boolean, []));
    }),
    test('one', async () => {
      assertTrue(await everyArrayLikeAsync(Boolean, [1]));
    }),
    test('two', async () => {
      assertTrue(await everyArrayLikeAsync(Boolean, [1, 2]));
    }),
    test('two[1] - false', async () => {
      assertFalse(await everyArrayLikeAsync(Boolean, [1, 0]));
    }),
    test('two[0] - false', async () => {
      assertFalse(await everyArrayLikeAsync(Boolean, [0, 1]));
    }),

    // demo of how diff every... and noneFail... is
    // if (element === 999) {throw new RangeError(`999 is not allowed`)}
    // return false;
    // every would probably not throw an error and return false.
    // noneFail would throw an error for sure.
    test('fail fast - false', async () => {
      assertFalse(await everyArrayLikeAsync((element) => {
        if (element === 999) { throw new RangeError(`999 is not allowed`); }
        return false;
      }, array0to999));
    }),
    // MAYBE: Add timeLimit-ed tests.
  ]),

  suite('Iterable', [
    test('empty', async () => {
      assertTrue(await everyArrayLikeAsync(Boolean, (function*() {
        // Intentionally left empty for testing.
      })()));
    }),
    test('one', async () => {
      assertTrue(await everyArrayLikeAsync(Boolean, (function*() {
        yield 1;
      })()));
    }),
    test('two', async () => {
      assertTrue(await everyArrayLikeAsync(Boolean, (function*() {
        yield 1;
        yield 2;
      })()));
    }),
    test('two[1] - false', async () => {
      assertFalse(await everyArrayLikeAsync(Boolean, (function*() {
        yield 1;
        yield 0;
      })()));
    }),
    test('two[0] - false', async () => {
      assertFalse(await everyArrayLikeAsync(Boolean, (function*() {
        yield 0;
        yield 1;
      })()));
    }),

    test('fail fast - false', async () => {
      assertFalse(await everyArrayLikeAsync((element) => {
        if (element === 999) { throw new RangeError(`999 is not allowed`); }
        return false;
      }, gen0to999()));
    }),

    // MAYBE: Add timeLimit-ed tests.

    test('iterable throws - fail fast - false', async () => {
      assertFalse(await everyArrayLikeAsync(() => false, gen0to999error()));
    }),
  ]),

  suite('AsyncIterable', [
    test('empty', async () => {
      assertTrue(await everyArrayLikeAsync(Boolean, (async function*() {
        // Intentionally left empty for testing.
      })()));
    }),
    test('one', async () => {
      assertTrue(await everyArrayLikeAsync(Boolean, (async function*() {
        yield 1;
      })()));
    }),
    test('two', async () => {
      assertTrue(await everyArrayLikeAsync(Boolean, (async function*() {
        yield 1;
        yield 2;
      })()));
    }),
    test('two[1] - false', async () => {
      assertFalse(await everyArrayLikeAsync(Boolean, (async function*() {
        yield 1;
        yield 0;
      })()));
    }),
    test('two[0] - false', async () => {
      assertFalse(await everyArrayLikeAsync(Boolean, (async function*() {
        yield 0;
        yield 1;
      })()));
    }),

    test('fail fast - false', async () => {
      assertFalse(await everyArrayLikeAsync((element) => {
        if (element === 999) { throw new RangeError(`999 is not allowed`); }
        return false;
      }, gen0to999Async()));
    }),

    test('iterable throws - fail fast - false', async () => {
      assertFalse(await everyArrayLikeAsync(() => false, gen0to999errorAsync()));
    }),

    test('fail fast - false && fast', async () => {
      assertFalse(await everyArrayLikeAsync((element) => {
        if (element === 999) { throw new RangeError(`999 is not allowed`); }
        return false;
      }, gen0to999AsyncSlow()));
    }, {
      // Give or take.
      timeLimit: 50,
    }),

    test('iterable throws - fail fast - false', async () => {
      assertFalse(await everyArrayLikeAsync(() => false, gen0to999errorAsyncSlow()));
    }, { timeLimit: 50 }),
  ]),
]);

suite('noneFailArrayLikeAsync', [
  suite('Array', [
    test('empty', async () => {
      assertTrue(await noneFailArrayLikeAsync(Boolean, []));
    }),
    test('one', async () => {
      assertTrue(await noneFailArrayLikeAsync(Boolean, [1]));
    }),
    test('two', async () => {
      assertTrue(await noneFailArrayLikeAsync(Boolean, [1, 2]));
    }),
    test('two[1] - false', async () => {
      assertFalse(await noneFailArrayLikeAsync(Boolean, [1, 0]));
    }),
    test('two[0] - false', async () => {
      assertFalse(await noneFailArrayLikeAsync(Boolean, [0, 1]));
    }),

    // demo of how diff every... and noneFail... is
    // if (element === 999) {throw new RangeError(`999 is not allowed`)}
    // return false;
    // every would probably not throw an error and return false.
    // noneFail would throw an error for sure.
    test('run everything - throw', async () => {
      await assertThrowRangeErrorAsync(async () => {
        await noneFailArrayLikeAsync((element) => {
          if (element === 999) { throw new RangeError(`999 is not allowed`); }
          return false;
        }, array0to999);
      });
    }),
  ]),

  suite('Iterable', [
    test('empty', async () => {
      assertTrue(await noneFailArrayLikeAsync(Boolean, (function*() {
        // Intentionally left empty for testing.
      })()));
    }),
    test('one', async () => {
      assertTrue(await noneFailArrayLikeAsync(Boolean, (function*() {
        yield 1;
      })()));
    }),
    test('two', async () => {
      assertTrue(await noneFailArrayLikeAsync(Boolean, (function*() {
        yield 1;
        yield 2;
      })()));
    }),
    test('two[1] - false', async () => {
      assertFalse(await noneFailArrayLikeAsync(Boolean, (function*() {
        yield 1;
        yield 0;
      })()));
    }),
    test('two[0] - false', async () => {
      assertFalse(await noneFailArrayLikeAsync(Boolean, (function*() {
        yield 0;
        yield 1;
      })()));
    }),

    test('throw', async () => {
      assertThrowRangeErrorAsync(async () => {
        await noneFailArrayLikeAsync((element) => {
          if (element === 999) { throw new RangeError(`999 is not allowed`); }
          return false;
        }, gen0to999());
      });
    }),

    test('iterable throws - throw', async () => {
      assertThrowRangeErrorAsync(async () => {
        await noneFailArrayLikeAsync(() => false, gen0to999error());
      });
    }),
  ]),

  suite('AsyncIterable', [
    test('empty', async () => {
      assertTrue(await noneFailArrayLikeAsync(Boolean, (async function*() {
        // Intentionally left empty for testing.
      })()));
    }),
    test('one', async () => {
      assertTrue(await noneFailArrayLikeAsync(Boolean, (async function*() {
        yield 1;
      })()));
    }),
    test('two', async () => {
      assertTrue(await noneFailArrayLikeAsync(Boolean, (async function*() {
        yield 1;
        yield 2;
      })()));
    }),
    test('two[1] - false', async () => {
      assertFalse(await noneFailArrayLikeAsync(Boolean, (async function*() {
        yield 1;
        yield 0;
      })()));
    }),
    test('two[0] - false', async () => {
      assertFalse(await noneFailArrayLikeAsync(Boolean, (async function*() {
        yield 0;
        yield 1;
      })()));
    }),

    test('throw', async () => {
      assertThrowRangeErrorAsync(async () => {
        await noneFailArrayLikeAsync((element) => {
          if (element === 999) { throw new RangeError(`999 is not allowed`); }
          return false;
        }, gen0to999Async());
      });
    }),

    test('iterable throws - throw', async () => {
      assertThrowRangeErrorAsync(async () => {
        await noneFailArrayLikeAsync(() => false, gen0to999errorAsync());
      });
    }),
  ]),
]);
