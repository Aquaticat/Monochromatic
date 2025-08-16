import {
  isInt,
  isNegativeInt,
  isNonNegativeInt,
  isPositiveInt,

  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe(isInt, () => {
  test('should return true for integers', () => {
    expect(isInt(0,),).toBe(true,);
    expect(isInt(42,),).toBe(true,);
    expect(isInt(-1,),).toBe(true,);
    expect(isInt(Number.MAX_SAFE_INTEGER,),).toBe(true,);
    expect(isInt(Number.MIN_SAFE_INTEGER,),).toBe(true,);

    // isInt should behave identically
    expect(isInt(0,),).toBe(true,);
    expect(isInt(42,),).toBe(true,);
    expect(isInt(-1,),).toBe(true,);
  });

  test('should return false for non-integers', () => {
    expect(isInt(3.14,),).toBe(false,);
    expect(isInt(Number.NaN,),).toBe(false,);
    expect(isInt(Infinity,),).toBe(false,);
    expect(isInt(-Infinity,),).toBe(false,);
    expect(isInt('42',),).toBe(false,);

    // isInt should behave identically
    expect(isInt(3.14,),).toBe(false,);
    expect(isInt(Number.NaN,),).toBe(false,);
    expect(isInt(Infinity,),).toBe(false,);
  });
},);

describe(isPositiveInt, () => {
  test('should return true for positive integers', () => {
    expect(isPositiveInt(1,),).toBe(true,);
    expect(isPositiveInt(42,),).toBe(true,);
    expect(isPositiveInt(Number.MAX_SAFE_INTEGER,),).toBe(true,);
  });

  test('should return false for zero, negative integers and non-integers', () => {
    expect(isPositiveInt(0,),).toBe(false,);
    expect(isPositiveInt(-1,),).toBe(false,);
    expect(isPositiveInt(-42,),).toBe(false,);
    expect(isPositiveInt(3.14,),).toBe(false,);
    expect(isPositiveInt(Number.NaN,),).toBe(false,);
    expect(isPositiveInt(Infinity,),).toBe(false,);
  });
},);

describe(isNonNegativeInt, () => {
  test('should return true for positive integers', () => {
    expect(isNonNegativeInt(1,),).toBe(true,);
    expect(isNonNegativeInt(42,),).toBe(true,);
    expect(isNonNegativeInt(Number.MAX_SAFE_INTEGER,),).toBe(true,);
    expect(isNonNegativeInt(0,),).toBe(true,);
  });

  test('should return false for negative integers and non-integers', () => {
    expect(isNonNegativeInt(-1,),).toBe(false,);
    expect(isNonNegativeInt(-42,),).toBe(false,);
    expect(isNonNegativeInt(3.14,),).toBe(false,);
    expect(isNonNegativeInt(Number.NaN,),).toBe(false,);
    expect(isNonNegativeInt(Infinity,),).toBe(false,);
  });
},);

describe(isNegativeInt, () => {
  test('should return true for negative integers', () => {
    expect(isNegativeInt(-1,),).toBe(true,);
    expect(isNegativeInt(-42,),).toBe(true,);
    expect(isNegativeInt(Number.MIN_SAFE_INTEGER,),).toBe(true,);
  });

  test('should return false for zero, positive integers and non-integers', () => {
    expect(isNegativeInt(0,),).toBe(false,);
    expect(isNegativeInt(1,),).toBe(false,);
    expect(isNegativeInt(42,),).toBe(false,);
    expect(isNegativeInt(-3.14,),).toBe(false,);
    expect(isNegativeInt(Number.NaN,),).toBe(false,);
    expect(isNegativeInt(-Infinity,),).toBe(false,);
  });
},);