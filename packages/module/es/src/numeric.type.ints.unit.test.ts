import {
  type Ints,
  type IntsToExclusive,

  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
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