/* @__NO_SIDE_EFFECTS__ */ export function unary<T_param1,
  T_fn extends (param1: T_param1, ...otherParams: unknown[]) => any,>(
  fn: T_fn,
): (param1: T_param1) => ReturnType<T_fn> {
  return function unaryfied(param1) {
    return fn(param1);
  };
}

/* @__NO_SIDE_EFFECTS__ */ export function binary<T_param1, T_param2,
  T_fn extends (param1: T_param1, param2: T_param2, ...otherParams: unknown[]) => any,>(
  fn: T_fn,
): (param1: T_param1, param2: T_param2) => ReturnType<T_fn> {
  return function binaryfied(param1, param2) {
    return fn(param1, param2);
  };
}

/* @__NO_SIDE_EFFECTS__ */ export function trinary<T_param1, T_param2, T_param3,
  T_fn extends (param1: T_param1, param2: T_param2, param3: T_param3,
    ...otherParams: unknown[]) => any,>(
  fn: T_fn,
): (param1: T_param1, param2: T_param2, param3: T_param3) => ReturnType<T_fn> {
  return function binaryfied(param1, param2, param3) {
    return fn(param1, param2, param3);
  };
}
