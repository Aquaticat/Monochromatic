/**
 * Runtime assertions that pass the value through or throw.
 *
 * Each helper narrows the static type when the runtime check passes
 * and throws a descriptive `Error` when it fails.
 * Use these wherever the non-null assertion operator (`!`) would otherwise
 * be reached for; the runtime check turns a silent type lie into a loud,
 * debuggable failure.
 *
 * Categories:
 * - Boolean shape: `nonNullishOrThrow`, `truthyOrThrow`, `falsyOrThrow`
 * - Container size: `emptyOrThrow`, `nonemptyOrThrow`
 * - Iterable protocols: `iterableOrThrow`, `asyncIterableOrThrow`, `maybeAsyncIterableOrThrow`
 * - Container instances: `arrayOrThrow`, `setOrThrow`, `mapOrThrow`, `weakSetOrThrow`, `weakMapOrThrow`
 * - Standard built-ins: `promiseOrThrow`, `dateOrThrow`, `regExpOrThrow`, `errorOrThrow`
 * - typeof primitives: `stringOrThrow`, `numberOrThrow`, `bigintOrThrow`, `booleanOrThrow`, `symbolOrThrow`, `functionOrThrow`, `objectOrThrow`
 * - Numeric union: `numericOrThrow`
 * - Custom predicates: `satisfiesOrThrow`, `satisfiesOrThrowAsync`
 *
 * @example
 * ```ts
 * import {
 *   arrayOrThrow,
 *   nonNullishOrThrow,
 *   stringOrThrow,
 * } from '\@monochromatic-dev/module-or-throw';
 *
 * const el = nonNullishOrThrow(document.querySelector('.target',),);
 * const text = stringOrThrow(el.textContent,);
 * const tokens = arrayOrThrow(text.match(/\\w+/g,),);
 * ```
 *
 * @packageDocumentation
 */

export type { ExtractOrUnknown, } from './extract-or-unknown.ts';
export type { Falsy, } from './falsy.ts';
export type {
  SatisfiesOrThrowAsyncOptions,
  SatisfiesOrThrowAsyncPredicate,
  SatisfiesOrThrowAsyncPredicateOptions,
  SatisfiesOrThrowEqualityOptions,
  SatisfiesOrThrowOptions,
  SatisfiesOrThrowPredicate,
  SatisfiesOrThrowPredicateOptions,
  SatisfiesOrThrowPredicateParameters,
} from './satisfies-or-throw.ts';

export {
  satisfiesOrThrow,
  satisfiesOrThrowAsync,
} from './satisfies-or-throw.ts';

export { nonNullishOrThrow, } from './non-nullish-or-throw.ts';

export { truthyOrThrow, } from './truthy-or-throw.ts';

export { falsyOrThrow, } from './falsy-or-throw.ts';

export { emptyOrThrow, } from './empty-or-throw.ts';

export { nonemptyOrThrow, } from './nonempty-or-throw.ts';

export { iterableOrThrow, } from './iterable-or-throw.ts';

export { asyncIterableOrThrow, } from './async-iterable-or-throw.ts';

export { maybeAsyncIterableOrThrow, } from './maybe-async-iterable-or-throw.ts';

export { arrayOrThrow, } from './array-or-throw.ts';

export { setOrThrow, } from './set-or-throw.ts';

export { mapOrThrow, } from './map-or-throw.ts';

export { weakSetOrThrow, } from './weak-set-or-throw.ts';

export { weakMapOrThrow, } from './weak-map-or-throw.ts';

export { promiseOrThrow, } from './promise-or-throw.ts';

export { dateOrThrow, } from './date-or-throw.ts';

export { regExpOrThrow, } from './regexp-or-throw.ts';

export { errorOrThrow, } from './error-or-throw.ts';

export { stringOrThrow, } from './string-or-throw.ts';

export { numberOrThrow, } from './number-or-throw.ts';

export { bigintOrThrow, } from './bigint-or-throw.ts';

export { booleanOrThrow, } from './boolean-or-throw.ts';

export { symbolOrThrow, } from './symbol-or-throw.ts';

export { functionOrThrow, } from './function-or-throw.ts';

export { objectOrThrow, } from './object-or-throw.ts';

export { numericOrThrow, } from './numeric-or-throw.ts';
