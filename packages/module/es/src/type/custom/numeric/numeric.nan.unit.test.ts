import {
  isNan,
  isNonNanNumber,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

describe(isNan, () => {
  test('should return true for NaN', () => {
    expect(isNan(Number.NaN,),).toBe(true,);
    expect(isNan(Number.NaN,),).toBe(true,);
  });

  test('should return false for non-NaN values', () => {
    expect(isNan(0,),).toBe(false,);
    expect(isNan(42,),).toBe(false,);
    expect(isNan(Infinity,),).toBe(false,);
    expect(isNan(-Infinity,),).toBe(false,);
    expect(isNan('NaN',),).toBe(false,);
    expect(isNan(null,),).toBe(false,);
  });
},);

describe(isNonNanNumber, () => {
  test('should return true for numbers that are not NaN', () => {
    expect(isNonNanNumber(0,),).toBe(true,);
    expect(isNonNanNumber(42,),).toBe(true,);
    expect(isNonNanNumber(-1,),).toBe(true,);
    expect(isNonNanNumber(3.14,),).toBe(true,);
    expect(isNonNanNumber(Infinity,),).toBe(true,);
    expect(isNonNanNumber(-Infinity,),).toBe(true,);
  });

  test('should return false for NaN and non-numbers', () => {
    expect(isNonNanNumber(Number.NaN,),).toBe(false,);
    expect(isNonNanNumber('42',),).toBe(false,);
    expect(isNonNanNumber(null,),).toBe(false,);
    expect(isNonNanNumber(undefined,),).toBe(false,);
  });
},);
