import { match, } from 'ts-pattern';
import type {
  Promisable,
  UnknownRecord,
} from 'type-fest';
import {
  consoleLogger,
  type Logger,
} from './string.log.ts';

/**
 * Execute function with error handling and optional context-aware retry.
 *
 * @remarks
 * Control flow is determined by catcher return value.
 *
 * Direct decisions:
 * - true  → run tryer once with original context; if it throws, error propagates (no recursive catch)
 * - false → rethrow original error
 * - null  → log suppression via l.error and return undefined
 *
 * Tuple decisions:
 * - [true, ctx]  → recurse with ctx (full try/catch applied per retry)
 * - [false, ctx] → throw new Error(JSON.stringify(ctx), { cause: error })
 * - [null, ctx]  → log suppression with context and return undefined
 *
 * Logging:
 * - l.error is used only for suppression (null decisions)
 * - Direct null: l.error(JSON.stringify(error))
 * - Tuple null:  l.error(`ignored ${JSON.stringify(newContext)} cause: ${JSON.stringify(error)}`)
 *
 * @typeParam T - return type from tryer.
 * @typeParam Context - context object type passed between tryer and catcher.
 * @param tryer - to execute; receives optional context.
 * @param catcher - error handler; returns boolean | null or [decision, newContext].
 * @param context - initial context.
 * @param l - logger used on suppression; defaults to consoleLogger.
 * @returns Value from tryer, or undefined when decision is null.
 * @throws Re-throws original error on direct false.
 * @throws Error with message JSON.stringify(newContext) on tuple false.
 * @throws TypeError on unsupported catcher result.
 *
 * @example
 * ```ts
 * // Retry once with same context (non-tuple)
 * const value = tryCatch(
 *   () => compute(),
 *   () => true,
 * );
 * ```
 *
 * @example
 * ```ts
 * // Update context and retry recursively while catcher keeps returning [true, ...]
 * const result = tryCatch(
 *   (ctx) => computeWith(ctx),
 *   (error, ctx) => [true, { ...ctx, retried: (ctx?.retried ?? 0) + 1 } as const],
 *   { retried: 0 } as const,
 * );
 * ```
 *
 * @example
 * ```ts
 * // Suppress error and return undefined with custom logger
 * const maybeConfig = tryCatch(
 *   () => JSON.parse(source),
 *   () => null,
 *   undefined,
 *   myLogger,
 * );
 * ```
 */
