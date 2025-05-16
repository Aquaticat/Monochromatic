export const thunk = <Args extends unknown[], T,>(
  fn: (...args: Args) => T,
): (...args: Args) => T => {
  return function thunked(...args: Args): T {
    return fn(...args);
  };
};
