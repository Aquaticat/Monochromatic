import {
  constant,
  echo,
  identity,
  logtapeConfiguration,
  logtapeConfigure,
  toExport,
  typeOf,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration());

describe(identity, () => {
  test('returns primitive values unchanged', () => {
    expect(identity(5)).toBe(5);
    expect(identity('test')).toBe('test');
    expect(identity(true)).toBe(true);
    expect(identity(null)).toBe(null);
    expect(identity(undefined)).toBe(undefined);
  });

  test('returns objects unchanged', () => {
    const obj = { a: 1, b: 2 };
    expect(identity(obj)).toBe(obj);
  });

  test('returns arrays unchanged', () => {
    const arr = [1, 2, 3];
    expect(identity(arr)).toBe(arr);
  });
});

describe(constant, () => {
  test('returns a function that returns the original value', () => {
    const fn = constant(5) as () => number;
    expect(typeof fn).toBe('function');
    expect(fn()).toBe(5);
  });

  test('works with primitive values', () => {
    const stringFn = constant('test') as () => string;
    const boolFn = constant(true) as () => boolean;
    const nullFn = constant(null) as () => null;

    expect(stringFn()).toBe('test');
    expect(boolFn()).toBe(true);
    expect(nullFn()).toBe(null);
  });

  test('works with objects', () => {
    const obj = { a: 1, b: 2 };
    const fn = constant(obj) as () => typeof obj;
    expect(fn()).toBe(obj);
  });

  test('works with arrays', () => {
    const arr = [1, 2, 3];
    const fn = constant(arr) as () => typeof arr;
    expect(fn()).toBe(arr);
  });
});

describe(echo, () => {
  test('yields the same value repeatedly', () => {
    const generator = echo(5);

    expect(generator.next().value).toBe(5);
    expect(generator.next().value).toBe(5);
    expect(generator.next().value).toBe(5);
  });

  test('works with primitive values', () => {
    const stringGen = echo('test');
    const boolGen = echo(true);
    const nullGen = echo(null);

    expect(stringGen.next().value).toBe('test');
    expect(boolGen.next().value).toBe(true);
    expect(nullGen.next().value).toBe(null);
  });

  test('works with objects', () => {
    const obj = { a: 1, b: 2 };
    const generator = echo(obj);

    expect(generator.next().value).toBe(obj);
    expect(generator.next().value).toBe(obj);
  });

  test('works with arrays', () => {
    const arr = [1, 2, 3];
    const generator = echo(arr);

    expect(generator.next().value).toBe(arr);
    expect(generator.next().value).toBe(arr);
  });

  test('generator never completes', () => {
    const generator = echo(5);

    for (let i = 0; i < 10; i++) {
      const result = generator.next();
      expect(result.done).toBe(false);
      expect(result.value).toBe(5);
    }
  });
});

describe(typeOf, () => {
  test('identifies null', () => {
    expect(typeOf(null)).toBe('null');
  });

  test('identifies undefined', () => {
    expect(typeOf(undefined)).toBe('undefined');
  });

  test('identifies NaN', () => {
    expect(typeOf(Number.NaN)).toBe('NaN');
  });

  test('identifies numbers', () => {
    expect(typeOf(0)).toBe('number');
    expect(typeOf(42)).toBe('number');
    expect(typeOf(-1.5)).toBe('number');
    expect(typeOf(Infinity)).toBe('number');
  });

  test('identifies booleans', () => {
    expect(typeOf(true)).toBe('boolean');
    expect(typeOf(false)).toBe('boolean');
  });

  test('identifies bigint', () => {
    expect(typeOf(BigInt(123))).toBe('bigint');
    expect(typeOf(0n)).toBe('bigint');
  });

  test('identifies symbols', () => {
    expect(typeOf(Symbol('test'))).toBe('symbol');
    expect(typeOf(Symbol.for('test'))).toBe('symbol');
  });

  test('identifies strings', () => {
    expect(typeOf('')).toBe('string');
    expect(typeOf('test')).toBe('string');
  });

  test('identifies arrays', () => {
    expect(typeOf([])).toBe('array');
    expect(typeOf([1, 2, 3])).toBe('array');
  });

  test('identifies dates', () => {
    expect(typeOf(new Date())).toBe('date');
  });

  test('identifies sets', () => {
    expect(typeOf(new Set())).toBe('set');
    expect(typeOf(new Set([1, 2, 3]))).toBe('set');
  });

  test('identifies maps', () => {
    expect(typeOf(new Map())).toBe('map');
    expect(typeOf(new Map([['key', 'value']]))).toBe('map');
  });

  test('identifies objects', () => {
    expect(typeOf({})).toBe('object');
    expect(typeOf({ a: 1, b: 2 })).toBe('object');
  });

  test('throws error for unrecognized types', () => {
    // Create a custom object that doesn't stringify to [object Object]
    expect(() => typeOf(Object.create(null))).toThrow(TypeError);
    const customObj = {
      toString() {
        return 'CustomObject';
      },
    };
    expect(() => typeOf(customObj)).toThrow(TypeError);
  });
});

