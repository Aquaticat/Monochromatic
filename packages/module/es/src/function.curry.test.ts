import {
  curry,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es/ts';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe('curry', () => {
  describe('error cases', () => {
    test('throws for function with 0 parameters', () => {
      expect(() => {
        curry(function empty() {
          return 42;
        });
      })
        .toThrow(RangeError);
    });

    test('throws for function with 1 parameter', () => {
      expect(() => {
        curry(function one(a: number): number {
          return a;
        });
      })
        .toThrow(RangeError);
    });

    test('throws for function with more than 10 parameters', () => {
      expect(() => {
        curry(
          // @ts-expect-error Testing with 11 parameters
          function eleven(a: number, b: number, c: number, d: number, e: number,
            f: number, g: number, h: number, i: number, j: number, k: number): number
          {
            return a + b + c + d + e + f + g + h + i + j + k;
          },
        );
      })
        .toThrow(RangeError);
    });
  });

  describe('with 2 parameters', () => {
    test('curries addition function', () => {
      const add = function(a: number, b: number): number {
        return a + b;
      };
      const curriedAdd = curry(add);

      expect(curriedAdd(1)(2)).toBe(3);

      // Test partial application
      const addOne = curriedAdd(1);
      expect(addOne(5)).toBe(6);
      expect(addOne(10)).toBe(11);
    });

    test('curries string concatenation', () => {
      const concat = function(a: string, b: string): string {
        return a + b;
      };
      const curriedConcat = curry(concat);

      expect(curriedConcat('Hello, ')('World!')).toBe('Hello, World!');

      const greet = curriedConcat('Hello, ');
      expect(greet('Alice')).toBe('Hello, Alice');
      expect(greet('Bob')).toBe('Hello, Bob');
    });
  });

  describe('with 3 parameters', () => {
    test('curries three parameter function', () => {
      const addThree = function(a: number, b: number, c: number): number {
        return a + b + c;
      };
      const curriedAddThree = curry(addThree);

      expect(curriedAddThree(1)(2)(3)).toBe(6);

      const addOneAndTwo = curriedAddThree(1)(2);
      expect(addOneAndTwo(3)).toBe(6);
      expect(addOneAndTwo(10)).toBe(13);
    });
  });

  describe('with 4 parameters', () => {
    test('curries four parameter function', () => {
      const addFour = function(a: number, b: number, c: number, d: number): number {
        return a + b + c + d;
      };
      const curriedAddFour = curry(addFour);

      expect(curriedAddFour(1)(2)(3)(4)).toBe(10);

      const addOneToThree = curriedAddFour(1)(2)(3);
      expect(addOneToThree(4)).toBe(10);
      expect(addOneToThree(10)).toBe(16);
    });
  });

  describe('with 5 parameters', () => {
    test('curries five parameter function', () => {
      const addFive = function(a: number, b: number, c: number, d: number,
        e: number): number
      {
        return a + b + c + d + e;
      };
      const curriedAddFive = curry(addFive);

      expect(curriedAddFive(1)(2)(3)(4)(5)).toBe(15);
    });
  });

  describe('with 6 parameters', () => {
    test('curries six parameter function', () => {
      const addSix = function(a: number, b: number, c: number, d: number, e: number,
        f: number): number
      {
        return a + b + c + d + e + f;
      };
      const curriedAddSix = curry(addSix);

      expect(curriedAddSix(1)(2)(3)(4)(5)(6)).toBe(21);
    });
  });

  describe('with 7 parameters', () => {
    test('curries seven parameter function', () => {
      const addSeven = function(a: number, b: number, c: number, d: number, e: number,
        f: number, g: number): number
      {
        return a + b + c + d + e + f + g;
      };
      const curriedAddSeven = curry(addSeven);

      expect(curriedAddSeven(1)(2)(3)(4)(5)(6)(7)).toBe(28);
    });
  });

  describe('with 8 parameters', () => {
    test('curries eight parameter function', () => {
      const addEight = function(a: number, b: number, c: number, d: number, e: number,
        f: number, g: number, h: number): number
      {
        return a + b + c + d + e + f + g + h;
      };
      const curriedAddEight = curry(addEight);

      expect(curriedAddEight(1)(2)(3)(4)(5)(6)(7)(8)).toBe(36);
    });
  });

  describe('with 9 parameters', () => {
    test('curries nine parameter function', () => {
      const addNine = function(a: number, b: number, c: number, d: number, e: number,
        f: number, g: number, h: number, i: number): number
      {
        return a + b + c + d + e + f + g + h + i;
      };
      const curriedAddNine = curry(addNine);

      expect(curriedAddNine(1)(2)(3)(4)(5)(6)(7)(8)(9)).toBe(45);
    });
  });

  describe('with 10 parameters', () => {
    test('curries ten parameter function', () => {
      const addTen = function(a: number, b: number, c: number, d: number, e: number,
        f: number, g: number, h: number, i: number, j: number): number
      {
        return a + b + c + d + e + f + g + h + i + j;
      };
      const curriedAddTen = curry(addTen);

      expect(curriedAddTen(1)(2)(3)(4)(5)(6)(7)(8)(9)(10)).toBe(55);
    });
  });

  describe('with different return types', () => {
    test('curries function returning boolean', () => {
      const isGreaterThan = function(a: number, b: number): boolean {
        return a > b;
      };
      const curriedIsGreaterThan = curry(isGreaterThan);

      expect(curriedIsGreaterThan(5)(3)).toBe(true);
      expect(curriedIsGreaterThan(5)(10)).toBe(false);

      const isGreaterThanFive = curriedIsGreaterThan(5);
      expect(isGreaterThanFive(3)).toBe(true);
      expect(isGreaterThanFive(10)).toBe(false);
    });

    test('curries function returning object', () => {
      const createPerson = function(name: string,
        age: number): { name: string; age: number; }
      {
        return { name, age };
      };
      const curriedCreatePerson = curry(createPerson);

      expect(curriedCreatePerson('Alice')(30)).toEqual({ name: 'Alice', age: 30 });

      const createAlice = curriedCreatePerson('Alice');
      expect(createAlice(25)).toEqual({ name: 'Alice', age: 25 });
      expect(createAlice(40)).toEqual({ name: 'Alice', age: 40 });
    });
  });
});
