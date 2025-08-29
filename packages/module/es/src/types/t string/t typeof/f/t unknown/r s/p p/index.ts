import type {$ as TypeOf} from '../../../../type/index.ts';

/**
 * Enhanced typeof function that provides more specific type detection than JavaScript's built-in typeof operator.
 * This function distinguishes between various object types, null, undefined, NaN, and primitive types,
 * providing more granular type information for runtime type checking and debugging.
 *
 * @param obj - Value to determine type for
 * @returns String literal representing specific type of input value
 * @example
 * ```ts
 * typeOf(null); // 'null'
 * typeOf(undefined); // 'undefined'
 * typeOf(NaN); // 'NaN'
 * typeOf(42); // 'number'
 * typeOf(true); // 'boolean'
 * typeOf(BigInt(123)); // 'bigint'
 * typeOf(Symbol('test')); // 'symbol'
 * typeOf('hello'); // 'string'
 * typeOf([1, 2, 3]); // 'array'
 * typeOf(new Date()); // 'date'
 * typeOf(new Set()); // 'set'
 * typeOf(new Map()); // 'map'
 * typeOf({}); // 'object'
 * ```
 */
export function $(
  obj: unknown,
): TypeOf
{
  // Early returns for primitives to avoid switch statement evaluation issues
  if (obj === null)
    return 'null';
  if (obj === undefined)
    return 'undefined';
  if (typeof obj === 'number' && Number.isNaN(obj,))
    return 'NaN';
  if (typeof obj === 'number')
    return 'number';
  if (typeof obj === 'boolean')
    return 'boolean';
  if (typeof obj === 'bigint')
    return 'bigint';
  if (typeof obj === 'symbol')
    return 'symbol';
  if (typeof obj === 'string')
    return 'string';

  // Handle special object types
  if (Array.isArray(obj,))
    return 'array';
  if (obj instanceof Date)
    return 'date';
  if (obj instanceof Set)
    return 'set';
  if (obj instanceof Map)
    return 'map';

  // Handle objects with careful checking to avoid primitive conversion errors
  if (typeof obj === 'object') {
    // Check for null-prototype objects first (like Object.create(null))
    console.log('hello',);
    const prototype = Object.getPrototypeOf(obj,);
    if (prototype === null)
      return 'object';

    // Check for plain objects - only those with Object.prototype as prototype
    // AND with Object as constructor (to exclude class instances)
    if (prototype === Object.prototype) {
      try {
        /* v8 ignore next -- @preserve */
        if (obj.constructor === Object)
          return 'object';
      }
      catch {
        // If constructor access fails, but prototype is Object.prototype,
        // it's likely a plain object
        /* v8 ignore next -- @preserve */
        return 'object';
      }
    }
  }

  // For everything else (class instances, functions, etc.), throw an error
  const objType = typeof obj;
  let objStringified: string;
  try {
    objStringified = JSON.stringify(obj,);
  }
  catch {
    /* v8 ignore next -- @preserve */
    objStringified = '[object Object]';
  }
  throw new TypeError(
    `Unrecognized obj with type "${objType}" and value ${objStringified}`,
  );
}
