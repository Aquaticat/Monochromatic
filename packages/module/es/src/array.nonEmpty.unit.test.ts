import {
  arrayIsNonEmpty,
  isArrayNonEmpty,
  isNonEmptyArray,
  logtapeConfiguration,
  logtapeConfigure,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration(),);

describe(isNonEmptyArray, () => {
  test('identifies non-empty arrays correctly', () => {
    expect(isNonEmptyArray([1,],),).toBe(true,);
    expect(isNonEmptyArray([null,],),).toBe(true,);
    expect(isNonEmptyArray([undefined,],),).toBe(true,);
    expect(isNonEmptyArray([1, 2, 3,],),).toBe(true,);
    expect(isNonEmptyArray(Array.from({ length: 1, },).fill(0,),),).toBe(true,);
  });

  test('rejects empty arrays and other values', () => {
    expect(isNonEmptyArray([],),).toBe(false,);
    expect(isNonEmptyArray({},),).toBe(false,);
    expect(isNonEmptyArray(null,),).toBe(false,);
    expect(isNonEmptyArray(undefined,),).toBe(false,);
    expect(isNonEmptyArray('string',),).toBe(false,);
  });
},);

describe(isArrayNonEmpty, () => {
  test('identifies non-empty arrays correctly', () => {
    expect(isArrayNonEmpty([1,],),).toBe(true,);
    expect(isArrayNonEmpty([null,],),).toBe(true,);
    expect(isArrayNonEmpty([undefined,],),).toBe(true,);
    expect(isArrayNonEmpty([1, 2, 3,],),).toBe(true,);
    expect(isArrayNonEmpty(Array.from({ length: 1, },).fill(0,),),).toBe(true,);
  });

  test('rejects empty arrays', () => {
    expect(isArrayNonEmpty([],),).toBe(false,);
  });
},);

describe(arrayIsNonEmpty, () => {
  test('identifies non-empty arrays correctly', () => {
    expect(arrayIsNonEmpty([1,],),).toBe(true,);
    expect(arrayIsNonEmpty([null,],),).toBe(true,);
    expect(arrayIsNonEmpty([undefined,],),).toBe(true,);
    expect(arrayIsNonEmpty([1, 2, 3,],),).toBe(true,);
    expect(arrayIsNonEmpty(Array.from({ length: 1, },).fill(0,),),).toBe(true,);
  });

  test('rejects empty arrays', () => {
    expect(arrayIsNonEmpty([],),).toBe(false,);
  });
},);
