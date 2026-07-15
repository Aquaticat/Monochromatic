// deprecated: Use https://www.npmjs.com/package/serialize-javascript

// oxlint-disable-next-line import/no-unassigned-import -- For side effects.
import '@total-typescript/ts-reset/array-includes';
import { match, } from 'ts-pattern';
import {
  $ as unknownToTypeOfString,
} from '../../../../../t typeof/f/t unknown/r s/p p/index.ts';
import { serializePrimitive, } from './serializePrimitive.ts';

/**
 * Frozen tuple of primitive type discriminants handled by direct serialization.
 */
const primitive = Object.freeze(
  [
    'boolean',
    'string',
    'number',
    'date',
    'bigint',
    'null',
    'undefined',
    'NaN',
    'symbol',
  ] as const,
);

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
 *
 * @returns String representation of the value as frozen export code
 *
 * @throws When an unknown object type is encountered
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
  /**
   * Discriminant describing the runtime kind of obj, used to pick a serialiser branch.
   */
  const objType = unknownToTypeOfString(obj,);
  if (primitive.includes(objType,)) {
    return serializePrimitive({
      obj,
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- objType verified in primitive tuple
      primitiveObjType: objType as typeof primitive[number],
    },);
  }

  return match(objType,)
    .with(
      'set',
      function handler() {
        /* oxlint-disable typescript/no-explicit-any, typescript/no-unsafe-type-assertion -- runtime type check confirms Set */
        /**
         * obj narrowed to Set after the runtime discriminant matched 'set'.
         */
        const setObj = obj as Set<any>;
        /* oxlint-enable typescript/no-explicit-any, typescript/no-unsafe-type-assertion */
        return `Object.freeze(new Set([${
          [...setObj,]
            // oxlint-disable-next-line typescript/no-explicit-any -- Set element type is unknown at runtime
            .map(function eachSetItem(element: any,) {
              return $(element,);
            },)
            .join(',',)
        }]))`;
      },
    )
    .with(
      'map',
      function handler() {
        /* oxlint-disable typescript/no-explicit-any, typescript/no-unsafe-type-assertion -- runtime type check confirms Map */
        /**
         * obj narrowed to Map after the runtime discriminant matched 'map'.
         */
        const mapObj = obj as Map<any, any>;
        /* oxlint-enable typescript/no-explicit-any, typescript/no-unsafe-type-assertion */
        return `Object.freeze(new Map([${
          [...mapObj,]
            .map(function eachMapEntry([k, v,],) {
              return `[${$(k,)},${$(v,)}]`;
            },)
            .join(',',)
        }]))`;
      },
    )
    .with(
      'array',
      function handler() {
        /* oxlint-disable typescript/no-explicit-any, typescript/no-unsafe-type-assertion -- runtime type check confirms array */
        /**
         * obj narrowed to array after the runtime discriminant matched 'array'.
         */
        const arrayObj = obj as any[];
        /* oxlint-enable typescript/no-explicit-any, typescript/no-unsafe-type-assertion */
        return `Object.freeze([${
          arrayObj
            // oxlint-disable-next-line typescript/no-explicit-any -- array element type is unknown at runtime
            .map(function eachArrayItem(element: any,) {
              return $(element,);
            },)
            .join(',',)
        }])`;
      },
    )
    // FIXME: Possible bug here
    .with(
      'object',
      function handler() {
        /* oxlint-disable typescript/no-explicit-any, typescript/no-unsafe-type-assertion -- runtime type check confirms plain object */
        /**
         * obj narrowed to plain object after the runtime discriminant matched 'object'.
         */
        const objectObj = obj as Record<string, any>;
        /* oxlint-enable typescript/no-explicit-any, typescript/no-unsafe-type-assertion */
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
      },
    )
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
