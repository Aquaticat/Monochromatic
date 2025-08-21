import {
  // Logging library used.
  logtapeConfiguration,
  logtapeConfigure,
  toExport,
} from '@monochromatic-dev/module-es';
import {
  describe,
  expect,
  test,
} from 'vitest';

await logtapeConfigure(await logtapeConfiguration(),);

//region toExport tests -- Tests for JavaScript value to export string conversion

describe(toExport, () => {
  //region Primitive types tests

  describe('primitive types', () => {
    test('converts boolean values', () => {
      expect(toExport(true,),).toBe('true',);
      expect(toExport(false,),).toBe('false',);
    });

    test('converts number values', () => {
      expect(toExport(42,),).toBe('42',);
      expect(toExport(0,),).toBe('0',);
      expect(toExport(-17,),).toBe('-17',);
      expect(toExport(3.14,),).toBe('3.14',);
      expect(toExport(Infinity,),).toBe('Infinity',);
      expect(toExport(-Infinity,),).toBe('-Infinity',);
    });

    test('converts string values', () => {
      expect(toExport('hello',),).toBe('"hello"',);
      expect(toExport('',),).toBe('""',);
      expect(toExport('hello "world"',),).toBe(String.raw`"hello \"world\""`,);
      expect(toExport("it's working",),).toBe('"it\'s working"',);
      expect(toExport('line1\nline2',),).toBe(String.raw`"line1\nline2"`,);
    });

    test('converts Date values', () => {
      const date = new Date('2023-01-01T00:00:00.000Z',);
      expect(toExport(date,),).toBe('new Date("2023-01-01T00:00:00.000Z")',);

      const date2 = new Date('2024-12-25T15:30:45.123Z',);
      expect(toExport(date2,),).toBe('new Date("2024-12-25T15:30:45.123Z")',);
    });
  });

  //endregion Primitive types tests

  //region Collection types tests

  describe('collection types', () => {
    test('converts Set values', () => {
      expect(toExport(new Set(),),).toBe('Object.freeze(new Set([]))',);
      expect(toExport(new Set([1, 2, 3,],),),).toBe('Object.freeze(new Set([1,2,3]))',);
      expect(toExport(new Set(['a', 'b',],),),).toBe(
        'Object.freeze(new Set(["a","b"]))',
      );
      expect(toExport(new Set([true, false,],),),).toBe(
        'Object.freeze(new Set([true,false]))',
      );
    });

    test('converts Map values', () => {
      expect(toExport(new Map(),),).toBe('Object.freeze(new Map([]))',);

      const map1 = new Map([['a', 1,], ['b', 2,],],);
      expect(toExport(map1,),).toBe('Object.freeze(new Map([["a",1],["b",2]]))',);

      const map2 = new Map([[1, 'one',], [2, 'two',],],);
      expect(toExport(map2,),).toBe('Object.freeze(new Map([[1,"one"],[2,"two"]]))',);

      const map3 = new Map([[true, false,], [false, true,],],);
      expect(toExport(map3,),).toBe(
        'Object.freeze(new Map([[true,false],[false,true]]))',
      );
    });

    test('converts Array values', () => {
      expect(toExport([],),).toBe('Object.freeze([])',);
      expect(toExport([1, 2, 3,],),).toBe('Object.freeze([1,2,3])',);
      expect(toExport(['a', 'b', 'c',],),).toBe('Object.freeze(["a","b","c"])',);
      expect(toExport([true, false,],),).toBe('Object.freeze([true,false])',);
      expect(toExport([1, 'hello', true,],),).toBe('Object.freeze([1,"hello",true])',);
    });

    test('converts Object values', () => {
      expect(toExport({},),).toBe('Object.freeze(Object.fromEntries([]))',);

      const obj1 = { a: 1, b: 2, };
      expect(toExport(obj1,),).toBe(
        'Object.freeze(Object.fromEntries([["a",1],["b",2]]))',
      );

      const obj2 = { name: 'Alice', age: 30, };
      expect(toExport(obj2,),).toBe(
        'Object.freeze(Object.fromEntries([["name","Alice"],["age",30]]))',
      );

      const obj3 = { active: true, count: 0, };
      expect(toExport(obj3,),).toBe(
        'Object.freeze(Object.fromEntries([["active",true],["count",0]]))',
      );
    });
  });

  //endregion Collection types tests

  //region Nested structures tests

  describe('nested structures', () => {
    test('converts nested arrays', () => {
      const nested = [[1, 2,], [3, 4,],];
      expect(toExport(nested,),).toBe(
        'Object.freeze([Object.freeze([1,2]),Object.freeze([3,4])])',
      );

      const deepNested = [[[1,],],];
      expect(toExport(deepNested,),).toBe(
        'Object.freeze([Object.freeze([Object.freeze([1])])])',
      );
    });

    test('converts nested objects', () => {
      const nested = { user: { name: 'Alice', details: { age: 30, }, }, };
      const expected =
        'Object.freeze(Object.fromEntries([["user",Object.freeze(Object.fromEntries([["name","Alice"],["details",Object.freeze(Object.fromEntries([["age",30]]))]]))]]))';
      expect(toExport(nested,),).toBe(expected,);
    });

    test('converts arrays with objects', () => {
      const arrayWithObjects = [{ name: 'Alice', }, { name: 'Bob', },];
      const expected =
        'Object.freeze([Object.freeze(Object.fromEntries([["name","Alice"]])),Object.freeze(Object.fromEntries([["name","Bob"]]))])';
      expect(toExport(arrayWithObjects,),).toBe(expected,);
    });

    test('converts objects with arrays', () => {
      const objectWithArrays = { numbers: [1, 2, 3,], strings: ['a', 'b',], };
      const expected =
        'Object.freeze(Object.fromEntries([["numbers",Object.freeze([1,2,3])],["strings",Object.freeze(["a","b"])]]))';
      expect(toExport(objectWithArrays,),).toBe(expected,);
    });

    test('converts nested Sets and Maps', () => {
      const setWithMap = new Set([new Map([['key', 'value',],],),],);
      const expected =
        'Object.freeze(new Set([Object.freeze(new Map([["key","value"]]))]))';
      expect(toExport(setWithMap,),).toBe(expected,);

      const mapWithSet = new Map([['data', new Set([1, 2,],),],],);
      const expected2 =
        'Object.freeze(new Map([["data",Object.freeze(new Set([1,2]))]]))';
      expect(toExport(mapWithSet,),).toBe(expected2,);
    });

    test('converts complex mixed structures', () => {
      const complex = {
        users: [
          { name: 'Alice', tags: new Set(['admin', 'user',],), },
          { name: 'Bob', metadata: new Map([['role', 'guest',],],), },
        ],
        config: {
          enabled: true,
          settings: { timeout: 5000, },
        },
      };

      const result = toExport(complex,);
      expect(result,).toContain('Object.freeze(Object.fromEntries([',);
      expect(result,).toContain('"users"',);
      expect(result,).toContain('"Alice"',);
      expect(result,).toContain('Object.freeze(new Set(["admin","user"]))',);
      expect(result,).toContain('Object.freeze(new Map([["role","guest"]]))',);
      expect(result,).toContain('"config"',);
      expect(result,).toContain('"enabled",true',);
      expect(result,).toContain('"timeout",5000',);
    });
  });

  //endregion Nested structures tests

  //region Error handling tests

  describe('error handling', () => {
    test('throws TypeError for null', () => {
      expect(() => toExport(null,)).toThrow(TypeError,);
      expect(() => toExport(null,)).toThrow('Unsupported obj null null type null',);
    });

    test('throws TypeError for undefined', () => {
      expect(() => toExport(undefined,)).toThrow(TypeError,);
      expect(() => toExport(undefined,)).toThrow(
        'Unsupported obj undefined undefined type undefined',
      );
    });

    test('throws TypeError for NaN', () => {
      expect(() => toExport(Number.NaN,)).toThrow(TypeError,);
      expect(() => toExport(Number.NaN,)).toThrow('Unsupported obj NaN null type NaN',);
    });

    test('throws TypeError for bigint', () => {
      expect(() => toExport(BigInt(123,),)).toThrow(TypeError,);
      expect(() => toExport(BigInt(123,),)).toThrow(
        'Do not know how to serialize a BigInt',
      );
    });

    test('throws TypeError for symbol', () => {
      const sym = Symbol('test',);
      expect(() => toExport(sym,)).toThrow(TypeError,);
      expect(() => toExport(sym,)).toThrow('Cannot convert a Symbol value to a string',);
    });
  });

  //endregion Error handling tests

  //region Edge cases tests

  describe('edge cases', () => {
    test('handles empty collections', () => {
      expect(toExport(new Set(),),).toBe('Object.freeze(new Set([]))',);
      expect(toExport(new Map(),),).toBe('Object.freeze(new Map([]))',);
      expect(toExport([],),).toBe('Object.freeze([])',);
      expect(toExport({},),).toBe('Object.freeze(Object.fromEntries([]))',);
    });

    test('handles special number values', () => {
      expect(toExport(0,),).toBe('0',);
      expect(toExport(-0,),).toBe('0',); // -0 becomes 0 in string representation
      expect(toExport(Infinity,),).toBe('Infinity',);
      expect(toExport(-Infinity,),).toBe('-Infinity',);
    });

    test('handles special string characters', () => {
      expect(toExport('\t',),).toBe(String.raw`"\t"`,);
      expect(toExport('\r',),).toBe(String.raw`"\r"`,);
      expect(toExport('\n',),).toBe(String.raw`"\n"`,);
      expect(toExport('\\',),).toBe(String.raw`"\\"`,);
      expect(toExport('"',),).toBe(String.raw`"\""`,);
    });

    test('handles objects with numeric keys', () => {
      const obj = { 1: 'one', 2: 'two', };
      const result = toExport(obj,);
      expect(result,).toContain('"1","one"',);
      expect(result,).toContain('"2","two"',);
    });

    test('handles objects with special property names', () => {
      const obj = { 'key with spaces': 'value', 'key-with-dashes': 'value2', };
      const result = toExport(obj,);
      expect(result,).toContain('"key with spaces","value"',);
      expect(result,).toContain('"key-with-dashes","value2"',);
    });

    test('handles Date edge cases', () => {
      const invalidDate = new Date('invalid',);
      expect(toExport(invalidDate,),).toBe('new Date(null)',);

      const epochDate = new Date(0,);
      expect(toExport(epochDate,),).toBe('new Date("1970-01-01T00:00:00.000Z")',);
    });

    test('handles arrays with mixed types', () => {
      const mixed = [1, 'string', true, new Date('2023-01-01',), { key: 'value', },];
      const result = toExport(mixed,);
      expect(result,).toContain('1',);
      expect(result,).toContain('"string"',);
      expect(result,).toContain('true',);
      expect(result,).toContain('new Date("2023-01-01T00:00:00.000Z")',);
      expect(result,).toContain('Object.freeze(Object.fromEntries([["key","value"]]))',);
    });

    test('handles Sets with mixed types', () => {
      const mixedSet = new Set([1, 'string', true,],);
      expect(toExport(mixedSet,),).toBe('Object.freeze(new Set([1,"string",true]))',);
    });

    test('handles Maps with mixed key-value types', () => {
      const mixedMap = new Map();
      mixedMap.set(1, 'one',);
      mixedMap.set('two', 2,);
      mixedMap.set(true, false,);
      expect(toExport(mixedMap,),).toBe(
        'Object.freeze(new Map([[1,"one"],["two",2],[true,false]]))',
      );
    });
  });

  //endregion Edge cases tests

  //region Real-world examples tests

  describe('real-world examples', () => {
    test('converts configuration object', () => {
      const config = {
        apiUrl: 'https://api.example.com',
        timeout: 5000,
        retries: 3,
        features: {
          darkMode: true,
          notifications: false,
        },
        supportedLanguages: ['en', 'es', 'fr',],
      };

      const result = toExport(config,);
      expect(result,).toContain('"apiUrl","https://api.example.com"',);
      expect(result,).toContain('"timeout",5000',);
      expect(result,).toContain('"retries",3',);
      expect(result,).toContain('"darkMode",true',);
      expect(result,).toContain('"notifications",false',);
      expect(result,).toContain('Object.freeze(["en","es","fr"])',);
    });

    test('converts user data structure', () => {
      const userData = {
        id: 123,
        profile: {
          name: 'John Doe',
          email: 'john@example.com',
          preferences: new Map([
            ['theme', 'dark',],
            ['language', 'en',],
          ],),
        },
        permissions: new Set(['read', 'write',],),
        loginHistory: [
          new Date('2023-01-01T10:00:00Z',),
          new Date('2023-01-02T14:30:00Z',),
        ],
      };

      const result = toExport(userData,);
      expect(result,).toContain('"id",123',);
      expect(result,).toContain('"name","John Doe"',);
      expect(result,).toContain('"email","john@example.com"',);
      expect(result,).toContain(
        'Object.freeze(new Map([["theme","dark"],["language","en"]]))',
      );
      expect(result,).toContain('Object.freeze(new Set(["read","write"]))',);
      expect(result,).toContain('new Date("2023-01-01T10:00:00.000Z")',);
      expect(result,).toContain('new Date("2023-01-02T14:30:00.000Z")',);
    });

    test('converts API response structure', () => {
      const apiResponse = {
        status: 'success',
        data: [
          { id: 1, name: 'Item 1', active: true, },
          { id: 2, name: 'Item 2', active: false, },
        ],
        metadata: {
          total: 2,
          page: 1,
          hasMore: false,
        },
      };

      const result = toExport(apiResponse,);
      expect(result,).toContain('"status","success"',);
      expect(result,).toContain('"id",1',);
      expect(result,).toContain('"name","Item 1"',);
      expect(result,).toContain('"active",true',);
      expect(result,).toContain('"total",2',);
      expect(result,).toContain('"hasMore",false',);
    });
  });

  //endregion Real-world examples tests
},);

//endregion toExport tests
