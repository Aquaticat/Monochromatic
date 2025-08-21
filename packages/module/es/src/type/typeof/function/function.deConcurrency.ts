export function deConcurrency<const Args extends any[], const Returns,
  const T extends (...args: Args) => Promise<Returns>,>(
  fn: T,
): (...args: Args) => Promise<Awaited<Returns>> {
  let isRunning = false;
  let pendingPromise: Promise<Returns> | null = null;

  return async function(
    ...args: Args
  ): Promise<Awaited<Returns>> {
    // If function is already running, return the pending promise
    if (isRunning && pendingPromise)
      return await pendingPromise;

    // Mark as running and execute the function
    isRunning = true;

    // Execute the wrapped function using async/await
    pendingPromise = fn(...args,);

    const result = await pendingPromise;

    // Reset state when function completes
    isRunning = false;
    pendingPromise = null;

    return result;
  };
}
