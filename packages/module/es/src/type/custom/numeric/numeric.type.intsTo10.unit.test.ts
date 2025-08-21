import {
  type Ints0to10,
  type Ints1to10,
  type IntsNegative10to0,
  type IntsNegative10to1,
  type IntsNegative10to10,
  type IntsNegative10toNegative1,
  type IntsNegative1to10,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expectTypeOf,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration(),);

describe('IntsNegative10toNegative1', () => {
  test('should contain all negative integers from -10 to -1', () => {
    expectTypeOf<IntsNegative10toNegative1>().toEqualTypeOf<
      -10 | -9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1
    >();
  });

  test('should be assignable to specific negative values', () => {
    expectTypeOf<-10>().toExtend<IntsNegative10toNegative1>();
    expectTypeOf<-5>().toExtend<IntsNegative10toNegative1>();
    expectTypeOf<-1>().toExtend<IntsNegative10toNegative1>();
  });
});

describe('IntsNegative10to0', () => {
  test('should contain all integers from -10 to 0', () => {
    expectTypeOf<IntsNegative10to0>().toEqualTypeOf<
      -10 | -9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0
    >();
  });

  test('should be assignable to specific values in range', () => {
    expectTypeOf<-10>().toExtend<IntsNegative10to0>();
    expectTypeOf<-3>().toExtend<IntsNegative10to0>();
    expectTypeOf<0>().toExtend<IntsNegative10to0>();
  });
});

describe('IntsNegative10to1', () => {
  test('should contain all integers from -10 to 1', () => {
    expectTypeOf<IntsNegative10to1>().toEqualTypeOf<
      -10 | -9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1
    >();
  });

  test('should be assignable to specific values in range', () => {
    expectTypeOf<-10>().toExtend<IntsNegative10to1>();
    expectTypeOf<0>().toExtend<IntsNegative10to1>();
    expectTypeOf<1>().toExtend<IntsNegative10to1>();
  });
});

describe('IntsNegative10to10', () => {
  test('should contain all integers from -10 to 10', () => {
    expectTypeOf<IntsNegative10to10>().toEqualTypeOf<
      -10 | -9 | -8 | -7 | -6 | -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8
        | 9 | 10
    >();
  });

  test('should be assignable to specific values in range', () => {
    expectTypeOf<-10>().toExtend<IntsNegative10to10>();
    expectTypeOf<0>().toExtend<IntsNegative10to10>();
    expectTypeOf<5>().toExtend<IntsNegative10to10>();
    expectTypeOf<10>().toExtend<IntsNegative10to10>();
  });
});

describe('IntsNegative1to10', () => {
  test('should contain all integers from -1 to 10', () => {
    expectTypeOf<IntsNegative1to10>().toEqualTypeOf<
      -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10
    >();
  });

  test('should be assignable to specific values in range', () => {
    expectTypeOf<-1>().toExtend<IntsNegative1to10>();
    expectTypeOf<0>().toExtend<IntsNegative1to10>();
    expectTypeOf<5>().toExtend<IntsNegative1to10>();
    expectTypeOf<10>().toExtend<IntsNegative1to10>();
  });
});

describe('Ints0to10', () => {
  test('should contain all integers from 0 to 10', () => {
    expectTypeOf<Ints0to10>().toEqualTypeOf<0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10>();
  });

  test('should be assignable to specific values in range', () => {
    expectTypeOf<0>().toExtend<Ints0to10>();
    expectTypeOf<5>().toExtend<Ints0to10>();
    expectTypeOf<10>().toExtend<Ints0to10>();
  });

  test('should be useful for ratings and progress indicators', () => {
    const rating: Ints0to10 = 8;
    const progress: Ints0to10 = 0;
    expectTypeOf(rating).toExtend<Ints0to10>();
    expectTypeOf(progress).toExtend<Ints0to10>();
  });
});

describe('Ints1to10', () => {
  test('should contain all positive integers from 1 to 10', () => {
    expectTypeOf<Ints1to10>().toEqualTypeOf<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10>();
  });

  test('should be assignable to specific values in range', () => {
    expectTypeOf<1>().toExtend<Ints1to10>();
    expectTypeOf<5>().toExtend<Ints1to10>();
    expectTypeOf<10>().toExtend<Ints1to10>();
  });

  test('should be useful for positive-only scenarios', () => {
    const playerLevel: Ints1to10 = 5;
    const maxLevel: Ints1to10 = 10;
    expectTypeOf(playerLevel).toExtend<Ints1to10>();
    expectTypeOf(maxLevel).toExtend<Ints1to10>();
  });
});
