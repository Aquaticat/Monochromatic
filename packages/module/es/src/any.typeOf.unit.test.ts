import { typeOf } from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

describe('typeOf', () => {
  test('should identify null values', () => {
    expect(typeOf(null)).toBe('null');
  });

  test('should identify undefined values', () => {
    expect(typeOf(undefined)).toBe('undefined');
    expect(typeOf(void 0)).toBe('undefined');
  });

  test('should identify NaN values', () => {
    expect(typeOf(NaN)).toBe('NaN');
    expect(typeOf(Number.NaN)).toBe('NaN');
    expect(typeOf(0 / 0)).toBe('NaN');
  });

  test('should identify number values', () => {
    expect(typeOf(42)).toBe('number');
    expect(typeOf(0)).toBe('number');
    expect(typeOf(-1)).toBe('number');
    expect(typeOf(3.14)).toBe('number');
    expect(typeOf(Infinity)).toBe('number');
    expect(typeOf(-Infinity)).toBe('number');
    expect(typeOf(Number.MAX_VALUE)).toBe('number');
    expect(typeOf(Number.MIN_VALUE)).toBe('number');
  });

  test('should identify boolean values', () => {
    expect(typeOf(true)).toBe('boolean');
    expect(typeOf(false)).toBe('boolean');
    expect(typeOf(Boolean(1))).toBe('boolean');
    expect(typeOf(Boolean(0))).toBe('boolean');
  });

  test('should identify bigint values', () => {
    expect(typeOf(BigInt(123))).toBe('bigint');
    expect(typeOf(BigInt(0))).toBe('bigint');
    expect(typeOf(123n)).toBe('bigint');
    expect(typeOf(-456n)).toBe('bigint');
  });

  test('should identify symbol values', () => {
    expect(typeOf(Symbol('test'))).toBe('symbol');
    expect(typeOf(Symbol.for('global'))).toBe('symbol');
    expect(typeOf(Symbol.iterator)).toBe('symbol');
    expect(typeOf(Symbol())).toBe('symbol');
  });

  test('should identify string values', () => {
    expect(typeOf('hello')).toBe('string');
    expect(typeOf('')).toBe('string');
    expect(typeOf('123')).toBe('string');
    expect(typeOf(String(42))).toBe('string');
    expect(typeOf(`template string`)).toBe('string');
  });

  test('should identify array values', () => {
    expect(typeOf([])).toBe('array');
    expect(typeOf([1, 2, 3])).toBe('array');
    expect(typeOf(new Array(5))).toBe('array');
    expect(typeOf(Array.from('hello'))).toBe('array');
    expect(typeOf([null, undefined, NaN])).toBe('array');
  });

  test('should identify date values', () => {
    expect(typeOf(new Date())).toBe('date');
    expect(typeOf(new Date('2023-01-01'))).toBe('date');
    expect(typeOf(new Date(0))).toBe('date');
    expect(typeOf(new Date(Date.now()))).toBe('date');
  });

  test('should identify set values', () => {
    expect(typeOf(new Set())).toBe('set');
    expect(typeOf(new Set([1, 2, 3]))).toBe('set');
    expect(typeOf(new Set(['a', 'b', 'c']))).toBe('set');
    const setWithValues = new Set();
    setWithValues.add('test');
    expect(typeOf(setWithValues)).toBe('set');
  });

  test('should identify map values', () => {
    expect(typeOf(new Map())).toBe('map');
    expect(typeOf(new Map([['key', 'value']]))).toBe('map');
    const mapWithValues = new Map();
    mapWithValues.set('foo', 'bar');
    expect(typeOf(mapWithValues)).toBe('map');
  });

  test('should identify object values', () => {
    expect(typeOf({})).toBe('object');
    expect(typeOf({ foo: 'bar' })).toBe('object');
    expect(typeOf(Object.create(null))).toBe('object');
    expect(typeOf(new Object())).toBe('object');
    expect(typeOf({ nested: { object: true } })).toBe('object');
  });

  test('should handle plain objects with toString method', () => {
    const plainObject = { toString: () => '[object Object] custom' };
    expect(typeOf(plainObject)).toBe('object');
  });

  test('should throw TypeError for unrecognized types', () => {
    // Create a custom object that doesn't match any of the known patterns
    const customObject = Object.create({});
    Object.defineProperty(customObject, 'toString', {
      value: () => '[object Custom]',
      writable: false,
      enumerable: false,
      configurable: false,
    });

    expect(() => typeOf(customObject)).toThrow(TypeError);
    expect(() => typeOf(customObject)).toThrow(/Unrecognized obj/);
  });

  test('should handle functions (which fall through to error case)', () => {
    const testFunction = () => 'test';
    const namedFunction = function namedFn(): string {
      return 'named';
    };
    const arrowFunction = (x: number) => x * 2;

    expect(() => typeOf(testFunction)).toThrow(TypeError);
    expect(() => typeOf(namedFunction)).toThrow(TypeError);
    expect(() => typeOf(arrowFunction)).toThrow(TypeError);
  });

  test('should handle class instances (which fall through to error case)', () => {
    class TestClass {
      value = 'test';
    }
    const instance = new TestClass();

    expect(() => typeOf(instance)).toThrow(TypeError);
  });

  test('should prioritize NaN detection over number', () => {
    // Ensure NaN is detected as 'NaN' and not 'number'
    const notANumber = Number('not a number');
    expect(typeOf(notANumber)).toBe('NaN');
    expect(Number.isNaN(notANumber)).toBe(true);
  });

  test('should prioritize array detection over object', () => {
    // Ensure arrays are detected as 'array' and not 'object'
    const arrayLikeObject: unknown[] = [];
    expect(typeOf(arrayLikeObject)).toBe('array');
    expect(Array.isArray(arrayLikeObject)).toBe(true);
  });

  test('should handle edge cases with special objects', () => {
    // RegExp should fall through to error case
    expect(() => typeOf(/regex/)).toThrow(TypeError);

    // Error objects should fall through to error case
    expect(() => typeOf(new Error('test'))).toThrow(TypeError);

    // Promise should fall through to error case
    expect(() => typeOf(Promise.resolve())).toThrow(TypeError);
  });
});
