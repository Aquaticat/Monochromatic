import { types, } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  expectTypeOf,
  test,
} from 'bun:test';

const $ = types.object.record.from.record.pick.named.$;

describe($, () => {
  test('picks specified keys from object', () => {
    const user = { id: 1, name: 'Alice', password: 'secret', };
    const result = $({ original: user, toPick: new Set(['id', 'name',] as const,), },);

    expect(result,).toEqual({ id: 1, name: 'Alice', },);
  });

  test('returns empty object when picking no keys', () => {
    const user = { id: 1, name: 'Alice', };
    const result = $({ original: user, toPick: new Set<never>(), },);

    expect(result,).toEqual({},);
  });

  test('returns full object when picking all keys', () => {
    const user = { id: 1, name: 'Alice', };
    const result = $({ original: user, toPick: new Set(['id', 'name',] as const,), },);

    expect(result,).toEqual({ id: 1, name: 'Alice', },);
  });

  test('throws when picking non-existent key', () => {
    const user = { id: 1, name: 'Alice', };
    expect(() => $({
      original: user,
      toPick: new Set(['id', 'nonexistent',] as const,),
    },),).toThrow('Key not found in iterable: nonexistent',);
  });

  test('handles symbol keys', () => {
    const symKey = Symbol('secret');
    const obj = { id: 1, [symKey]: 'hidden', };
    const result = $({ original: obj, toPick: new Set([symKey,] as const,), },);

    expect(result,).toEqual({ [symKey]: 'hidden', },);
  });

  test('handles numeric keys', () => {
    const obj = { 0: 'zero', 1: 'one', 2: 'two', };
    const result = $({ original: obj, toPick: new Set([0, 2,] as const,), },);

    expect(result,).toEqual({ 0: 'zero', 2: 'two', },);
  });

  test('preserves value types in result', () => {
    const original = { id: 1, name: 'Alice', active: true, } as const;
    const result = $({ original, toPick: new Set(['id', 'name',] as const,), },);

    expect(result,).toHaveProperty('id',);
    expect(result,).toHaveProperty('name',);
    expectTypeOf(result,).toEqualTypeOf<Pick<typeof original, 'id' | 'name'>>();
    expectTypeOf(result.id,).toEqualTypeOf<1>();
    expectTypeOf(result.name,).toEqualTypeOf<'Alice'>();
  });

  test('type narrows correctly to Pick type', () => {
    const original = { a: 1, b: 'two', c: true, };
    const result = $({ original, toPick: new Set(['a', 'c',] as const,), },);

    expect(result,).toHaveProperty('a',);
    expect(result,).toHaveProperty('c',);
    expect(result,).not.toHaveProperty('b',);
  });

  test('handles mixed key types', () => {
    const symKey = Symbol('sym');
    const obj = { str: 'string', 42: 'numeric', [symKey]: 'symbol', };
    const result = $({ original: obj, toPick: new Set(['str', 42, symKey,] as const,), },);

    expect(result,).toEqual({ str: 'string', 42: 'numeric', [symKey]: 'symbol', },);
  });
},);
