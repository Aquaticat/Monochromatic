import { isEmptyArray, } from './array.empty.ts';
import type { MaybeAsyncIterable, } from './iterable.type.maybe.ts';
import type { PromisableFunction, } from './promise.type.ts';

//region Type Definitions -- Defines reducer function signatures for different parameter combinations

/**
 * Reducer function that receives accumulator and current value.
 * @template T_accumulated - Type of accumulated value
 * @template T_element - Type of iterable elements
 */
export type ReducingFunctionWithAccumulatorAndCurrentValue<T_accumulated, T_element,> = (
  accumulator: T_accumulated,
  currentValue: T_element,
) => T_accumulated;

/**
 * Reducer function that receives accumulator, current value, and current index.
 * @template T_accumulated - Type of accumulated value
 * @template T_element - Type of iterable elements
 */
export type ReducingFunctionWithAccumulatorAndCurrentValueAndIndex<T_accumulated,
  T_element,> = (
    accumulator: T_accumulated,
    currentValue: T_element,
    currentIndex: number,
  ) => T_accumulated;

/**
 * Reducer function that receives accumulator, current value, current index, and source array.
 * @template T_accumulated - Type of accumulated value
 * @template T_element - Type of iterable elements
 */
export type ReducingFunctionWithAccumulatorAndCurrentValueAndIndexAndArray<T_accumulated,
  T_element,> = (
    accumulator: T_accumulated,
    currentValue: T_element,
    currentIndex: number,
    array: T_element[],
  ) => T_accumulated;

/**
 * Union type for all synchronous reducer function signatures.
 * @template T_accumulated - Type of accumulated value
 * @template T_element - Type of iterable elements
 */
export type ReducingFunction<T_accumulated, T_element,> =
  | ReducingFunctionWithAccumulatorAndCurrentValue<T_accumulated, T_element>
  | ReducingFunctionWithAccumulatorAndCurrentValueAndIndex<T_accumulated, T_element>
  | ReducingFunctionWithAccumulatorAndCurrentValueAndIndexAndArray<T_accumulated,
    T_element>;

/**
 * Union type for all asynchronous reducer function signatures.
 * @template T_accumulated - Type of accumulated value
 * @template T_element - Type of iterable elements
 */
export type ReducingFunctionPromisable<T_accumulated, T_element,> =
  | PromisableFunction<
    ReducingFunctionWithAccumulatorAndCurrentValue<T_accumulated, T_element>
  >
  | PromisableFunction<
    ReducingFunctionWithAccumulatorAndCurrentValueAndIndex<T_accumulated, T_element>
  >
  | PromisableFunction<
    ReducingFunctionWithAccumulatorAndCurrentValueAndIndexAndArray<T_accumulated,
      T_element>
  >;

/**
 * Union type for reducer functions that don't receive the source array parameter.
 * Used in generator functions where array context isn't available.
 * @template T_accumulated - Type of accumulated value
 * @template T_element - Type of iterable elements
 */
export type ReducingFunctionNoArray<T_accumulated, T_element,> =
  | ReducingFunctionWithAccumulatorAndCurrentValue<T_accumulated, T_element>
  | ReducingFunctionWithAccumulatorAndCurrentValueAndIndex<T_accumulated, T_element>;

/**
 * Union type for asynchronous reducer functions that don't receive the source array parameter.
 * Used in async generator functions where array context isn't available.
 * @template T_accumulated - Type of accumulated value
 * @template T_element - Type of iterable elements
 */
export type ReducingFunctionNoArrayPromisable<T_accumulated, T_element,> =
  | PromisableFunction<
    ReducingFunctionWithAccumulatorAndCurrentValue<T_accumulated, T_element>
  >
  | PromisableFunction<
    ReducingFunctionWithAccumulatorAndCurrentValueAndIndex<T_accumulated, T_element>
  >;

//endregion Type Definitions

//region Async Reduce Functions -- Handles asynchronous reduction operations on iterables

/**
 * Reduces an async iterable to a single value using an async reducer function.
 * Processes elements sequentially to maintain reduce semantics.
 *
 * @template T_accumulated - Type of accumulated value
 * @template T_element - Type of iterable elements
 * @param initialValue - Starting value for accumulation
 * @param reducer - Async function to combine accumulator with each element
 * @param arrayLike - Async iterable to reduce
 * @returns Accumulated result after processing all elements
 * @example
 * ```ts
 * const numbers = [1, 2, 3, 4];
 * const sum = await reduceIterableAsync(0, async (acc, val) => acc + val, numbers);
 * // Result: 10
 *
 * const asyncSum = await reduceIterableAsync(
 *   0,
 *   async (acc, val, index) => {
 *     await new Promise(resolve => setTimeout(resolve, 10));
 *     return acc + val * index;
 *   },
 *   numbers
 * );
 * // Result: 20 (0*0 + 1*1 + 2*2 + 3*3)
 * ```
 */
export async function reduceIterableAsync<const T_accumulated, const T_element,>(
  initialValue: T_accumulated,
  reducer: ReducingFunctionPromisable<T_accumulated, T_element>,
  arrayLike: MaybeAsyncIterable<T_element>,
): Promise<T_accumulated> {
  const arrayLikeArray: T_element[] = await Array.fromAsync(arrayLike,);

  if (isEmptyArray(arrayLikeArray,))
    return initialValue;

  let accumulator: T_accumulated = initialValue;

  for (const [internalCurrentIndex, arrayLikeElement,] of arrayLikeArray.entries()) {
    // oxlint-disable-next-line no-await-in-loop -- Sequential processing is necessary for reduce semantics.
    accumulator = await reducer(
      accumulator,
      arrayLikeElement,
      internalCurrentIndex,
      arrayLikeArray,
    );
  }

  return accumulator;
}

