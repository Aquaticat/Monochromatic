export function spreadArguments<Fn extends (...args: any) => any,>(
  fn: Fn,
): (argumentsArray: Parameters<Fn>) => ReturnType<Fn> {
  return function spreadFn(argumentsArray: Parameters<Fn>): ReturnType<Fn> {
    return fn(...argumentsArray);
  };
}

export function gatherArguments<Fn extends (arg: any[]) => any,>(
  fn: Fn,
): (...argumentsArray: Parameters<Fn>[0]) => ReturnType<Fn> {
  return function gatheredFn(...argumentsArray: Parameters<Fn>[0]): ReturnType<Fn> {
    return fn(argumentsArray);
  };
}
