import type {
  WithoutFirst,
  WithoutFirst10,
  WithoutFirst2,
  WithoutFirst3,
  WithoutFirst4,
  WithoutFirst5,
  WithoutFirst6,
  WithoutFirst7,
  WithoutFirst8,
  WithoutFirst9,
} from './array.type.withoutFirst.ts';

/**
 * Creates a function that invokes `fn` with one or more `presetInputs`
 * prepended to the arguments it receives. This is known as
 * [partial application](https://en.wikipedia.org/wiki/Partial_application).
 *
 * This function is like `curry`, but it doesn't support placeholders and is
 * not auto-curried.
 *
 * @param fn - function to partially apply arguments to.
 * @param presetInput0 - first argument to prepend to `fn`'s invocation.
 * @returns new partially applied function.
 * @example
 * ```ts
 * import { partial } from '@monochromatic-dev/module-es';
 *
 * const greet = (greeting: string, name: string) => `${greeting}, ${name}!`;
 *
 * const sayHelloTo = partial(greet, 'Hello');
 * console.log(sayHelloTo('Fred'));
 * // => 'Hello, Fred!'
 * ```
 * @example
 * ```ts
 * import { partial } from '@monochromatic-dev/module-es';
 *
 * const add = (a: number, b: number, c: number) => a + b + c;
 *
 * const add5 = partial(add, 2, 3);
 * console.log(add5(4));
 * // => 9
 * ```
 */
export function partial<T_0, T_others extends readonly any[], T_returns,>(
  fn: (input0: T_0, ...rest: T_others) => T_returns,
  presetInput0: T_0,
): (...laterInputs: T_others) => T_returns;

export function partial<T_0, T_1, T_others extends readonly any[], T_returns,>(
  fn: (input0: T_0, input1: T_1, ...rest: T_others) => T_returns,
  presetInput0: T_0,
  presetInput1: T_1,
): (...laterInputs: T_others) => T_returns;
export function partial<T_0, T_1, T_2, T_others extends readonly any[], T_returns,>(
  fn: (input0: T_0, input1: T_1, input2: T_2, ...rest: T_others) => T_returns,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
): (...laterInputs: T_others) => T_returns;

export function partial<T_0, T_1, T_2, T_3, T_others extends readonly any[], T_returns,>(
  fn: (input0: T_0, input1: T_1, input2: T_2, input3: T_3,
    ...rest: T_others) => T_returns,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
): (...laterInputs: T_others) => T_returns;

export function partial<T_0, T_1, T_2, T_3, T_4, T_others extends readonly any[],
  T_returns,>(
  fn: (input0: T_0, input1: T_1, input2: T_2, input3: T_3, input4: T_4,
    ...rest: T_others) => T_returns,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
  presetInput4: T_4,
): (...laterInputs: T_others) => T_returns;

export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_others extends readonly any[],
  T_returns,>(
  fn: (input0: T_0, input1: T_1, input2: T_2, input3: T_3, input4: T_4, input5: T_5,
    ...rest: T_others) => T_returns,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
  presetInput4: T_4,
  presetInput5: T_5,
): (...laterInputs: T_others) => T_returns;

export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6,
  T_others extends readonly any[], T_returns,>(
  fn: (input0: T_0, input1: T_1, input2: T_2, input3: T_3, input4: T_4, input5: T_5,
    input6: T_6, ...rest: T_others) => T_returns,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
  presetInput4: T_4,
  presetInput5: T_5,
  presetInput6: T_6,
): (...laterInputs: T_others) => T_returns;

export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7,
  T_others extends readonly any[], T_returns,>(
  fn: (input0: T_0, input1: T_1, input2: T_2, input3: T_3, input4: T_4, input5: T_5,
    input6: T_6, input7: T_7, ...rest: T_others) => T_returns,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
  presetInput4: T_4,
  presetInput5: T_5,
  presetInput6: T_6,
  presetInput7: T_7,
): (...laterInputs: T_others) => T_returns;

export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8,
  T_others extends readonly any[], T_returns,>(
  fn: (input0: T_0, input1: T_1, input2: T_2, input3: T_3, input4: T_4, input5: T_5,
    input6: T_6, input7: T_7, input8: T_8, ...rest: T_others) => T_returns,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
  presetInput4: T_4,
  presetInput5: T_5,
  presetInput6: T_6,
  presetInput7: T_7,
  presetInput8: T_8,
): (...laterInputs: T_others) => T_returns;

