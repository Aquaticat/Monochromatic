/**
 * Primitive value serialization for the export code generator.
 *
 * Handles boolean, string, number, date, bigint, null, undefined, NaN, and symbol types.
 */

import { match, } from 'ts-pattern';

/**
 * Serializes a primitive JavaScript value into its string representation as frozen export code.
 *
 * @param obj - Primitive value to serialize
 *
 * @param primitiveObjType - Discriminant from `unknownToTypeOfString`
 *
 * @returns String representation of the primitive value
 *
 * @example
 * ```ts
 * serializePrimitive({ obj: true, primitiveObjType: 'boolean' });   // "true"
 * serializePrimitive({ obj: "hello", primitiveObjType: 'string' }); // '"hello"'
 * serializePrimitive({ obj: 42, primitiveObjType: 'number' });      // "42"
 * ```
 */
export function serializePrimitive({
  obj,
  primitiveObjType,
}: {
  obj: unknown;
  primitiveObjType: 'boolean' | 'string' | 'number' | 'date' | 'bigint' | 'null'
    | 'undefined' | 'NaN' | 'symbol';
},): string {
  return match(primitiveObjType,)
    .with(
      'boolean',
      function handler() {
        /**
         * Cast of `obj` to its narrowed primitive after the discriminant match confirmed the runtime type.
         */
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- discriminant match confirms boolean
        const boolObj = obj as boolean;
        return String(boolObj,);
      },
    )
    .with(
      'number',
      function handler() {
        /* oxlint-disable typescript/no-unsafe-type-assertion -- discriminant match confirms number */
        /**
         * obj narrowed to number after the discriminant matched 'number'.
         */
        const numberObj = obj as number;
        /* oxlint-enable typescript/no-unsafe-type-assertion */
        return String(numberObj,);
      },
    )
    .with(
      'string',
      function handler() {
        /* oxlint-disable typescript/no-unsafe-type-assertion -- discriminant match confirms string */
        /**
         * obj narrowed to string after the discriminant matched 'string'.
         */
        const stringObj = obj as string;
        /* oxlint-enable typescript/no-unsafe-type-assertion */
        return JSON.stringify(stringObj,);
      },
    )
    .with(
      'date',
      function handler() {
        /* oxlint-disable typescript/no-unsafe-type-assertion -- discriminant match confirms Date */
        /**
         * obj narrowed to Date after the discriminant matched 'date'.
         */
        const dateObj = obj as Date;
        /* oxlint-enable typescript/no-unsafe-type-assertion */
        return `new Date(${JSON.stringify(dateObj,)})`;
      },
    )
    .with(
      'bigint',
      function handler() {
        /* oxlint-disable typescript/no-unsafe-type-assertion -- discriminant match confirms bigint */
        /**
         * obj narrowed to bigint after the discriminant matched 'bigint'.
         */
        const bigintObj = obj as bigint;
        /* oxlint-enable typescript/no-unsafe-type-assertion */
        return `${String(bigintObj,)}n`;
      },
    )
    .with(
      'null',
      function handler() {
        return 'null';
      },
    )
    .with(
      'undefined',
      function handler() {
        return 'undefined';
      },
    )
    .with(
      'NaN',
      function handler() {
        return 'NaN';
      },
    )
    .with(
      'symbol',
      function handler() {
        /* oxlint-disable typescript/no-unsafe-type-assertion -- discriminant match confirms symbol */
        /**
         * obj narrowed to symbol after the discriminant matched 'symbol'.
         */
        const symbolObj = obj as symbol;
        /* oxlint-enable typescript/no-unsafe-type-assertion */
        /**
         * Symbol description used to round-trip the value through Symbol().
         */
        const { description, } = symbolObj;
        return description !== undefined
          ? `Symbol(${JSON.stringify(description,)})`
          : 'Symbol()';
      },
    )
    .exhaustive();
}
