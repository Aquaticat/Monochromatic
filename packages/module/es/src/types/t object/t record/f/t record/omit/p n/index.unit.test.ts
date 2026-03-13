import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  expectTypeOf,
  test,
} from 'bun:test';

const {$} = types.object.record.from.record.omit.named;

describe($, () => {
  test('omits specified keys from object', () => {
    const user = { id: 1, name: 'Alice', password: 'secret', };
    const result = $({ original: user, toOmit: new Set(['password',] as const,), },);

    expect(result,).toEqual({ id: 1, name: 'Alice', },);
  });

  test('returns full object when omitting no keys', () => {
    const user = { id: 1, name: 'Alice', };
    const result = $({ original: user, toOmit: new Set<never>(), },);

    expect(result,).toEqual({ id: 1, name: 'Alice', },);
  });

  test('returns empty object when omitting all keys', () => {
    const user = { id: 1, name: 'Alice', };
    const result = $({ original: user, toOmit: new Set(['id', 'name',] as const,), },);

    expect(result,).toEqual({},);
  });

  test('handles symbol keys', () => {
    const symKey = Symbol('secret');
    const obj = { id: 1, [symKey]: 'hidden', };
    const result = $({ original: obj, toOmit: new Set([symKey,] as const,), },);

    expect(result,).toEqual({ id: 1, },);
    expect(Object.getOwnPropertySymbols(result,),).toEqual([],);
  });

  test('handles numeric keys', () => {
    const obj = { 0: 'zero', 1: 'one', 2: 'two', };
    const result = $({ original: obj, toOmit: new Set([1,] as const,), },);

    expect(result,).toEqual({ 0: 'zero', 2: 'two', },);
  });

  test('throws when omitting non-existent key', () => {
    const user = { id: 1, name: 'Alice', };
    expect(() => $({
      original: user,
      // @ts-expect-error -- intentionally passing non-existent key to test runtime error
      toOmit: new Set(['nonexistent',] as const,),
    },),).toThrow('Key not found in iterable: nonexistent',);
  });

  test('preserves non-omitted value types in result', () => {
    const original = { id: 1, name: 'Alice', active: true, } as const;
    const result = $({ original, toOmit: new Set(['active',] as const,), },);

    expect(result,).toHaveProperty('id',);
    expect(result,).toHaveProperty('name',);
    expectTypeOf(result,).toEqualTypeOf<Omit<typeof original, 'active'>>();
    expectTypeOf(result.id,).toEqualTypeOf<1>();
    expectTypeOf(result.name,).toEqualTypeOf<'Alice'>();
  });

  test('type narrows correctly to Omit type', () => {
    const original = { a: 1, b: 'two', c: true, };
    const result = $({ original, toOmit: new Set(['b',] as const,), },);

    expect(result,).toHaveProperty('a',);
    expect(result,).toHaveProperty('c',);
    expect(result,).not.toHaveProperty('b',);
  });

  test('handles mixed key types', () => {
    const symKey = Symbol('sym');
    const obj = { str: 'string', 42: 'numeric', [symKey]: 'symbol', other: 'keep', };
    const result = $({ original: obj, toOmit: new Set(['str', 42, symKey,] as const,), },);

    expect(result,).toEqual({ other: 'keep', },);
    expect(Object.getOwnPropertySymbols(result,),).toEqual([],);
  });
},);
