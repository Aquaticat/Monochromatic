import {
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es/ts';
import {
  describe,
  expect,
  test,
} from 'vitest';
import {
  equal,
  equalAsync,
} from './boolean.equal.ts';
import {
  equals,
  equalsAsync,
  equalsAsyncOrThrow,
  equalsOrThrow,
} from './function.equals.ts';

await logtapeConfigure(await logtapeConfiguration());

describe('equals', () => {
  test('returns a function that checks equality', () => {
    const isThree = equals(3);
    expect(typeof isThree).toBe('function');
    expect(isThree(3)).toBe(true);
    expect(isThree(4)).toBe(false);
  });

  test('works with primitive values', () => {
    expect(equals('test')('test')).toBe(true);
    expect(equals('test')('other')).toBe(false);
    expect(equals(true)(true)).toBe(true);
    expect(equals(true)(false)).toBe(false);
    expect(equals(null)(null)).toBe(true);
    expect(equals(null)(undefined)).toBe(false);
  });

  test('works with objects', () => {
    const obj = { a: 1 };
    const sameObj = obj;
    const differentObj = { a: 1 };

    expect(equals(obj)(sameObj)).toBe(true);
    // This depends on the implementation of equal
    // If deep equality is implemented, this would be true
    expect(equals(obj)(differentObj)).toBe(equal(obj, differentObj));
  });
});

describe('equalsAsync', () => {
  test('returns a function that checks equality asynchronously', async () => {
    const isThree = equalsAsync(3);
    expect(typeof isThree).toBe('function');
    expect(await isThree(3)).toBe(true);
    expect(await isThree(4)).toBe(false);
  });

  test('works with primitive values', async () => {
    expect(await equalsAsync('test')('test')).toBe(true);
    expect(await equalsAsync('test')('other')).toBe(false);
    expect(await equalsAsync(true)(true)).toBe(true);
    expect(await equalsAsync(true)(false)).toBe(false);
  });

  test('works with objects', async () => {
    const obj = { a: 1 };
    const sameObj = obj;
    const differentObj = { a: 1 };

    expect(await equalsAsync(obj)(sameObj)).toBe(true);
    expect(await equalsAsync(obj)(differentObj)).toBe(
      await equalAsync(obj, differentObj),
    );
  });
});

describe('equalsOrThrow', () => {
  test('returns input when equal', () => {
    const checkIsThree = equalsOrThrow(3);
    expect(checkIsThree(3)).toBe(3);
  });

  test('throws when not equal', () => {
    const checkIsThree = equalsOrThrow(3);
    expect(() => checkIsThree(4)).toThrow(Error);
    expect(() => checkIsThree(4)).toThrow("input 4 isn't equal to 3");
  });

  test('works with objects', () => {
    const obj = { a: 1 };
    const sameObj = obj;
    const differentObj = { a: 1 };

    const checkIsObj = equalsOrThrow(obj);
    expect(checkIsObj(sameObj)).toBe(sameObj);

    // This depends on the implementation of equal
    if (equal(obj, differentObj)) {
      expect(checkIsObj(differentObj)).toBe(differentObj);
    } else {
      expect(() => checkIsObj(differentObj)).toThrow(Error);
    }
  });
});

describe('equalsAsyncOrThrow', () => {
  test('returns input when equal', async () => {
    const checkIsThree = equalsAsyncOrThrow(3);
    expect(await checkIsThree(3)).toBe(3);
  });

  test('throws when not equal', async () => {
    const checkIsThree = equalsAsyncOrThrow(3);
    expect(checkIsThree(4)).rejects.toThrow(Error);
    expect(checkIsThree(4)).rejects.toThrow("input 4 isn't equal to 3");
  });

  test('works with complex types', async () => {
    const obj = { a: 1 };
    const sameObj = obj;
    const differentObj = { a: 1 };

    const checkIsObj = equalsAsyncOrThrow(obj);
    expect(await checkIsObj(sameObj)).toBe(sameObj);

    if (await equalAsync(obj, differentObj)) {
      expect(await checkIsObj(differentObj)).toBe(differentObj);
    } else {
      expect(checkIsObj(differentObj)).rejects.toThrow(Error);
    }
  });
});
