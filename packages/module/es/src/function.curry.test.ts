import {
  curry,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es/ts';
import {
  describe,
  expect,
  test,
} from 'bun:test';

await logtapeConfigure(await logtapeConfiguration());

describe('curry', () => {
  describe('normal', () => {
    test('empty', () => {
      expect(() => {
        curry(function empty() {
          return;
        });
      })
        .toThrow();
    });
    test('one', () => {
      expect(() => {
        curry(function one(a: number): number {
          return a;
        });
      })
        .toThrow();
    });
    test('two', () => {
      expect(curry(function two(a: number, b: number): number {
        return a + b;
      })(1)(2))
        .toBe(3);
    });
    test('ten', () => {
      expect(
        curry(
          function ten(a: number, b: number, c: number, d: number, e: number, f: number,
            g: number, h: number, i: number, j: number): number
          {
            return a + b + c + d + e + f + g + h + i + j;
          },
        )(1)(2)(3)(4)(5)(6)(7)(8)(9)(10),
      )
        .toBe(55);
    });
    test('eleven', () => {
      expect(() => {
        curry(
          // @ts-expect-error Testing
          function eleven(a: number, b: number, c: number, d: number, e: number,
            f: number, g: number, h: number, i: number, j: number, k: number): number
          {
            return a + b + c + d + e + f + g + h + i + j + k;
          },
        );
      })
        .toThrow();
    });
  });
});
