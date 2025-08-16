import { isNumber, } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

describe(isNumber, () => {
  test('should return true for numbers', () => {
    expect(isNumber(0,),).toBe(true,);
    expect(isNumber(42,),).toBe(true,);
    expect(isNumber(-1,),).toBe(true,);
    expect(isNumber(3.14,),).toBe(true,);
    expect(isNumber(Number.NaN,),).toBe(true,);
    expect(isNumber(Infinity,),).toBe(true,);
    expect(isNumber(-Infinity,),).toBe(true,);
  });

  test('should return false for non-numbers', () => {
    expect(isNumber('42',),).toBe(false,);
    expect(isNumber(null,),).toBe(false,);
    expect(isNumber(undefined,),).toBe(false,);
    expect(isNumber({},),).toBe(false,);
    expect(isNumber([],),).toBe(false,);
    expect(isNumber(true,),).toBe(false,);
    expect(isNumber(new Date(),),).toBe(false,);
  });
},);
