/**
 Typed array constructor names shared by the spread and copy rules.

 Spreading a typed array produces a plain array, so any expression known to be a
 typed array performs a real conversion when spread, never a useless copy.

 @module
 */

/**
 Every global typed array constructor name.

 @example
 ```ts
 TYPED_ARRAY_NAMES.has('Uint8Array'); // true
 ```
 */
export const TYPED_ARRAY_NAMES: ReadonlySet<string> = new Set([
  'Int8Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'Int16Array',
  'Uint16Array',
  'Int32Array',
  'Uint32Array',
  'Float16Array',
  'Float32Array',
  'Float64Array',
  'BigInt64Array',
  'BigUint64Array',
],);
