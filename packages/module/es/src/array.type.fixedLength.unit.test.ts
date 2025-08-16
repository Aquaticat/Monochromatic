import {
  type ArrayFixedLengthOrNever,
  type ArrayNonFixedLengthOrNever,
  type IsArrayFixedLength,
  type IsTupleArray,
  logtapeConfiguration,
  logtapeConfigure,
  type TupleArray,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expectTypeOf,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration(),);

describe('ArrayFixedLength', () => {
  test('IsTupleArray', () => {
    expectTypeOf<IsTupleArray<[number, string,]>>().toEqualTypeOf<true>();
    expectTypeOf<IsTupleArray<readonly [number, string,]>>().toEqualTypeOf<true>();
    expectTypeOf<IsTupleArray<[]>>().toEqualTypeOf<true>();
    expectTypeOf<IsTupleArray<readonly []>>().toEqualTypeOf<true>();
    expectTypeOf<IsTupleArray<number[]>>().toEqualTypeOf<false>();
    expectTypeOf<IsTupleArray<readonly number[]>>().toEqualTypeOf<false>();
    expectTypeOf<IsTupleArray<string>>().toEqualTypeOf<false>();
    expectTypeOf<IsTupleArray<null>>().toEqualTypeOf<false>();
  });

  test('TupleArray', () => {
    expectTypeOf<TupleArray<[number, string,]>>().toExtend<readonly [number, string,]>();
    expectTypeOf<TupleArray<readonly [number, string,]>>().toExtend<
      readonly [number, string,]
    >();
    expectTypeOf<TupleArray<[number,]>>().toExtend<readonly [number,]>();
    expectTypeOf<TupleArray<number[]>>().toEqualTypeOf<never>();
    expectTypeOf<TupleArray<readonly number[]>>().toEqualTypeOf<never>();
    expectTypeOf<TupleArray<string>>().toEqualTypeOf<never>();
  });

  test('ArrayNonFixedLengthOrNever', () => {
    expectTypeOf<ArrayNonFixedLengthOrNever<number[]>>().toExtend<number[]>();
    expectTypeOf<ArrayNonFixedLengthOrNever<readonly number[]>>().toExtend<
      readonly number[]
    >();
    expectTypeOf<ArrayNonFixedLengthOrNever<[number, string,]>>().toEqualTypeOf<never>();
    expectTypeOf<ArrayNonFixedLengthOrNever<readonly [number, string,]>>().toEqualTypeOf<
      never
    >();
    expectTypeOf<ArrayNonFixedLengthOrNever<[]>>().toEqualTypeOf<never>();
    expectTypeOf<ArrayNonFixedLengthOrNever<string>>().toEqualTypeOf<never>();
  });

  test('ArrayFixedLengthOrNever', () => {
    expectTypeOf<ArrayFixedLengthOrNever<[number, string,]>>().toExtend<
      readonly [number, string,]
    >();
    expectTypeOf<ArrayFixedLengthOrNever<readonly [number, string,]>>().toExtend<
      readonly [number, string,]
    >();
    expectTypeOf<ArrayFixedLengthOrNever<[]>>().toExtend<readonly []>();
    expectTypeOf<ArrayFixedLengthOrNever<readonly []>>().toExtend<readonly []>();
    expectTypeOf<ArrayFixedLengthOrNever<number[]>>().toEqualTypeOf<never>();
    expectTypeOf<ArrayFixedLengthOrNever<readonly number[]>>().toEqualTypeOf<never>();
    expectTypeOf<ArrayFixedLengthOrNever<string>>().toEqualTypeOf<never>();
  });

  test('IsArrayFixedLength', () => {
    expectTypeOf<IsArrayFixedLength<[number, string,]>>().toEqualTypeOf<true>();
    expectTypeOf<IsArrayFixedLength<readonly [number, string,]>>().toEqualTypeOf<true>();
    expectTypeOf<IsArrayFixedLength<[]>>().toEqualTypeOf<true>();
    expectTypeOf<IsArrayFixedLength<readonly []>>().toEqualTypeOf<true>();
    expectTypeOf<IsArrayFixedLength<number[]>>().toEqualTypeOf<false>();
    expectTypeOf<IsArrayFixedLength<readonly number[]>>().toEqualTypeOf<false>();
    expectTypeOf<IsArrayFixedLength<string>>().toEqualTypeOf<false>();
    expectTypeOf<IsArrayFixedLength<null>>().toEqualTypeOf<false>();
  });
});
