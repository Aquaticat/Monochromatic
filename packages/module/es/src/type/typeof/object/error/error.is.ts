/**
 * Type guard that checks if a value is an Error instance.
 * Uses Object.prototype.toString.call for reliable error detection that works
 * across different realms and for all Error subclasses.
 *
 * Note: All Error subclasses (TypeError, RangeError, etc.) return '[object Error]'
 * when checked with Object.prototype.toString.call, making this function suitable
 * for detecting any type of Error instance.
 *
 * @param value - Value to check for Error type
 * @returns True if the value is an Error instance, false otherwise
 *
 * @example
 * ```ts
 * isError(new Error('test')); // true
 * isError(new TypeError('test')); // true
 * isError(new RangeError('test')); // true
 * isError('error string'); // false
 * isError(null); // false
 * isError(undefined); // false
 * isError({ message: 'fake error' }); // false
 *
 * // Type narrowing in conditional blocks
 * function handleValue(value: unknown) {
 *   if (isError(value)) {
 *     console.log(value.message); // TypeScript knows value is Error
 *     console.log(value.stack); // Access Error properties safely
 *   }
 * }
 * ```
 */
export function isError(value: unknown,): value is Error {
  // Contrary to expectations, all the subclasses of Error all also give [object Error]
  return Object.prototype.toString.call(value,) === '[object Error]';
}
