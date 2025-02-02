import {
  array0to999,
  type AssertEmptyArray,
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
  arrayFrom,
  arrayFromAsync,
} from './arrayLike.from.ts';

await logtapeConfigure(logtapeConfiguration());

describe('arrayFrom', () => {
  describe('Array', () => {
    test('empty', () => {
      const arrayFromEmptyArray = arrayFrom([]);
      type _ = AssertEmptyArray<typeof arrayFromEmptyArray>;
      expect(arrayFrom([])).toBe([]);
    });
  });
});
