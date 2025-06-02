import {
  logtapeConfiguration,
  logtapeConfigure,
  partial,
} from '@monochromatic-dev/module-es/.js';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe(partial, () => {
  test('partial with 1 argument function', () => {
    const add5 = (x: number): number => x + 5;
    const partialAdd5 = partial(add5, 10);
    expect(partialAdd5()).toBe(15);
  });

  test('partial with 2 argument function', () => {
    const add = (a: number, b: number): number => a + b;

    const add10 = partial(add, 10);
    expect(add10(5)).toBe(15);

    const add10plus20 = partial(add, 10, 20);
    expect(add10plus20()).toBe(30);
  });

  test('partial with 3 argument function', () => {
    const addThree = (a: number, b: number, c: number): number => a + b + c;

    const add10 = partial(addThree, 10);
    expect(add10(5, 15)).toBe(30);

    const add10plus20 = partial(addThree, 10, 20);
    expect(add10plus20(15)).toBe(45);

    const add10plus20plus30 = partial(addThree, 10, 20, 30);
    expect(add10plus20plus30()).toBe(60);
  });

  test('partial with object arguments', () => {
    const mergeObjects = (obj1: object, obj2: object): object => ({ ...obj1, ...obj2 });

    const withDefaults = partial(mergeObjects, { default: true });
    expect(withDefaults({ custom: 'value' })).toEqual({ default: true, custom: 'value' });
  });

  test('partial with array arguments', () => {
    const concatenate = (arr1: string[], arr2: string[]): string[] => [...arr1, ...arr2];

    const withPrefix = partial(concatenate, ['prefix']);
    expect(withPrefix(['item1', 'item2'])).toEqual(['prefix', 'item1', 'item2']);
  });

  test('partial with string arguments', () => {
    const formatName = (first: string, last: string, title: string): string =>
      `${title} ${first} ${last}`;

    const formatDr = partial(formatName, 'John', 'Doe', 'Dr.');
    expect(formatDr()).toBe('Dr. John Doe');

    const formatWithFirst = partial(formatName, 'John');
    expect(formatWithFirst('Doe', 'Mr.')).toBe('Mr. John Doe');
  });

  test('partial preserves function context', () => {
    const obj = {
      multiplier: 2,
      multiply(x: number): number {
        return x * this.multiplier;
      },
    };

    const boundMultiply = obj.multiply.bind(obj);
    const partialMultiply = partial(boundMultiply, 10);
    expect(partialMultiply()).toBe(20);
  });

  test('partial with function returning different type', () => {
    const numberToString = (n: number): string => n.toString();
    const partialNumberToString = partial(numberToString, 42);
    expect(partialNumberToString()).toBe('42');
  });

  test('partial with higher arity functions', () => {
    const sum6 = (a: number, b: number, c: number, d: number, e: number,
      f: number): number => a + b + c + d + e + f;

    const with123 = partial(sum6, 1, 2, 3);
    expect(with123(4, 5, 6)).toBe(21);

    const with12345 = partial(sum6, 1, 2, 3, 4, 5);
    expect(with12345(6)).toBe(21);
  });

  test('nested partial applications', () => {
    const add3 = (a: number, b: number, c: number): number => a + b + c;

    const add10 = partial(add3, 10);
    const add10and20 = partial(add10, 20);

    expect(add10and20(30)).toBe(60);
  });

  test('partial with rest parameters', () => {
    const sumAll = (first: number, ...rest: number[]): number =>
      rest.reduce((sum, num) => sum + num, first);

    const sumStartingWith10 = partial(sumAll, 10);
    expect(sumStartingWith10(20, 30, 40)).toBe(100);
  });

  test('partial with mixed argument types', () => {
    const formatUser = (id: number, name: string, active: boolean): string =>
      `User ${id}: ${name} (${active ? 'active' : 'inactive'})`;

    const formatActiveUser = partial(formatUser, 1, 'John');
    expect(formatActiveUser(true)).toBe('User 1: John (active)');

    const formatJohnDoe = partial(formatUser, 1, 'John', false);
    expect(formatJohnDoe()).toBe('User 1: John (inactive)');
  });
});
