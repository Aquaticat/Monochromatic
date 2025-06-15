import type { Promisable } from 'type-fest';

/**
 * Type utility that excludes Promise types from a given type.
 * This utility type creates a type that contains everything from T except Promise<any>.
 * Useful for ensuring values aren't promises in function signatures or type constraints.
 *
 * @template T - Type to exclude Promise from (defaults to any)
 *
 * @example
 * ```ts
 * // Basic usage
 * type NonPromiseString = NotPromise<string | Promise<string>>; // string
 * type NonPromiseNumber = NotPromise<number | Promise<number>>; // number
 *
 * // With union types
 * type MixedTypes = string | number | Promise<boolean> | null;
 * type OnlyNonPromises = NotPromise<MixedTypes>; // string | number | null
 *
 * // Function parameter constraint
 * function processValue<T>(value: NotPromise<T>): T {
 *   // Ensures value is never a Promise
 *   return value;
 * }
 *
 * // Type guard usage
 * function isNotPromise<T>(value: T | Promise<T>): value is NotPromise<T> {
 *   return typeof value !== 'object' || !('then' in value);
 * }
 * ```
 */
export type NotPromise<T = any,> = Exclude<T, Promise<any>>;

/**
 * Function type that takes unknown input and returns boolean synchronously.
 * This type represents a predicate function that evaluates a condition and returns
 * true or false immediately. Commonly used for filtering, validation, and conditional logic.
 *
 * @example
 * ```ts
 * // Basic predicate functions
 * const isString: Predicate = (input): input is string => typeof input === 'string';
 * const isPositive: Predicate = (input) => typeof input === 'number' && input > 0;
 * const isNotNull: Predicate = (input) => input !== null;
 *
 * // Usage with array methods
 * const values = [1, 'hello', null, 42, 'world'];
 * const strings = values.filter(isString); // ['hello', 'world']
 * const positiveNumbers = values.filter(isPositive); // [1, 42]
 *
 * // Custom predicate composition
 * const isEven: Predicate = (input) => typeof input === 'number' && input % 2 === 0;
 * const isOdd: Predicate = (input) => typeof input === 'number' && input % 2 !== 0;
 *
 * // Conditional logic
 * function processIfValid(value: unknown, predicate: Predicate): void {
 *   if (predicate(value)) {
 *     console.log('Valid value:', value);
 *   }
 * }
 * ```
 */
export type Predicate = (input: unknown) => boolean;

/**
 * Function type that takes unknown input and returns Promise<boolean> asynchronously.
 * This type represents an async predicate function that evaluates a condition asynchronously
 * and returns a promise that resolves to true or false. Useful for async validation,
 * database queries, network checks, and other asynchronous conditional operations.
 *
 * @example
 * ```ts
 * // Async validation predicates
 * const userExists: PredicateAsync = async (userId) => {
 *   const response = await fetch(`/api/users/${userId}`);
 *   return response.ok;
 * };
 *
 * const isValidEmail: PredicateAsync = async (email) => {
 *   if (typeof email !== 'string') return false;
 *   const response = await fetch('/api/validate-email', {
 *     method: 'POST',
 *     body: JSON.stringify({ email })
 *   });
 *   return response.ok;
 * };
 *
 * // File system checks
 * const fileExists: PredicateAsync = async (path) => {
 *   try {
 *     await fs.access(path);
 *     return true;
 *   } catch {
 *     return false;
 *   }
 * };
 *
 * // Usage in async contexts
 * async function processValidUsers(userIds: unknown[]) {
 *   const validUsers = [];
 *   for (const id of userIds) {
 *     if (await userExists(id)) {
 *       validUsers.push(id);
 *     }
 *   }
 *   return validUsers;
 * }
 *
 * // Promise.all for parallel validation
 * async function validateAllEmails(emails: unknown[]) {
 *   const validationPromises = emails.map(isValidEmail);
 *   const results = await Promise.all(validationPromises);
 *   return emails.filter((_, index) => results[index]);
 * }
 * ```
 */
export type PredicateAsync = (input: unknown) => Promise<boolean>;

