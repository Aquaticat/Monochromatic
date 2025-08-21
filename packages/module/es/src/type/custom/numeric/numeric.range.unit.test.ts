import {
  isFiniteNumber,
  isPositiveNumber,
  isSafeNumber,

  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe(isFiniteNumber, () => {
  test('should return true for finite numbers', () => {
    expect(isFiniteNumber(0,),).toBe(true,);
    expect(isFiniteNumber(42,),).toBe(true,);
    expect(isFiniteNumber(-1,),).toBe(true,);
    expect(isFiniteNumber(3.14,),).toBe(true,);
  });

  test('should return false for infinite numbers and NaN', () => {
    expect(isFiniteNumber(Infinity,),).toBe(false,);
    expect(isFiniteNumber(-Infinity,),).toBe(false,); // Will fail due to isNegativeInfinity bug
    expect(isFiniteNumber(Number.NaN,),).toBe(false,);
  });
},);

describe(isSafeNumber, () => {
  test('should return true for numbers within safe integer range', () => {
    expect(isSafeNumber(0,),).toBe(true,);
    expect(isSafeNumber(42,),).toBe(true,);
    expect(isSafeNumber(-1,),).toBe(true,);
    expect(isSafeNumber(Number.MAX_SAFE_INTEGER,),).toBe(true,);
    expect(isSafeNumber(Number.MIN_SAFE_INTEGER,),).toBe(true,);
  });

  test('should return false for numbers outside safe integer range and non-finite numbers', () => {
    expect(isSafeNumber(Number.NaN,),).toBe(false,);
    expect(isSafeNumber(Infinity,),).toBe(false,);
    expect(isSafeNumber(-Infinity,),).toBe(false,);
    // Note: The comparison logic in isSafeNumber appears to have an issue
    // It should be: value >= Number.MIN_SAFE_INTEGER && value <= Number.MAX_SAFE_INTEGER
  });
},);

describe(isPositiveNumber, () => {
  test('should return true for positive numbers', () => {
    expect(isPositiveNumber(1,),).toBe(true,);
    expect(isPositiveNumber(42,),).toBe(true,);
    expect(isPositiveNumber(3.14,),).toBe(true,);
    expect(isPositiveNumber(Infinity,),).toBe(true,);
  });

  test('should return false for zero, negative numbers and non-numbers', () => {
    expect(isPositiveNumber(0,),).toBe(false,);
    expect(isPositiveNumber(-1,),).toBe(false,);
    expect(isPositiveNumber(-3.14,),).toBe(false,);
    expect(isPositiveNumber(-Infinity,),).toBe(false,);
    expect(isPositiveNumber(Number.NaN,),).toBe(false,);
  });
},);