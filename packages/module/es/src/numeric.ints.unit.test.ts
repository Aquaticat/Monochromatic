import {
  type Ints,
  type IntsToExclusive,
  ints,
  intsToExclusive,

  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  expectTypeOf,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe('Ints', () => {
  test('should generate correct ranges for positive integers', () => {
    expectTypeOf<Ints<0, 3>>().toEqualTypeOf<0 | 1 | 2 | 3>();
    expectTypeOf<Ints<1, 5>>().toEqualTypeOf<1 | 2 | 3 | 4 | 5>();
    expectTypeOf<Ints<5, 7>>().toEqualTypeOf<5 | 6 | 7>();
  });

  test('should generate correct ranges for negative integers', () => {
    expectTypeOf<Ints<-3, -1>>().toEqualTypeOf<-3 | -2 | -1>();
    expectTypeOf<Ints<-5, -3>>().toEqualTypeOf<-5 | -4 | -3>();
    expectTypeOf<Ints<-2, 0>>().toEqualTypeOf<-2 | -1 | 0>();
  });

  test('should generate correct ranges crossing zero', () => {
    expectTypeOf<Ints<-2, 2>>().toEqualTypeOf<-2 | -1 | 0 | 1 | 2>();
    expectTypeOf<Ints<-1, 1>>().toEqualTypeOf<-1 | 0 | 1>();
    expectTypeOf<Ints<-3, 1>>().toEqualTypeOf<-3 | -2 | -1 | 0 | 1>();
  });

  test('should handle single value ranges', () => {
    expectTypeOf<Ints<5, 5>>().toEqualTypeOf<5>();
    expectTypeOf<Ints<0, 0>>().toEqualTypeOf<0>();
    expectTypeOf<Ints<-3, -3>>().toEqualTypeOf<-3>();
  });

  test('should handle boundary values within supported range', () => {
    expectTypeOf<Ints<-10, -10>>().toEqualTypeOf<-10>();
    expectTypeOf<Ints<10, 10>>().toEqualTypeOf<10>();
    expectTypeOf<Ints<-10, 10>>().toEqualTypeOf<-10 | -9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10>();
  });

  test('should return number for ranges outside supported bounds', () => {
    expectTypeOf<Ints<0, 15>>().toEqualTypeOf<number>();
    expectTypeOf<Ints<-15, 0>>().toEqualTypeOf<number>();
    expectTypeOf<Ints<11, 20>>().toEqualTypeOf<number>();
  });
});

describe('IntsToExclusive', () => {
  test('should generate correct ranges excluding the end value', () => {
    expectTypeOf<IntsToExclusive<0, 3>>().toEqualTypeOf<0 | 1 | 2>();
    expectTypeOf<IntsToExclusive<1, 5>>().toEqualTypeOf<1 | 2 | 3 | 4>();
    expectTypeOf<IntsToExclusive<-2, 1>>().toEqualTypeOf<-2 | -1 | 0>();
  });

  test('should return never for equal from and to values', () => {
    expectTypeOf<IntsToExclusive<5, 5>>().toEqualTypeOf<never>();
    expectTypeOf<IntsToExclusive<0, 0>>().toEqualTypeOf<never>();
    expectTypeOf<IntsToExclusive<-3, -3>>().toEqualTypeOf<never>();
  });

  test('should handle negative ranges correctly', () => {
    expectTypeOf<IntsToExclusive<-5, -2>>().toEqualTypeOf<-5 | -4 | -3>();
    expectTypeOf<IntsToExclusive<-3, 0>>().toEqualTypeOf<-3 | -2 | -1>();
  });

  test('should handle single-element ranges', () => {
    expectTypeOf<IntsToExclusive<0, 1>>().toEqualTypeOf<0>();
    expectTypeOf<IntsToExclusive<-1, 0>>().toEqualTypeOf<-1>();
    expectTypeOf<IntsToExclusive<5, 6>>().toEqualTypeOf<5>();
  });

  test('should return number for ranges outside supported bounds', () => {
    expectTypeOf<IntsToExclusive<0, 15>>().toEqualTypeOf<number>();
    expectTypeOf<IntsToExclusive<-15, 0>>().toEqualTypeOf<number>();
    expectTypeOf<IntsToExclusive<11, 20>>().toEqualTypeOf<number>();
  });
});

describe('ints() runtime function', () => {
  describe('happy path scenarios', () => {
    test('should generate array for positive integer ranges', () => {
      expect(ints(0, 3)).toEqual([0, 1, 2, 3]);
      expect(ints(1, 5)).toEqual([1, 2, 3, 4, 5]);
      expect(ints(5, 7)).toEqual([5, 6, 7]);
    });

    test('should generate array for negative integer ranges', () => {
      expect(ints(-3, -1)).toEqual([-3, -2, -1]);
      expect(ints(-5, -3)).toEqual([-5, -4, -3]);
      expect(ints(-2, 0)).toEqual([-2, -1, 0]);
    });

    test('should generate array for ranges crossing zero', () => {
      expect(ints(-2, 2)).toEqual([-2, -1, 0, 1, 2]);
      expect(ints(-1, 1)).toEqual([-1, 0, 1]);
      expect(ints(-3, 1)).toEqual([-3, -2, -1, 0, 1]);
    });

    test('should handle single value ranges', () => {
      expect(ints(5, 5)).toEqual([5]);
      expect(ints(0, 0)).toEqual([0]);
      expect(ints(-3, -3)).toEqual([-3]);
    });

    test('should handle boundary values within supported range', () => {
      expect(ints(-10, -10)).toEqual([-10]);
      expect(ints(10, 10)).toEqual([10]);

      const fullRange = ints(-10, 10);
      expect(fullRange).toHaveLength(21);
      expect(fullRange[0]).toBe(-10);
      expect(fullRange[20]).toBe(10);
      expect(fullRange).toEqual([-10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    test('should handle ranges outside type system bounds', () => {
      const largeRange = ints(0, 15);
      expect(largeRange).toHaveLength(16);
      expect(largeRange[0]).toBe(0);
      expect(largeRange[15]).toBe(15);
      expect(largeRange).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

      const negativeRange = ints(-15, 0);
      expect(negativeRange).toHaveLength(16);
      expect(negativeRange[0]).toBe(-15);
      expect(negativeRange[15]).toBe(0);
    });

    test('should generate arrays with correct length', () => {
      expect(ints(0, 3)).toHaveLength(4);
      expect(ints(-2, 2)).toHaveLength(5);
      expect(ints(5, 5)).toHaveLength(1);
      expect(ints(1, 10)).toHaveLength(10);
    });

    test('should generate arrays in ascending order', () => {
      const result = ints(-5, 5);
      for (let index = 1; index < result.length; index++) {
        expect(result[index]).toBe(result[index - 1] + 1);
      }
    });
  });

  describe('error scenarios', () => {
    test('should throw RangeError when toInclusive < fromInclusive', () => {
      expect(() => ints(3, 1)).toThrow(RangeError);
      expect(() => ints(3, 1)).toThrow('toInclusive < fromInclusive');

      expect(() => ints(0, -1)).toThrow(RangeError);
      expect(() => ints(5, 2)).toThrow(RangeError);
      expect(() => ints(10, -10)).toThrow(RangeError);
    });
  });
});

describe('intsToExclusive() runtime function', () => {
  describe('happy path scenarios', () => {
    test('should generate array excluding end value for positive ranges', () => {
      expect(intsToExclusive(0, 3)).toEqual([0, 1, 2]);
      expect(intsToExclusive(1, 5)).toEqual([1, 2, 3, 4]);
      expect(intsToExclusive(5, 7)).toEqual([5, 6]);
    });

    test('should generate array excluding end value for negative ranges', () => {
      expect(intsToExclusive(-5, -2)).toEqual([-5, -4, -3]);
      expect(intsToExclusive(-3, 0)).toEqual([-3, -2, -1]);
      expect(intsToExclusive(-2, 1)).toEqual([-2, -1, 0]);
    });

    test('should generate array for ranges crossing zero', () => {
      expect(intsToExclusive(-2, 2)).toEqual([-2, -1, 0, 1]);
      expect(intsToExclusive(-1, 1)).toEqual([-1, 0]);
      expect(intsToExclusive(-3, 1)).toEqual([-3, -2, -1, 0]);
    });

    test('should handle single-element ranges', () => {
      expect(intsToExclusive(0, 1)).toEqual([0]);
      expect(intsToExclusive(-1, 0)).toEqual([-1]);
      expect(intsToExclusive(5, 6)).toEqual([5]);
    });

    test('should handle boundary values within supported range', () => {
      expect(intsToExclusive(-10, -9)).toEqual([-10]);
      expect(intsToExclusive(9, 10)).toEqual([9]);

      const fullRange = intsToExclusive(-10, 11);
      expect(fullRange).toHaveLength(21);
      expect(fullRange[0]).toBe(-10);
      expect(fullRange[20]).toBe(10);
      expect(fullRange).toEqual([-10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    });

    test('should handle ranges outside type system bounds', () => {
      const largeRange = intsToExclusive(0, 16);
      expect(largeRange).toHaveLength(16);
      expect(largeRange[0]).toBe(0);
      expect(largeRange[15]).toBe(15);
      expect(largeRange).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);

      const negativeRange = intsToExclusive(-15, 1);
      expect(negativeRange).toHaveLength(16);
      expect(negativeRange[0]).toBe(-15);
      expect(negativeRange[15]).toBe(0);
    });

    test('should generate arrays with correct length', () => {
      expect(intsToExclusive(0, 3)).toHaveLength(3);
      expect(intsToExclusive(-2, 2)).toHaveLength(4);
      expect(intsToExclusive(5, 6)).toHaveLength(1);
      expect(intsToExclusive(1, 11)).toHaveLength(10);
    });

    test('should generate arrays in ascending order', () => {
      const result = intsToExclusive(-5, 6);
      for (let index = 1; index < result.length; index++) {
        expect(result[index]).toBe(result[index - 1] + 1);
      }
    });
  });

  describe('error scenarios', () => {
    test('should throw RangeError when toExclusive <= fromInclusive', () => {
      expect(() => intsToExclusive(3, 1)).toThrow(RangeError);
      expect(() => intsToExclusive(3, 1)).toThrow('toExclusive <= fromInclusive');

      expect(() => intsToExclusive(5, 5)).toThrow(RangeError);
      expect(() => intsToExclusive(5, 5)).toThrow('toExclusive <= fromInclusive');

      expect(() => intsToExclusive(0, -1)).toThrow(RangeError);
      expect(() => intsToExclusive(5, 2)).toThrow(RangeError);
      expect(() => intsToExclusive(10, -10)).toThrow(RangeError);
      expect(() => intsToExclusive(-3, -3)).toThrow(RangeError);
    });
  });
});
