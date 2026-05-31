import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  PipeStepGapError,
  PipeStepOverflowError,
} from './errors.ts';

import type {
  RunArgs,
  RunCallableArgs,
} from './types.ts';

/**
 * Sentinel returned by `indexOf` when no missing step slot exists.
 */
const NO_STEP_GAP = -1;

/**
 * Throws when a later step appears after a missing step.
 *
 * @param steps - ordered step slots from `fn1` through `fn9`, inspected with array methods only so
 * no `noUncheckedIndexedAccess` guard is needed per element
 *
 * @throws PipeStepGapError when step keys are not contiguous
 *
 * @example
 * ```ts
 * assertContiguousSteps([(input) => input, undefined]);
 * ```
 */
function assertContiguousSteps(steps: readonly unknown[],): void {
  /**
   * First missing step slot, or `-1` when all slots are present.
   */
  const firstGap = steps.indexOf(undefined,);

  if (firstGap === NO_STEP_GAP)
    return;

  /**
   * Whether any later slot is present after the first missing slot.
   */
  const hasLaterStep = steps
    .slice(firstGap + 1,)
    .some(function stepIsPresent(step,) {
      return step !== undefined;
    },);

  if (hasLaterStep)
    throw new PipeStepGapError(firstGap,);
}

/**
 * Throws when an unsupported step beyond `fn9` is present.
 *
 * @param overflowStep - possible unsupported `fn10` step; presence alone (not its value) signals
 * overflow because the overloads cap arity at nine
 *
 * @throws PipeStepOverflowError when `fn10` is present
 *
 * @example
 * ```ts
 * assertNoOverflowStep();
 * ```
 */
function assertNoOverflowStep(overflowStep?: unknown,): void {
  if (overflowStep !== undefined)
    throw new PipeStepOverflowError();
}

/**
 * Applies synchronous pipeline steps with wide implementation types.
 *
 * Dispatches on the first absent `fnN` through an explicit if-chain of nested calls; no array
 * indexing, no recursion. Argument validation runs before step execution so a gap or overflow logs
 * under `invalid pipe arguments`, distinct from the `step failed` log reserved for a throwing step.
 *
 * @param args - value, contiguous step functions, and optional logger
 *
 * @returns final pipeline output
 *
 * @throws PipeStepGapError when step keys are not contiguous
 *
 * @throws PipeStepOverflowError when `fn10` is present
 *
 * @throws whatever pipeline step throws; the throw propagates unchanged
 *
 * @example
 * ```ts
 * const value = runPipe({ value: 1, fn1: (input) => input });
 * ```
 */
export function runPipe(args: RunArgs,): unknown {
  /**
   * Logger tagged at the synchronous core boundary.
   */
  const l = tagged(args.l === undefined
    ? { tag: runPipe.name, }
    : {
      tag: runPipe.name,
      l: args.l,
    },);
  l.debug('entry',);

  /* oxlint-disable typescript/no-unsafe-type-assertion -- widen each step's `never` input to `unknown` for application; RunCallableArgs preserves `this: void`, so this is parameter-variance widening only and the typed overloads remain the type-safe public surface */
  /**
   * Callable arguments with step inputs widened for internal invocation.
   */
  const callableArgs = args as RunCallableArgs;
  /* oxlint-enable typescript/no-unsafe-type-assertion */
  /**
   * Callable value and steps destructured so step functions are invoked without method-style `this`.
   */
  const {
    value,
    fn1,
    fn2,
    fn3,
    fn4,
    fn5,
    fn6,
    fn7,
    fn8,
    fn9,
    fn10,
  } = callableArgs;
  /**
   * Ordered step slots used only for runtime contiguity validation.
   */
  const steps = [
    fn1,
    fn2,
    fn3,
    fn4,
    fn5,
    fn6,
    fn7,
    fn8,
    fn9,
  ] as const;

  try {
    assertNoOverflowStep(fn10,);
    assertContiguousSteps(steps,);
  }
  catch (error) {
    l.error(`invalid pipe arguments: ${String(error,)}`,);
    throw error;
  }

  try {
    if (fn2 === undefined) {
      l.debug('1 step',);
      return fn1(value,);
    }
    if (fn3 === undefined) {
      l.debug('2 steps',);
      return fn2(fn1(value,),);
    }
    if (fn4 === undefined) {
      l.debug('3 steps',);
      return fn3(
        fn2(fn1(value,),),
      );
    }
    if (fn5 === undefined) {
      l.debug('4 steps',);
      return fn4(
        fn3(
          fn2(fn1(value,),),
        ),
      );
    }
    if (fn6 === undefined) {
      l.debug('5 steps',);
      return fn5(
        fn4(
          fn3(
            fn2(fn1(value,),),
          ),
        ),
      );
    }
    if (fn7 === undefined) {
      l.debug('6 steps',);
      return fn6(
        fn5(
          fn4(
            fn3(
              fn2(fn1(value,),),
            ),
          ),
        ),
      );
    }
    if (fn8 === undefined) {
      l.debug('7 steps',);
      return fn7(
        fn6(
          fn5(
            fn4(
              fn3(
                fn2(fn1(value,),),
              ),
            ),
          ),
        ),
      );
    }
    if (fn9 === undefined) {
      l.debug('8 steps',);
      return fn8(
        fn7(
          fn6(
            fn5(
              fn4(
                fn3(fn2(fn1(value,),),),
              ),
            ),
          ),
        ),
      );
    }

    l.debug('9 steps',);
    return fn9(
      fn8(
        fn7(
          fn6(
            fn5(
              fn4(fn3(fn2(fn1(value,),),),),
            ),
          ),
        ),
      ),
    );
  }
  catch (error) {
    l.error(`step failed: ${String(error,)}`,);
    throw error;
  }
}

