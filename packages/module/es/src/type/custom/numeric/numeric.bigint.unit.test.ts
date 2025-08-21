import {
  isBigint,
  isNumeric,

  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe(isBigint, () => {
  test('returns true for bigint values', () => {
    expect(isBigint(0n,),).toBe(true,);
    expect(isBigint(1n,),).toBe(true,);
    expect(isBigint(-1n,),).toBe(true,);
    expect(isBigint(BigInt(Number.MAX_SAFE_INTEGER,) + 1n,),).toBe(true,);
  });

  test('returns false for non-bigint values', () => {
    expect(isBigint(0,),).toBe(false,);
    expect(isBigint(1,),).toBe(false,);
    expect(isBigint(-1,),).toBe(false,);
    expect(isBigint(null,),).toBe(false,);
    expect(isBigint(undefined,),).toBe(false,);
    expect(isBigint('',),).toBe(false,);
    expect(isBigint('0',),).toBe(false,);
    expect(isBigint({},),).toBe(false,);
    expect(isBigint([],),).toBe(false,);
    expect(isBigint(() => {
      // No-op
    },),)
      .toBe(false,);
    expect(isBigint(Symbol('empty',),),).toBe(false,);
    expect(isBigint(Number.NaN,),).toBe(false,);
    expect(isBigint(Infinity,),).toBe(false,);
  });
},);

describe(isNumeric, () => {
  test('returns true for number values', () => {
    expect(isNumeric(0,),).toBe(true,);
    expect(isNumeric(1,),).toBe(true,);
    expect(isNumeric(-1,),).toBe(true,);
    expect(isNumeric(1.5,),).toBe(true,);
    expect(isNumeric(Number.MAX_SAFE_INTEGER,),).toBe(true,);
    expect(isNumeric(Number.MIN_SAFE_INTEGER,),).toBe(true,);
    expect(isNumeric(Infinity,),).toBe(true,);
    expect(isNumeric(-Infinity,),).toBe(true,);
    expect(isNumeric(Number.NaN,),).toBe(true,);
  });

  test('returns true for bigint values', () => {
    expect(isNumeric(0n,),).toBe(true,);
    expect(isNumeric(1n,),).toBe(true,);
    expect(isNumeric(-1n,),).toBe(true,);
    expect(isNumeric(BigInt(Number.MAX_SAFE_INTEGER,) + 1n,),).toBe(true,);
  });

  test('returns false for non-numeric values', () => {
    expect(isNumeric(null,),).toBe(false,);
    expect(isNumeric(undefined,),).toBe(false,);
    expect(isNumeric('',),).toBe(false,);
    expect(isNumeric('0',),).toBe(false,);
    expect(isNumeric('1',),).toBe(false,);
    expect(isNumeric('1.5',),).toBe(false,);
    expect(isNumeric({},),).toBe(false,);
    expect(isNumeric([],),).toBe(false,);
    expect(isNumeric(() => {
      // No-op
    },),)
      .toBe(false,);
    expect(isNumeric(Symbol('empty',),),).toBe(false,);
    expect(isNumeric(new Date(),),).toBe(false,);
    expect(isNumeric(true,),).toBe(false,);
    expect(isNumeric(false,),).toBe(false,);
  });

  test('correctly identifies numeric values in mixed arrays', () => {
    const mixedArray = [1, '2', 3n, 4.5, null, undefined, {}, [], true,];
    const numericValues = mixedArray.filter(isNumeric,);
    expect(numericValues,).toEqual([1, 3n, 4.5,],);
  });

  test('works with edge cases', () => {
    // noinspection DivideByZeroJS
    expect(isNumeric(0 / 0,),).toBe(true,); // NaN
    // noinspection DivideByZeroJS
    expect(isNumeric(1 / 0,),).toBe(true,); // Infinity
    expect(isNumeric(Number.MAX_VALUE,),).toBe(true,);
    expect(isNumeric(Number.MIN_VALUE,),).toBe(true,);
    expect(isNumeric(-0,),).toBe(true,);
    expect(isNumeric(new Object(0,),),).toBe(false,); // Number object
    expect(isNumeric(new Object(1n,),),).toBe(false,); // BigInt object
  });
},);