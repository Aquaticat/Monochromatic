// deprecated: Use https://www.npmjs.com/package/serialize-javascript

// oxlint-disable-next-line no-unassigned-import -- For side effects.
import '@total-typescript/ts-reset/array-includes';
import { match, } from 'ts-pattern';
import {
  $ as unknownToTypeOfString,
} from '../../../../../t typeof/f/t unknown/r s/p p/index.ts';

const primitive = Object.freeze(['boolean', 'string', 'number', 'date', 'bigint', 'null', 'undefined', 'NaN', 'symbol',] as const,);

/**
 * Converts any JavaScript value into its string representation as frozen export code.
 *
 * This function serializes JavaScript values into code strings that can be used
 * as export statements. It handles all primitive types (boolean, string, number, date,
 * bigint, null, undefined, NaN, symbol) and complex data structures (Set, Map, Array, Object)
 * by recursively converting all nested values. All generated objects are wrapped with
 * `Object.freeze()` to ensure immutability.
 *
 * **Symbol Limitation**: While symbols are supported, each Symbol() call creates a unique
 * instance, so Symbol('foo') !== Symbol('foo'). The generated export code will create
 * new symbol instances that are functionally equivalent but not identity-equal to the
 * original symbols.
 *
 * @param obj - Value to convert to export string representation
 * @returns String representation of the value as frozen export code
 * @throws {TypeError} When an unknown object type is encountered
 *
 * @example
 * ```ts
 * // Primitive types
 * toExport(true); // "true"
 * toExport("hello"); // '"hello"'
 * toExport(42); // "42"
 * toExport(new Date('2023-01-01')); // 'new Date("2023-01-01T00:00:00.000Z")'
 * toExport(123n); // "123n"
 * toExport(null); // "null"
 * toExport(undefined); // "undefined"
 * toExport(NaN); // "NaN"
 * toExport(Symbol('test')); // 'Symbol("test")'
 *
 * // Collections
 * toExport(new Set([1, 2, 3])); // "Object.freeze(new Set([1,2,3]))"
 * toExport(new Map([['a', 1]])); // "Object.freeze(new Map([["a",1]]))"
 * toExport([1, 2, 3]); // "Object.freeze([1,2,3])"
 * toExport({ a: 1, b: 2 }); // "Object.freeze(Object.fromEntries([["a",1],["b",2]]))"
 *
 * // Nested structures
 * toExport({ users: [{ name: "Alice" }] });
 * // "Object.freeze(Object.fromEntries([["users",Object.freeze([Object.freeze(Object.fromEntries([["name","Alice"]]))])]]))"
 * ```
 */
export function $(obj: unknown,): string {
  const objType = unknownToTypeOfString(obj,);
  if (primitive.includes(objType,)) {
    const primitiveObjType = objType as typeof primitive[number];
    return match(primitiveObjType,)
      .with('boolean', function handler() {
        const boolObj = obj as boolean;
        return String(boolObj,);
      },)
      .with('number', function handler() {
        const numberObj = obj as number;
        return String(numberObj,);
      },)
      .with('string', function handler() {
        const stringObj = obj as string;
        return JSON.stringify(stringObj,);
      },)
      .with('date', function handler() {
        const dateObj = obj as Date;
        return `new Date(${JSON.stringify(dateObj,)})`;
      },)
      .with('bigint', function handler() {
        const bigintObj = obj as bigint;
        return `${String(bigintObj,)}n`;
      },)
      .with('null', function handler() {
        return 'null';
      },)
      .with('undefined', function handler() {
        return 'undefined';
      },)
      .with('NaN', function handler() {
        return 'NaN';
      },)
      .with('symbol', function handler() {
        const symbolObj = obj as symbol;
        const description = symbolObj.description;
        return description !== undefined
          ? `Symbol(${JSON.stringify(description,)})`
          : 'Symbol()';
      },)
      .exhaustive();
  }

  return match(objType,)
    .with('set', function handler() {
      const setObj = obj as Set<any>;
      return `Object.freeze(new Set([${
        [...setObj,]
          .map(function eachSetItem(element: any,) {
            return $(element,);
          },)
          .join(',',)
      }]))`;
    },)
    .with('map', function handler() {
      const mapObj = obj as Map<any, any>;
      return `Object.freeze(new Map([${
        [...mapObj,]
          .map(function eachMapEntry([k, v,],) {
            return `[${$(k,)},${$(v,)}]`;
          },)
          .join(',',)
      }]))`;
    },)
    .with('array', function handler() {
      const arrayObj = obj as any[];
      return `Object.freeze([${
        arrayObj
          .map(function eachArrayItem(element: any,) {
            return $(element,);
          },)
          .join(',',)
      }])`;
    },)
    // FIXME: Possible bug here
    .with('object', function handler() {
      const objectObj = obj as Record<string, any>;
      return `Object.freeze(Object.fromEntries([${
        Object
          .entries(objectObj,)
          .map(
            function eachObjectEntry([k, v,],) {
              return `[${$(k,)},${$(v,)}]`;
            },
          )
          .join(',',)
      }]))`;
    },)
    /* v8 ignore next -- @preserve */
    .otherwise(
      /* v8 ignore next -- @preserve */
      function thrower() {
        /* v8 ignore next -- @preserve */
        throw new TypeError(
          `Unknown obj ${JSON.stringify(obj,)} type ${objType}`,
        );
      },
    );
}
