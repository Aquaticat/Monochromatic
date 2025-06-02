import type { MinusOne } from './numeric.type.int.ts';

type CanTakeRequiredArgsOrNever<T_fn extends (args: any[]) => any, N extends number,> =
  N extends 0 ? T_fn
    : Parameters<T_fn>[MinusOne<N>] extends infer ArgType
      ? ArgType extends never ? never : T_fn
    : never;

export function unary<
  const T extends (...args: any[]) => any,
>(
  fn: CanTakeRequiredArgsOrNever<T, 1>,
): (param1: Parameters<T>[0]) => ReturnType<T> {
  return function unaryfied(param1): ReturnType<T> {
    return fn(param1);
  };
}

/* @__NO_SIDE_EFFECTS__ */ export function binary<
  const T extends (...args: any[]) => any,
>(
  fn: CanTakeRequiredArgsOrNever<T, 2>,
): (param1: Parameters<T>[0], param2: Parameters<T>[1]) => ReturnType<T> {
  return function binaryfied(param1, param2): ReturnType<T> {
    return fn(param1, param2);
  };
}

/* @__NO_SIDE_EFFECTS__ */ export function ternary<
  const T extends (...args: any[]) => any,
>(
  fn: CanTakeRequiredArgsOrNever<T, 3>,
): (param1: Parameters<T>[0], param2: Parameters<T>[1],
  param3: Parameters<T>[2]) => ReturnType<T>
{
  return function ternaryfied(param1, param2, param3): ReturnType<T> {
    return fn(param1, param2, param3);
  };
}
