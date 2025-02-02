import type { Promisable } from 'type-fest';

// MAYBE: Doesn't correctly infer function type.
// Searching "typescript function is async predicate" yields nothing.
/* @__NO_SIDE_EFFECTS__ */ export function isAsyncFunction<T_fnReturnUnwrapped,
  T_inputs extends any[],>(
  fn: (...inputs: T_inputs) => Promisable<T_fnReturnUnwrapped>,
): fn is (...inputs: T_inputs) => Promise<T_fnReturnUnwrapped> {
  return fn.constructor.name === 'AsyncFunction';
}

/* @__NO_SIDE_EFFECTS__ */ export function isSyncFunction<T_fnReturnUnwrapped,
  T_inputs extends any[],>(
  fn: (...inputs: T_inputs) => Promisable<T_fnReturnUnwrapped>,
): fn is (...inputs: T_inputs) => T_fnReturnUnwrapped {
  return fn.constructor.name === 'Function';
}