/**
 * Applies asynchronous pipeline steps with wide implementation types.
 *
 * Awaits the initial value first (so a `T | Promise<T>` is accepted), awaits every intermediate
 * before the next step so steps run strictly sequentially, and awaits the final application so a
 * last-step rejection stays inside the execution `try` and is logged before it propagates.
 * Argument validation runs before execution under the `invalid pipe arguments` log.
 *
 * @param args - possibly promised value, contiguous step functions, and optional logger
 *
 * @returns promise resolving to final pipeline output
 *
 * @throws PipeStepGapError when step keys are not contiguous
 *
 * @throws PipeStepOverflowError when `fn10` is present
 *
 * @throws whatever pipeline step throws or rejects with; the failure propagates unchanged
 *
 * @example
 * ```ts
 * const value = await runPipeAsync({ value: Promise.resolve(1), fn1: (input) => input });
 * ```
 */
export async function runPipeAsync(args: RunArgs,): Promise<unknown> {
  /**
   * Logger tagged at the asynchronous core boundary.
   */
  const l = tagged(args.l === undefined
    ? { tag: runPipeAsync.name, }
    : {
      tag: runPipeAsync.name,
      l: args.l,
    },);
  l.debug('entry',);

  /* oxlint-disable typescript/no-unsafe-type-assertion -- widen each step's `never` input to `unknown` for application; RunCallableArgs preserves `this: void`, so this is parameter-variance widening only and the typed overloads remain the type-safe public surface */
  /**
   * Callable arguments with step inputs widened for internal invocation.
   */
  const callableArgs = args as RunCallableArgs;
  /* oxlint-enable typescript/no-unsafe-type-assertion */
  /**
   * Callable value and steps destructured so step functions are invoked without method-style `this`.
   */
  const {
    value,
    fn1,
    fn2,
    fn3,
    fn4,
    fn5,
    fn6,
    fn7,
    fn8,
    fn9,
    fn10,
  } = callableArgs;
  /**
   * Ordered step slots used only for runtime contiguity validation.
   */
  const steps = [
    fn1,
    fn2,
    fn3,
    fn4,
    fn5,
    fn6,
    fn7,
    fn8,
    fn9,
  ] as const;

  try {
    assertNoOverflowStep(fn10,);
    assertContiguousSteps(steps,);
  }
  catch (error) {
    l.error(`invalid pipe arguments: ${String(error,)}`,);
    throw error;
  }

  try {
    if (fn2 === undefined) {
      l.debug('1 step',);
      return await fn1(await value,);
    }
    if (fn3 === undefined) {
      l.debug('2 steps',);
      return await fn2(await fn1(await value,),);
    }
    if (fn4 === undefined) {
      l.debug('3 steps',);
      return await fn3(
        await fn2(await fn1(await value,),),
      );
    }
    if (fn5 === undefined) {
      l.debug('4 steps',);
      return await fn4(
        await fn3(
          await fn2(await fn1(await value,),),
        ),
      );
    }
    if (fn6 === undefined) {
      l.debug('5 steps',);
      return await fn5(
        await fn4(
          await fn3(
            await fn2(await fn1(await value,),),
          ),
        ),
      );
    }
    if (fn7 === undefined) {
      l.debug('6 steps',);
      return await fn6(
        await fn5(
          await fn4(
            await fn3(
              await fn2(await fn1(await value,),),
            ),
          ),
        ),
      );
    }
    if (fn8 === undefined) {
      l.debug('7 steps',);
      return await fn7(
        await fn6(
          await fn5(
            await fn4(
              await fn3(
                await fn2(await fn1(await value,),),
              ),
            ),
          ),
        ),
      );
    }
    if (fn9 === undefined) {
      l.debug('8 steps',);
      return await fn8(
        await fn7(
          await fn6(
            await fn5(
              await fn4(
                await fn3(
                  await fn2(await fn1(await value,),),
                ),
              ),
            ),
          ),
        ),
      );
    }

    l.debug('9 steps',);
    return await fn9(
      await fn8(
        await fn7(
          await fn6(
            await fn5(
              await fn4(
                await fn3(
                  await fn2(await fn1(await value,),),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
  catch (error) {
    l.error(`step failed: ${String(error,)}`,);
    throw error;
  }
}
