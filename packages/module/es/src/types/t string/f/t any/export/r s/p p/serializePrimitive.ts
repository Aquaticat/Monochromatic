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
 * serializePrimitive(true, 'boolean');   // "true"
 * serializePrimitive("hello", 'string'); // '"hello"'
 * serializePrimitive(42, 'number');      // "42"
 * ```
 */
export function serializePrimitive(
  obj: unknown,
  primitiveObjType: 'boolean' | 'string' | 'number' | 'date' | 'bigint' | 'null' | 'undefined' | 'NaN' | 'symbol',
): string {
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
      const {description} = symbolObj;
      return description !== undefined
        ? `Symbol(${JSON.stringify(description,)})`
        : 'Symbol()';
    },)
    .exhaustive();
}