describe(toExport, () => {
  test('throws for null', () => {
    expect(() => toExport(null)).toThrow(TypeError);
  });

  test('throws for undefined', () => {
    expect(() => toExport(undefined)).toThrow(TypeError);
  });

  test('throws for NaN', () => {
    expect(() => toExport(Number.NaN)).toThrow(TypeError);
  });

  test('throws for bigint', () => {
    expect(() => toExport(BigInt(123))).toThrow(TypeError);
  });

  test('throws for symbol', () => {
    expect(() => toExport(Symbol('test'))).toThrow(TypeError);
  });

  test('converts boolean values', () => {
    expect(toExport(true)).toBe('true');
    expect(toExport(false)).toBe('false');
  });

  test('converts number values', () => {
    expect(toExport(42)).toBe('42');
    expect(toExport(-3.14)).toBe('-3.14');
    expect(toExport(Infinity)).toBe('Infinity');
  });

  test('converts string values', () => {
    expect(toExport('hello')).toBe('"hello"');
    expect(toExport('')).toBe('""');
    expect(toExport('with "quotes"')).toBe(String.raw`"with \"quotes\""`);
  });

  test('converts date objects', () => {
    const date = new Date('2023-01-01');
    expect(toExport(date)).toBe(`new Date(${JSON.stringify(date)})`);
  });

  test('converts arrays', () => {
    expect(toExport([1, 2, 3])).toBe('Object.freeze([1,2,3])');
    expect(toExport(['a', 'b'])).toBe('Object.freeze(["a","b"])');
    expect(toExport([true, 42, 'mix'])).toBe('Object.freeze([true,42,"mix"])');
    expect(toExport([])).toBe('Object.freeze([])');
  });

  test('converts nested arrays', () => {
    expect(toExport([1, [2, 3]])).toBe('Object.freeze([1,Object.freeze([2,3])])');
  });

  test('converts objects', () => {
    expect(toExport({ a: 1 })).toBe('Object.freeze(Object.fromEntries([["a",1]]))');
    expect(toExport({ a: 1, b: 'str' })).toBe(
      'Object.freeze(Object.fromEntries([["a",1],["b","str"]]))',
    );
    expect(toExport({})).toBe('Object.freeze(Object.fromEntries([]))');
  });

  test('converts nested objects', () => {
    const result = toExport({ a: { b: 2 } });
    expect(result).toBe(
      'Object.freeze(Object.fromEntries([["a",Object.freeze(Object.fromEntries([["b",2]]))]]))',
    );
  });

  test('converts objects with array values', () => {
    const result = toExport({ arr: [1, 2] });
    expect(result).toBe(
      'Object.freeze(Object.fromEntries([["arr",Object.freeze([1,2])]]))',
    );
  });

  test('converts maps', () => {
    const map = new Map([['a', 1], ['b', 2]]);
    const result = toExport(map);
    expect(result).toBe('Object.freeze(new Map([["a",1],["b",2]]))');
  });

  test('converts sets', () => {
    const set = new Set([1, 2, 3]);
    const result = toExport(set);
    expect(result).toContain('Object.freeze(new Set([');
  });

  test('converts complex nested structures', () => {
    const complex = {
      name: 'test',
      items: [1, 2, { nested: true }],
      date: new Date('2023-01-01'),
    };

    const result = toExport(complex);
    expect(typeof result).toBe('string');
    expect(result).toContain('"name"');
    expect(result).toContain('"test"');
    expect(result).toContain('Object.freeze([');
    expect(result).toContain('new Date(');
  });

  test('throws on inconvertible structures.', ({ expect }) => {
    const weakSet = new WeakSet();
    expect(() => {
      toExport(weakSet);
    })
      .toThrowError();
  });
});
