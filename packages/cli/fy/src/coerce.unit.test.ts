import {
  describe,
  expect,
  test,
} from 'bun:test';

import { coerceArg, } from './coerce.ts';

describe('coerceArg', () => {
  //region Numeric coercion

  test('coerces integer string to number', () => {
    expect(coerceArg({ arg: '42', },),).toBe(42,);
  });

  test('coerces negative integer string to number', () => {
    expect(coerceArg({ arg: '-7', },),).toBe(-7,);
  });

  test('coerces float string to number', () => {
    expect(coerceArg({ arg: '3.14', },),).toBe(3.14,);
  });

  test('coerces zero to number', () => {
    expect(coerceArg({ arg: '0', },),).toBe(0,);
  });

  //endregion Numeric coercion

  //region Boolean and null coercion

  test('coerces "true" to boolean true', () => {
    expect(coerceArg({ arg: 'true', },),).toBe(true,);
  });

  test('coerces "false" to boolean false', () => {
    expect(coerceArg({ arg: 'false', },),).toBe(false,);
  });

  test('coerces "null" to null', () => {
    expect(coerceArg({ arg: 'null', },),).toBeNull();
  });

  //endregion Boolean and null coercion

  //region Structured value coercion

  test('coerces JSON array string to array', () => {
    expect(coerceArg({ arg: '[1,2,3]', },),).toEqual([1, 2, 3,],);
  });

  test('coerces JSON object string to object', () => {
    expect(coerceArg({ arg: '{"a":1}', },),).toEqual({ a: 1, },);
  });

  test('coerces JSON string literal to string value', () => {
    expect(coerceArg({ arg: '"hello"', },),).toBe('hello',);
  });

  //endregion Structured value coercion

  //region String fallback

  test('falls back to raw string for non-JSON text', () => {
    expect(coerceArg({ arg: 'hello', },),).toBe('hello',);
  });

  test('falls back to raw string for path-like values', () => {
    expect(coerceArg({ arg: '/tmp/test', },),).toBe('/tmp/test',);
  });

  test('falls back to raw string for incomplete JSON', () => {
    expect(coerceArg({ arg: '{broken', },),).toBe('{broken',);
  });

  test('preserves empty string', () => {
    expect(coerceArg({ arg: '', },),).toBe('',);
  });

  //endregion String fallback
});