/**
 * Function type that takes unknown input and returns boolean or Promise<boolean>.
 * This type represents a predicate function that can work in both synchronous and
 * asynchronous contexts, returning either a boolean directly or a Promise<boolean>.
 * Useful for creating flexible APIs that can handle both sync and async predicates.
 *
 * @example
 * ```ts
 * // Functions that work with both sync and async predicates
 * const isString: PredicateMaybeAsync = (input) => typeof input === 'string';
 * const userExists: PredicateMaybeAsync = async (userId) => {
 *   const response = await fetch(`/api/users/${userId}`);
 *   return response.ok;
 * };
 *
 * // Flexible validation function
 * async function validateInput(
 *   value: unknown,
 *   validator: PredicateMaybeAsync
 * ): Promise<boolean> {
 *   const result = validator(value);
 *   return Promise.resolve(result); // Handles both sync and async results
 * }
 *
 * // Usage with both types
 * await validateInput('hello', isString); // Works with sync predicate
 * await validateInput(123, userExists);   // Works with async predicate
 *
 * // Array of mixed predicates
 * const validators: PredicateMaybeAsync[] = [
 *   (input) => typeof input === 'string',           // sync
 *   async (input) => input !== null,                // async
 *   (input) => String(input).length > 0            // sync
 * ];
 *
 * async function validateWithAll(value: unknown) {
 *   for (const validator of validators) {
 *     const isValid = await Promise.resolve(validator(value));
 *     if (!isValid) return false;
 *   }
 *   return true;
 * }
 *
 * // Conditional predicate creation
 * function createValidator(useAsync: boolean): PredicateMaybeAsync {
 *   if (useAsync) {
 *     return async (input) => {
 *       await new Promise(resolve => setTimeout(resolve, 100));
 *       return input !== null;
 *     };
 *   }
 *   return (input) => input !== null;
 * }
 * ```
 */
export type PredicateMaybeAsync = (input: unknown) => Promisable<boolean>;

/**
 * Type utility that transforms a function to return Promisable<ReturnType> instead of ReturnType.
 * This utility type takes any function type and creates a version that can return either
 * the original return type directly or wrapped in a Promise. Useful for creating flexible
 * APIs that can work in both synchronous and asynchronous contexts.
 *
 * @template T - Function type to transform
 *
 * @example
 * ```ts
 * // Transform regular functions to promisable versions
 * type Calculator = (a: number, b: number) => number;
 * type PromisableCalculator = PromisableFunction<Calculator>;
 * // (a: number, b: number) => Promisable<number>
 *
 * // Sync implementation
 * const addSync: PromisableCalculator = (a, b) => a + b;
 *
 * // Async implementation
 * const addAsync: PromisableCalculator = async (a, b) => {
 *   await new Promise(resolve => setTimeout(resolve, 100));
 *   return a + b;
 * };
 *
 * // String processor function
 * type StringProcessor = (text: string) => string;
 * type PromisableStringProcessor = PromisableFunction<StringProcessor>;
 *
 * const upperCaseSync: PromisableStringProcessor = (text) => text.toUpperCase();
 * const upperCaseAsync: PromisableStringProcessor = async (text) => {
 *   // Simulate async processing
 *   return new Promise(resolve =>
 *     setTimeout(() => resolve(text.toUpperCase()), 50)
 *   );
 * };
 *
 * // Generic handler for promisable functions
 * async function handleCalculation<T extends (...args: any) => any>(
 *   fn: PromisableFunction<T>,
 *   ...args: Parameters<T>
 * ): Promise<ReturnType<T>> {
 *   const result = fn(...args);
 *   return Promise.resolve(result);
 * }
 *
 * // Usage with both sync and async functions
 * await handleCalculation(addSync, 2, 3);    // 5
 * await handleCalculation(addAsync, 2, 3);   // 5 (after delay)
 *
 * // API design pattern
 * interface DataProcessor<T> {
 *   transform: PromisableFunction<(data: T) => T>;
 *   validate: PromisableFunction<(data: T) => boolean>;
 * }
 * ```
 */
export type PromisableFunction<T extends (...inputs: any) => any,> = (
  ...inputs: Parameters<T>
) => Promisable<ReturnType<T>>;
