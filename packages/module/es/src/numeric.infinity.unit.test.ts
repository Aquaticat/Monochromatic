import {
  isInfinity,
  isNegativeInfinity,
  isPositiveInfinity,

  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe(isPositiveInfinity, () => {
  test('should return true for positive infinity', () => {
    expect(isPositiveInfinity(Infinity,),).toBe(true,);
    expect(isPositiveInfinity(Number.POSITIVE_INFINITY,),).toBe(true,);
  });

  test('should return false for non-positive-infinity values', () => {
    expect(isPositiveInfinity(-Infinity,),).toBe(false,);
    expect(isPositiveInfinity(Number.NaN,),).toBe(false,);
    expect(isPositiveInfinity(0,),).toBe(false,);
    expect(isPositiveInfinity(42,),).toBe(false,);
  });
},);

describe(isNegativeInfinity, () => {
  test('should return true for negative infinity', () => {
    expect(isNegativeInfinity(-Infinity,),).toBe(true,);
    expect(isNegativeInfinity(Number.NEGATIVE_INFINITY,),).toBe(true,);
  });

  test('should return false for non-negative-infinity values', () => {
    expect(isNegativeInfinity(Infinity,),).toBe(false,);
    expect(isNegativeInfinity(Number.NaN,),).toBe(false,);
    expect(isNegativeInfinity(0,),).toBe(false,);
    expect(isNegativeInfinity(42,),).toBe(false,);
  });
},);

describe(isInfinity, () => {
  test('should return true for positive and negative infinity', () => {
    expect(isInfinity(Infinity,),).toBe(true,);
    expect(isInfinity(-Infinity,),).toBe(true,); // Will fail due to isNegativeInfinity bug
  });

  test('should return false for non-infinity values', () => {
    expect(isInfinity(Number.NaN,),).toBe(false,);
    expect(isInfinity(0,),).toBe(false,);
    expect(isInfinity(42,),).toBe(false,);
    expect(isInfinity(-42,),).toBe(false,);
    expect(isInfinity(3.14,),).toBe(false,);
  });
},);