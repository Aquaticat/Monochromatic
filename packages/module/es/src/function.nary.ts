/* @__NO_SIDE_EFFECTS__ */ export function unary<
  const T_fn extends (param1: any, ...otherParams: any[]) => any,
>(
  fn: T_fn,
): (param1: Parameters<T_fn>[0]) => ReturnType<T_fn> {
  return function unaryfied(param1) {
    return fn(param1);
  };
}

/* @__NO_SIDE_EFFECTS__ */ export function binary<
  const T_fn extends (param1: any, param2: any, ...otherParams: any[]) => any,
>(
  fn: T_fn,
): (param1: Parameters<T_fn>[0], param2: Parameters<T_fn>[1]) => ReturnType<T_fn> {
  return function binaryfied(param1, param2) {
    return fn(param1, param2);
  };
}

/* @__NO_SIDE_EFFECTS__ */ export function ternary<
  const T_fn extends (param1: any, param2: any, param3: any,
    ...otherParams: any[]) => any,
>(
  fn: T_fn,
): (param1: Parameters<T_fn>[0], param2: Parameters<T_fn>[1],
  param3: Parameters<T_fn>[2]) => ReturnType<T_fn>
{
  return function ternaryfied(param1, param2, param3) {
    return fn(param1, param2, param3);
  };
}