export function tryCatch<const T, const Context extends UnknownRecord,>(
  tryer: (context?: Context,) => T,
  catcher: (error: unknown, context?: Context,) => boolean | [boolean, Context,],
  context?: Context,
  l?: Logger,
): T;
export function tryCatch<const T, const Context extends UnknownRecord,>(
  tryer: (context?: Context,) => T,
  catcher: (error: unknown, context?: Context,) => (boolean | null) | [boolean | null,
    Context,],
  context?: Context,
  l?: Logger,
): T | undefined;
export function tryCatch<const T, const Context extends UnknownRecord,>(
  tryer: (context?: Context,) => T,
  catcher: (error: unknown, context?: Context,) => (boolean | null) | [boolean | null,
    Context,],
  context?: Context,
  l: Logger = consoleLogger,
): T | undefined {
  try {
    return tryer(context,);
  }
  catch (error) {
    l.trace('error');
    // Catcher decides control flow.
    // May return:
    // - boolean | null       → direct path (no context update)
    // - [boolean | null, Context] → tuple path (context update + action)
    const result = catcher(error, context,);

    function handleArrayResult(
      [catcherDetermines, newContext,]: [boolean | null, Context,],
    ): T | undefined {
      l.trace('handleArrayResult');
      // Tuple null suppresses: logged via l with context and original error.
      function handleTupleRetry(): T | undefined {
        l.trace('handleTupleRetry');
        return tryCatch(tryer, catcher, newContext, l,);
      }

      function handleTupleThrow(): never {
        l.trace('handleTupleThrow');
        throw new Error(JSON.stringify(newContext,), { cause: error, },);
      }

      function handleTupleSuppress(): undefined {
        l.trace('handleTupleSuppress');
        l.error(
          `ignored ${JSON.stringify(newContext,)} cause: ${JSON.stringify(error,)}`,
        );
        return undefined;
      }

      function handleInvalidDecisionType(): never {
        l.trace('handleInvalidDecisionType');
        throw new TypeError(
          `${JSON.stringify(catcherDetermines,)} not one of boolean|null, ${
            JSON.stringify(newContext,)
          }`,
          { cause: error, },
        );
      }

      return match(catcherDetermines,)
        .with(true, handleTupleRetry,)
        .with(false, handleTupleThrow,)
        .with(null, handleTupleSuppress,)
        .otherwise(handleInvalidDecisionType,);
    }

    function handleDirectRetry(): T {
      l.trace('handleDirectRetry');
      return tryer(context,);
    }

    function handleDirectThrow(): never {
      l.trace('handleDirectThrow');
      throw error;
    }

    function handleInvalidResult(invalidResult: unknown,): never {
      l.trace('handleInvalidResult');
      throw new TypeError(
        `${JSON.stringify(invalidResult,)} not one of boolean|null, ${
          JSON.stringify(invalidResult,)
        }`,
        { cause: error, },
      );
    }

    //region Decision handling -- Tuple vs direct return semantics and their effects
    return match(result,)
      // Handle array return with context
      .when(
        function arrayResult(r,): r is [boolean | null, Context,] {
          return Array.isArray(r,);
        },
        handleArrayResult,
      )
      // Handle direct boolean/null return (no context update)
      // Direct true runs tryer once with same context; if it throws, the error bubbles (no recursive catch).
      .with(true, handleDirectRetry,)
      // Direct false rethrows the original error from the catch block.
      .with(false, handleDirectThrow,)
      // Direct null suppresses: logged via l with the original error; returns undefined.
      .with(null, function handleIgnore() {
        l.trace('handleIgnore');
        l.error(JSON.stringify(error,),);
        return undefined;
      },)
      // Invalid catcher result shape/value.
      .otherwise(handleInvalidResult,);
    //endregion Decision handling
  }
}

/**
 * Async variant of tryCatch with error handling and optional context-aware retry.
 *
 * @remarks
 * Behaviour matches sync variant; catcher may be sync or async.
 *
 * Direct decisions:
 * - true  → run tryer once with original context; if it throws/rejects, error propagates (no recursive catch)
 * - false → rethrow original error
 * - null  → log suppression via l.error and resolve undefined
 *
 * Tuple decisions:
 * - [true, ctx]  → recurse with ctx (re-enters async try/catch)
 * - [false, ctx] → throw new Error(JSON.stringify(ctx), { cause: error })
 * - [null, ctx]  → log suppression with context and resolve undefined
 *
 * Logging:
 * - l.error is used only for suppression (null decisions)
 * - Direct null: l.error(JSON.stringify(error))
 * - Tuple null:  l.error(`ignored ${JSON.stringify(newContext)} cause: ${JSON.stringify(error)}`)
 *
 * @typeParam T - resolved type from tryer.
 * @typeParam Context - context object type passed between tryer and catcher.
 * @param tryer - to execute; receives optional context; may be sync or async.
 * @param catcher - error handler; may be sync or async; returns boolean | null or [decision, newContext].
 * @param context - initial context.
 * @param l - logger used on suppression; defaults to consoleLogger.
 * @returns Value from tryer, or undefined when decision is null.
 * @throws Re-throws original error on direct false.
 * @throws Error with message JSON.stringify(newContext) on tuple false.
 * @throws TypeError on unsupported catcher result.
 *
 * @example
 * ```ts
 * // Retry without changing context (non-tuple)
 * const result = await tryCatchAsync(
 *   async (ctx) => await computeAsync(ctx),
 *   () => true,
 * );
 * ```
 *
 * @example
 * ```ts
 * // Update context and retry recursively while catcher keeps returning [true, ...]
 * const data = await tryCatchAsync(
 *   async (ctx) => await fetchData(ctx),
 *   (error, ctx) => [true, { ...ctx, retry: (ctx?.retry ?? 0) + 1 } as const],
 *   { retry: 0 } as const,
 * );
 * ```
 *
 * @example
 * ```ts
 * // Suppress error and resolve undefined with custom logger
 * const maybe = await tryCatchAsync(
 *   async () => JSON.parse(await readText()),
 *   () => null,
 *   undefined,
 *   myLogger,
 * );
 * ```
 */