export function partial<T_0, T_1, T_2, T_3, T_4, T_5, T_6, T_7, T_8, T_9,
  T_others extends readonly any[], T_returns,>(
  fn: (input0: T_0, input1: T_1, input2: T_2, input3: T_3, input4: T_4, input5: T_5,
    input6: T_6, input7: T_7, input8: T_8, input9: T_9, ...rest: T_others) => T_returns,
  presetInput0: T_0,
  presetInput1: T_1,
  presetInput2: T_2,
  presetInput3: T_3,
  presetInput4: T_4,
  presetInput5: T_5,
  presetInput6: T_6,
  presetInput7: T_7,
  presetInput8: T_8,
  presetInput9: T_9,
): (...laterInputs: T_others) => T_returns;

/** @internal */
export function partial<T_0, T_fn extends (input0: T_0, ...rest: any[]) => any,>(
  fn: T_fn,
  presetInput0: T_0,
  presetInput1?: Parameters<T_fn>[1],
  presetInput2?: Parameters<T_fn>[2],
  presetInput3?: Parameters<T_fn>[3],
  presetInput4?: Parameters<T_fn>[4],
  presetInput5?: Parameters<T_fn>[5],
  presetInput6?: Parameters<T_fn>[6],
  presetInput7?: Parameters<T_fn>[7],
  presetInput8?: Parameters<T_fn>[8],
  presetInput9?: Parameters<T_fn>[9],
): (...laterInputs: any[]) => ReturnType<T_fn> {
  if (!presetInput1) {
    return function partiallyApplied(
      ...laterInputs: WithoutFirst<Parameters<T_fn>>
    ): ReturnType<T_fn> {
      return fn(presetInput0, ...laterInputs);
    };
  }

  if (!presetInput2) {
    return function partiallyApplied(
      ...laterInputs: WithoutFirst2<Parameters<T_fn>>
    ): ReturnType<T_fn> {
      return fn(presetInput0, presetInput1, ...laterInputs);
    };
  }

  if (!presetInput3) {
    return function partiallyApplied(
      ...laterInputs: WithoutFirst3<Parameters<T_fn>>
    ): ReturnType<T_fn> {
      return fn(presetInput0, presetInput1, presetInput2, ...laterInputs);
    };
  }

  if (!presetInput4) {
    return function partiallyApplied(
      ...laterInputs: WithoutFirst4<Parameters<T_fn>>
    ): ReturnType<T_fn> {
      return fn(
        presetInput0,
        presetInput1,
        presetInput2,
        presetInput3,
        ...laterInputs,
      );
    };
  }

  if (!presetInput5) {
    return function partiallyApplied(
      ...laterInputs: WithoutFirst5<Parameters<T_fn>>
    ): ReturnType<T_fn> {
      return fn(
        presetInput0,
        presetInput1,
        presetInput2,
        presetInput3,
        presetInput4,
        ...laterInputs,
      );
    };
  }

  if (!presetInput6) {
    return function partiallyApplied(
      ...laterInputs: WithoutFirst6<Parameters<T_fn>>
    ): ReturnType<T_fn> {
      return fn(
        presetInput0,
        presetInput1,
        presetInput2,
        presetInput3,
        presetInput4,
        presetInput5,
        ...laterInputs,
      );
    };
  }

  if (!presetInput7) {
    return function partiallyApplied(
      ...laterInputs: WithoutFirst7<Parameters<T_fn>>
    ): ReturnType<T_fn> {
      return fn(
        presetInput0,
        presetInput1,
        presetInput2,
        presetInput3,
        presetInput4,
        presetInput5,
        presetInput6,
        ...laterInputs,
      );
    };
  }

  if (!presetInput8) {
    return function partiallyApplied(
      ...laterInputs: WithoutFirst8<Parameters<T_fn>>
    ): ReturnType<T_fn> {
      return fn(
        presetInput0,
        presetInput1,
        presetInput2,
        presetInput3,
        presetInput4,
        presetInput5,
        presetInput6,
        presetInput7,
        ...laterInputs,
      );
    };
  }

  if (!presetInput9) {
    return function partiallyApplied(
      ...laterInputs: WithoutFirst9<Parameters<T_fn>>
    ): ReturnType<T_fn> {
      return fn(
        presetInput0,
        presetInput1,
        presetInput2,
        presetInput3,
        presetInput4,
        presetInput5,
        presetInput6,
        presetInput7,
        presetInput8,
        ...laterInputs,
      );
    };
  }

  return function partiallyApplied(
    ...laterInputs: WithoutFirst10<Parameters<T_fn>>
  ): ReturnType<T_fn> {
    return fn(
      presetInput0,
      presetInput1,
      presetInput2,
      presetInput3,
      presetInput4,
      presetInput5,
      presetInput6,
      presetInput7,
      presetInput8,
      presetInput9,
      ...laterInputs,
    );
  };
}
