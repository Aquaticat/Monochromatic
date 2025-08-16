import {
  isFloat,
  isNegativeFloat,
  isPositiveFloat,

  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe(isFloat, () => {
  test('should return true for floating point numbers', () => {
    expect(isFloat(3.14,),).toBe(true,);
    expect(isFloat(-2.5,),).toBe(true,);
    expect(isFloat(0.1,),).toBe(true,);
    expect(isFloat(1.000_000_000_000_1,),).toBe(true,);
  });

  test('should return false for integers, NaN and infinity', () => {
    expect(isFloat(0,),).toBe(false,);
    expect(isFloat(42,),).toBe(false,);
    expect(isFloat(-1,),).toBe(false,);
    expect(isFloat(Number.NaN,),).toBe(false,);
    expect(isFloat(Infinity,),).toBe(false,);
    expect(isFloat(-Infinity,),).toBe(false,);
    expect(isFloat('3.14',),).toBe(false,);
  });
},);

describe(isPositiveFloat, () => {
  test('should return true for positive floating point numbers', () => {
    expect(isPositiveFloat(3.14,),).toBe(true,);
    expect(isPositiveFloat(0.1,),).toBe(true,);
    expect(isPositiveFloat(1.000_000_000_000_1,),).toBe(true,);
  });

  test('should return false for zero, negative floats, integers and non-numbers', () => {
    expect(isPositiveFloat(0,),).toBe(false,);
    expect(isPositiveFloat(-2.5,),).toBe(false,);
    expect(isPositiveFloat(42,),).toBe(false,);
    expect(isPositiveFloat(Number.NaN,),).toBe(false,);
    expect(isPositiveFloat(Infinity,),).toBe(false,);
  });
},);

describe(isNegativeFloat, () => {
  test('should return true for negative floating point numbers', () => {
    expect(isNegativeFloat(-3.14,),).toBe(true,);
    expect(isNegativeFloat(-0.1,),).toBe(true,);
    expect(isNegativeFloat(-1.000_000_000_000_1,),).toBe(true,);
  });

  test('should return false for zero, positive floats, integers and non-numbers', () => {
    expect(isNegativeFloat(0,),).toBe(false,);
    expect(isNegativeFloat(2.5,),).toBe(false,);
    expect(isNegativeFloat(-42,),).toBe(false,);
    expect(isNegativeFloat(Number.NaN,),).toBe(false,);
    expect(isNegativeFloat(-Infinity,),).toBe(false,);
  });
},);