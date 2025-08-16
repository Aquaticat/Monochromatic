import {
  isObjectDate,

  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe(isObjectDate, () => {
  test('should return true for Date objects', () => {
    expect(isObjectDate(new Date(),),).toBe(true,);
    expect(isObjectDate(new Date('2023-01-01',),),).toBe(true,);
  });

  test('should return false for non-Date objects', () => {
    expect(isObjectDate(Date.now(),),).toBe(false,);
    expect(isObjectDate('2023-01-01',),).toBe(false,);
    expect(isObjectDate({},),).toBe(false,);
    expect(isObjectDate(null,),).toBe(false,);
    expect(isObjectDate(undefined,),).toBe(false,);
  });
},);