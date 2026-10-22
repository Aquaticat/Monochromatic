/**
 Fixture that reads which per-call deadlines a client armed, for the cases that pin the length of a deadline without
 waiting for it. Nothing here reaches a provider.

 @module
 */

/**
 Shortest delay the fixture reports, in milliseconds: the per-call deadlines are minutes long, and shorter delays
 belong to pacing and backoff timers the case does not ask about.
 */
const DEADLINE_FLOOR_MS = 100_000;

/**
 Runs work and reports every timer of a deadline's length that the work armed, in the order armed.

 THE GLOBAL `setTimeout` IS WRAPPED FOR THE LENGTH OF THE WORK AND PUT BACK AFTER IT, however it ends; the wrapper
 passes every call through, so the deadline's own timer still arms and is cleared by the client's disposal. A case
 that uses this runs alone in its file, since the wrapper sees every timer of the process.

 @param run - work to run

 @returns The work's result and the delays armed at or above the fixture's floor

 @example
 ```ts
 const { armed, } = await armedDeadlinesDuring({ run: async () => await askCat({ client, modelId, },), },);
 ```
 */
export async function armedDeadlinesDuring<Result,>(
  { run, }: { readonly run: () => Promise<Result>; },
): Promise<{
  readonly result: Result;
  readonly armed: readonly number[];
}> {
  /**
   Delays seen, in the order armed.
   */
  const armed: number[] = [];

  /**
   The timer function the process had before the wrapper.
   */
  const original = globalThis.setTimeout;
  globalThis.setTimeout = function recordingSetTimeout(
    ...args: Parameters<typeof globalThis.setTimeout>
  ): ReturnType<typeof globalThis.setTimeout> {
    /**
     Delay the caller asked for, absent for none.
     */
    const delay: unknown = args[1];
    if (((typeof delay) === 'number') && (delay >= DEADLINE_FLOOR_MS))
      armed.push(delay,);
    return original(...args,);
  } as typeof globalThis.setTimeout;
  try {
    return {
      result: await run(),
      armed,
    };
  }
  finally {
    globalThis.setTimeout = original;
  }
}