export async function tryCatchAsync<const T, const Context extends UnknownRecord,>(
  tryer: (context?: Context,) => Promisable<T>,
  catcher: (error: unknown,
    context?: Context,) => Promisable<boolean | [boolean, Context,]>,
  context?: Context,
  l?: Logger,
): Promise<T>;
export async function tryCatchAsync<const T, const Context extends UnknownRecord,>(
  tryer: (context?: Context,) => Promisable<T>,
  catcher: (error: unknown,
    context?: Context,) => Promisable<(boolean | null) | [boolean | null, Context,]>,
  context?: Context,
  l?: Logger,
): Promise<T | undefined>;
export async function tryCatchAsync<const T, const Context extends UnknownRecord,>(
  tryer: (context?: Context,) => Promisable<T>,
  catcher: (error: unknown,
    context?: Context,) => Promisable<(boolean | null) | [boolean | null, Context,]>,
  context?: Context,
  l: Logger = consoleLogger,
): Promise<T | undefined> {
  try {
    return await tryer(context,);
  }
  catch (error) {
    l.trace('error');
    // Catcher decides control flow.
    // May return:
    // - boolean | null       → direct path (no context update)
    // - [boolean | null, Context] → tuple path (context update + action)
    const result = await catcher(error, context,);

    async function handleArrayResultAsync(
      [catcherDetermines, newContext,]: [boolean | null, Context,],
    ): Promise<T | undefined> {
      l.trace('handleArrayResultAsync',);
      async function handleRetryRecursive(): Promise<T | undefined> {
        l.trace('handleRetryRecursive',);
        return await tryCatchAsync(tryer, catcher, newContext, l,);
      }

      function handleTupleThrow(): never {
        l.trace('handleTupleThrow',);
        throw new Error(JSON.stringify(newContext,), { cause: error, },);
      }

      // Tuple null suppresses: logged via l with context and original error.
      function handleTupleSuppress(): undefined {
        l.trace('handleTupleSuppress',);
        l.error(
          `ignored ${JSON.stringify(newContext,)} cause: ${JSON.stringify(error,)}`,
        );
        return undefined;
      }

      function handleInvalidDecisionType(): never {
        l.trace('handleInvalidDecisionType',);
        throw new TypeError(
          `${JSON.stringify(catcherDetermines,)} not one of boolean|null, ${
            JSON.stringify(newContext,)
          }`,
          { cause: error, },
        );
      }

      return await match(catcherDetermines,)
        // Recursive retry with updated context; re-enters the async try/catch flow.
        .with(true, handleRetryRecursive,)
        // Terminate by throwing a new Error that serializes the context; do not rethrow original error.
        .with(false, handleTupleThrow,)
        // Suppress path: log with context and original error, then resolve undefined.
        .with(null, handleTupleSuppress,)
        // Defensive guard for invalid decision types.
        .otherwise(handleInvalidDecisionType,);
    }

    function handleDirectThrow(): never {
      l.trace('handleDirectThrow');
      throw error;
    }

    function handleInvalidResult(invalidResult: unknown,): never {
      l.trace('handleInvalidResult');
      throw new TypeError(
        `${JSON.stringify(invalidResult,)} not one of boolean|null, ${
          JSON.stringify(invalidResult,)
        }`,
        { cause: error, },
      );
    }

    return match(result,)
      // Handle array return with context
      .when(
        function arrayResult(r,): r is [boolean | null, Context,] {
          return Array.isArray(r,);
        },
        handleArrayResultAsync,
      )
      // Handle direct boolean/null return (no context update)
      // Direct true runs tryer once with same context; if it throws/rejects, the error propagates (no recursive catch).
      .with(true, async function handleRetry() {
        l.trace('handleRetry');
        return await tryer(context,);
      },)
      // Direct false rethrows the original error from the catch block.
      .with(false, handleDirectThrow,)
      // Direct null suppresses: logged via l with the original error; resolves undefined.
      .with(null, function handleIgnore() {
        l.trace('handleIgnore');
        l.error(JSON.stringify(error,),);
        return undefined;
      },)
      // Invalid catcher result shape/value.
      .otherwise(handleInvalidResult,);
  }
}