//endregion Async Reduce Functions

//region Synchronous Reduce Functions -- Handles synchronous reduction operations on iterables

/**
 * Reduces an iterable to a single value using a synchronous reducer function.
 * {@inheritDoc reduceIterableAsync}
 *
 * @template T_accumulated - Type of accumulated value
 * @template T_element - Type of iterable elements
 * @param initialValue - Starting value for accumulation
 * @param reducer - Function to combine accumulator with each element
 * @param arrayLike - Iterable to reduce
 * @returns Accumulated result after processing all elements
 * @example
 * ```ts
 * const numbers = [1, 2, 3, 4];
 * const sum = reduceIterable(0, (acc, val) => acc + val, numbers);
 * // Result: 10
 *
 * const product = reduceIterable(1, (acc, val, index) => acc * (val + index), numbers);
 * // Result: 1 * (1+0) * (2+1) * (3+2) * (4+3) = 1 * 1 * 3 * 5 * 7 = 105
 * ```
 */
export function reduceIterable<T_accumulated, T_element,>(
  initialValue: T_accumulated,
  reducer: ReducingFunction<T_accumulated, T_element>,
  arrayLike: Iterable<T_element>,
): T_accumulated {
  const arrayLikeArray: T_element[] = [...arrayLike,];

  return arrayLikeArray.reduce(
    // eslint-disable-next-line unicorn/no-array-callback-reference -- reducer is designed to work.
    reducer,
    initialValue,
  );
}

//endregion Synchronous Reduce Functions

//region Generator Reduce Functions -- Provides streaming reduction with intermediate values

/**
 * Generates intermediate reduction values while processing an iterable.
 * Yields initial value first, then each accumulated result after processing each element.
 *
 * @template T_accumulated - Type of accumulated value
 * @template T_element - Type of iterable elements
 * @param initialValue - Starting value for accumulation
 * @param reducer - Function to combine accumulator with each element (no array parameter)
 * @param arrayLike - Iterable to reduce
 * @returns Generator yielding accumulated values at each step
 * @example
 * ```ts
 * const numbers = [1, 2, 3, 4];
 * const runningSum = [...reduceIterableGen(0, (acc, val) => acc + val, numbers)];
 * // Result: [0, 1, 3, 6, 10] (initial + cumulative sums)
 *
 * const runningProduct = [...reduceIterableGen(1, (acc, val, index) => acc * (val + index), numbers)];
 * // Result: [1, 1, 3, 15, 105] (1, 1*(1+0), 1*(2+1), 3*(3+2), 15*(4+3))
 * ```
 */
export function* reduceIterableGen<const T_accumulated, const T_element,>(
  initialValue: T_accumulated,
  reducer: ReducingFunctionNoArray<T_accumulated, T_element>,
  arrayLike: Iterable<T_element>,
): Generator<T_accumulated> {
  let accumulator: T_accumulated = initialValue;

  // Yield the initial value
  yield accumulator;

  let index = 0;
  for (const element of arrayLike) {
    accumulator = reducer(accumulator, element, index++,);
    yield accumulator;
  }
}

//endregion Generator Reduce Functions

/**
 * Generates intermediate reduction values while processing an async iterable.
 * Yields initial value first, then each accumulated result after processing each element.
 * {@inheritDoc reduceIterableGen}
 *
 * @template T_accumulated - Type of accumulated value
 * @template T_element - Type of iterable elements
 * @param initialValue - Starting value for accumulation
 * @param reducer - Function to combine accumulator with each element (no array parameter, supports promises)
 * @param arrayLike - Async iterable to reduce
 * @returns Async generator yielding accumulated values at each step
 * @example
 * ```ts
 * async function* asyncNumbers() {
 *   yield 1; yield 2; yield 3; yield 4;
 * }
 *
 * const runningSum: number[] = [];
 * for await (const sum of reduceIterableAsyncGen(0, (acc, val) => acc + val, asyncNumbers())) {
 *   runningSum.push(sum);
 * }
 * // Result: [0, 1, 3, 6, 10] (initial + cumulative sums)
 *
 * const runningProduct: number[] = [];
 * for await (const product of reduceIterableAsyncGen(1, (acc, val, index) => acc * (val + index), asyncNumbers())) {
 *   runningProduct.push(product);
 * }
 * // Result: [1, 1, 3, 15, 105] (1, 1*(1+0), 1*(2+1), 3*(3+2), 15*(4+3))
 * ```
 */
export async function* reduceIterableAsyncGen<const T_accumulated, const T_element,>(
  initialValue: T_accumulated,
  reducer: ReducingFunctionNoArrayPromisable<T_accumulated, T_element>,
  arrayLike: MaybeAsyncIterable<T_element>,
): AsyncGenerator<T_accumulated> {
  let accumulator: T_accumulated = initialValue;

  // Yield the initial value
  yield accumulator;

  let index = 0;
  for await (const element of arrayLike) {
    accumulator = await reducer(accumulator, element, index++,);
    yield accumulator;
  }
}
