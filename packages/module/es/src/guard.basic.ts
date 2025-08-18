/**
 * Type guard function that narrows input types.
 *
 * Type guards are functions that return a type predicate which informs TypeScript
 * that a variable is of a specific type when the function returns true.
 *
 * @example
 * ```ts
 * const isString: Guard<unknown, string> = (input): input is string => typeof input === 'string';
 *
 * const value: unknown = "hello";
 * if (isString(value)) {
 *   // value is now narrowed to string type
 *   console.log(value.toUpperCase()); // Safe to call string methods
 * }
 * ```
 *
 * @example
 * ```ts
 * // Reusable guard for checking array types
 * const isArray: Guard<unknown, unknown[]> = (input): input is unknown[] => Array.isArray(input);
 *
 * const data: unknown = [1, 2, 3];
 * if (isArray(data)) {
 *   // data is now narrowed to unknown[] type
 *   console.log(data.length);
 * }
 * ```
 *
 * @typeParam Input - Type of input value to guard. Defaults to unknown.
 * @typeParam Type - Narrowed type when guard returns true. Must extend Input. Defaults to Input.
 */
export type Guard<Input = unknown, Type extends Input = Input> = (input: Input) => input is Type;
