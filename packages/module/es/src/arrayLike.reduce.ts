import {
  isEmptyArray,
  type MaybeAsyncIterable,
} from '@monochromatic-dev/module-es/ts';
import type { Promisable } from 'type-fest';
import type { PromisableFunction } from './promise.type.ts';

export type ReducingFunctionWithAccumulatorAndCurrentValue<T_accumulated, T_element,> = (
  accumulator: T_accumulated,
  currentValue: T_element,
) => T_accumulated;

export type ReducingFunctionWithAccumulatorAndCurrentValueAndIndex<T_accumulated,
  T_element,> = (
    accumulator: T_accumulated,
    currentValue: T_element,
    currentIndex: number,
  ) => T_accumulated;

export type ReducingFunctionWithAccumulatorAndCurrentValueAndIndexAndArray<T_accumulated,
  T_element,> = (
    accumulator: T_accumulated,
    currentValue: T_element,
    currentIndex: number,
    array: T_element[],
  ) => T_accumulated;

export type ReducingFunction<T_accumulated, T_element,> =
  | ReducingFunctionWithAccumulatorAndCurrentValue<T_accumulated, T_element>
  | ReducingFunctionWithAccumulatorAndCurrentValueAndIndex<T_accumulated, T_element>
  | ReducingFunctionWithAccumulatorAndCurrentValueAndIndexAndArray<T_accumulated,
    T_element>;

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

export type ReducingFunctionNoArray<T_accumulated, T_element,> =
  | ReducingFunctionWithAccumulatorAndCurrentValue<T_accumulated, T_element>
  | ReducingFunctionWithAccumulatorAndCurrentValueAndIndex<T_accumulated, T_element>;

export type ReducingFunctionNoArrayPromisable<T_accumulated, T_element,> =
  | PromisableFunction<
    ReducingFunctionWithAccumulatorAndCurrentValue<T_accumulated, T_element>
  >
  | PromisableFunction<
    ReducingFunctionWithAccumulatorAndCurrentValueAndIndex<T_accumulated, T_element>
  >;

/* @__NO_SIDE_EFFECTS__ */ export async function reduceArrayLikeAsync<const T_accumulated,
  const T_element,>(
  initialValue: T_accumulated,
  reducer: ReducingFunctionPromisable<T_accumulated, T_element>,
  arrayLike: MaybeAsyncIterable<T_element>,
): Promise<T_accumulated> {
  const arrayLikeArray: T_element[] = await Array.fromAsync(arrayLike);

  if (isEmptyArray(arrayLikeArray)) {
    return initialValue;
  }

  let accumulator: T_accumulated = initialValue;

  for (const [internalCurrentIndex, arrayLikeElement] of arrayLikeArray.entries()) {
    // eslint-disable-next-line no-await-in-loop -- Sequential processing is necessary for reduce semantics.
    accumulator = await reducer(
      accumulator,
      arrayLikeElement,
      internalCurrentIndex,
      arrayLikeArray,
    );
  }

  return accumulator;
}

/* @__NO_SIDE_EFFECTS__ */ export function reduceArrayLike<T_accumulated, T_element,>(
  initialValue: T_accumulated,
  reducer: ReducingFunction<T_accumulated, T_element>,
  arrayLike: Iterable<T_element>,
): T_accumulated {
  const arrayLikeArray: T_element[] = [...arrayLike];

  return arrayLikeArray.reduce(
    reducer,
    initialValue,
  );
}

/* @__NO_SIDE_EFFECTS__ */
export function* reduceArrayLikeGen<const T_accumulated, const T_element,>(
  initialValue: T_accumulated,
  reducer: ReducingFunctionNoArray<T_accumulated, T_element>,
  arrayLike: Iterable<T_element>,
): Generator<T_accumulated> {
  let accumulator: T_accumulated = initialValue;

  // Yield the initial value
  yield accumulator;

  let index = 0;
  for (const element of arrayLike) {
    accumulator = reducer(accumulator, element, index++);
    yield accumulator;
  }
}

/* @__NO_SIDE_EFFECTS__ */
export async function* reduceArrayLikeAsyncGen<const T_accumulated, const T_element,>(
  initialValue: T_accumulated,
  reducer: ReducingFunctionNoArrayPromisable<T_accumulated, T_element>,
  arrayLike: MaybeAsyncIterable<T_element>,
): AsyncGenerator<T_accumulated> {
  let accumulator: T_accumulated = initialValue;

  // Yield the initial value
  yield accumulator;

  let index = 0;
  for await (const element of arrayLike) {
    accumulator = await reducer(accumulator, element, index++);
    yield accumulator;
  }
}
