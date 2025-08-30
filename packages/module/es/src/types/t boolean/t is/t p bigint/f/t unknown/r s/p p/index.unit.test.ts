import {
  describe,
  expect,
  test,
} from 'vitest';

// TODO: import from package.
import { $ as isBigint, } from './index.ts';

describe(isBigint, () => {
  test('returns true for bigint values', () => {
    expect(isBigint(0n,),).toBe(true,);
    expect(isBigint(1n,),).toBe(true,);
    expect(isBigint(-1n,),).toBe(true,);
    expect(isBigint(BigInt(Number.MAX_SAFE_INTEGER,) + 1n,),).toBe(true,);
    expect(isBigint(BigInt(Number.MIN_SAFE_INTEGER,) - 1n,),).toBe(true,);
    expect(isBigint(BigInt('123456789012345678901234567890',),),).toBe(true,);
  });

  test('returns false for non-bigint values', () => {
    expect(isBigint(0,),).toBe(false,);
    expect(isBigint(1,),).toBe(false,);
    expect(isBigint(-1,),).toBe(false,);
    expect(isBigint(Number.NaN,),).toBe(false,);
    expect(isBigint(Infinity,),).toBe(false,);
    expect(isBigint(-Infinity,),).toBe(false,);
    expect(isBigint(null,),).toBe(false,);
    expect(isBigint(undefined,),).toBe(false,);
    expect(isBigint('',),).toBe(false,);
    expect(isBigint('0',),).toBe(false,);
    expect(isBigint('123n',),).toBe(false,);
    expect(isBigint({},),).toBe(false,);
    expect(isBigint([],),).toBe(false,);
    expect(isBigint(() => {},),).toBe(false,);
    expect(isBigint(Symbol('test',),),).toBe(false,);
    expect(isBigint(true,),).toBe(false,);
    expect(isBigint(false,),).toBe(false,);
  });
},);
