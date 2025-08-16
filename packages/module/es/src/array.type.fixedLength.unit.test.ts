import {
  type ArrayFixedLengthOrNever,
  type ArrayNonFixedLengthOrNever,
  type IsArrayFixedLength,
  type IsTupleArray,
  type TupleArray,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expectTypeOf,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe('ArrayFixedLength', () => {
  test('IsArrayFixedLength', () => {
    expectTypeOf<IsArrayFixedLength<[number, string]>>().toEqualTypeOf<true>();
    expectTypeOf<IsArrayFixedLength<[number]>>().toEqualTypeOf<true>();
    expectTypeOf<IsArrayFixedLength<[number[]]>>().toEqualTypeOf<true>();

    expectTypeOf<IsArrayFixedLength<[...number[]]>>().toEqualTypeOf<false>();
    expectTypeOf<IsArrayFixedLength<[string, ...number[]]>>().toEqualTypeOf<false>();
    expectTypeOf<IsArrayFixedLength<any[]>>().toEqualTypeOf<false>();
  });

  test('ArrayNonFixedLengthOrNever', () => {
    expectTypeOf<ArrayNonFixedLengthOrNever<[number, string]>>().toBeNever();
    expectTypeOf<ArrayNonFixedLengthOrNever<[number]>>().toBeNever();
    expectTypeOf<ArrayNonFixedLengthOrNever<[number[]]>>().toBeNever();

    expectTypeOf<ArrayNonFixedLengthOrNever<[...number[]]>>().toEqualTypeOf<
      [...number[]]
    >();
    expectTypeOf<ArrayNonFixedLengthOrNever<[string, ...number[]]>>().toEqualTypeOf<
      [string, ...number[]]
    >();
    expectTypeOf<ArrayNonFixedLengthOrNever<any[]>>().toEqualTypeOf<any[]>();
  });

  test('ArrayFixedLengthOrNever', () => {
    expectTypeOf<ArrayFixedLengthOrNever<[number, string]>>().toEqualTypeOf<
      [number, string]
    >();
    expectTypeOf<ArrayFixedLengthOrNever<[number]>>().toEqualTypeOf<[number]>();
    expectTypeOf<ArrayFixedLengthOrNever<[number[]]>>().toEqualTypeOf<[number[]]>();

    expectTypeOf<ArrayFixedLengthOrNever<[...number[]]>>().toBeNever();
    expectTypeOf<ArrayFixedLengthOrNever<[string, ...number[]]>>().toBeNever();
    expectTypeOf<ArrayFixedLengthOrNever<any[]>>().toBeNever();
  });
});

describe('TupleArray', () => {
  test('IsTupleArray', () => {
    expectTypeOf<IsTupleArray<[]>>().toEqualTypeOf<true>();
    expectTypeOf<IsTupleArray<[number, string]>>().toEqualTypeOf<true>();
    expectTypeOf<IsTupleArray<[string]>>().toEqualTypeOf<true>();
    expectTypeOf<IsTupleArray<[number, ...string[]]>>().toEqualTypeOf<true>();
    expectTypeOf<IsTupleArray<[number[]]>>().toEqualTypeOf<true>();

    // This technically looks like a tuple, but it doesn't fulfill why we want a tuple sometimes.
    // There's no guarantee of anything inside the structure.
    // Moreover, it's equal to number[].
    // Therefore, the expected value is false.
    expectTypeOf<IsTupleArray<[...number[]]>>().toEqualTypeOf<false>();

    expectTypeOf<IsTupleArray<string[]>>().toEqualTypeOf<false>();
    expectTypeOf<IsTupleArray<any[]>>().toEqualTypeOf<false>();
  });

  test('TupleArray type usage', () => {
    // Test that TupleArray correctly identifies tuple types
    expectTypeOf<[number, string]>().toMatchTypeOf<TupleArray>();
    expectTypeOf<[string]>().toMatchTypeOf<TupleArray>();
    expectTypeOf<[]>().toMatchTypeOf<TupleArray>();
    expectTypeOf<[number, ...string[]]>().toMatchTypeOf<TupleArray>();

    // These should not match TupleArray
    expectTypeOf<string[]>().not.toMatchTypeOf<TupleArray>();
    expectTypeOf<number[]>().not.toMatchTypeOf<TupleArray>();
    expectTypeOf<any[]>().not.toMatchTypeOf<TupleArray>();
  });
});