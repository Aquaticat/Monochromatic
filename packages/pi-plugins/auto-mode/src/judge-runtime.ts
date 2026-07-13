/**
 * Runtime helpers shared by judge stream attempts.
 *
 * @module
 */

import type { SimpleStreamOptions, } from '@earendil-works/pi-ai';
import type { ForeignBorrowed, } from '@monochromatic-dev/config-oxlint-shared/ts/foreign-borrowed.ts';
import type { BudgetModelAuth, } from './types.ts';

/**
 * Build stream options shared by the tool-call attempt and JSON retry.
 *
 * @param auth - API key and headers for the selected judge model
 *
 * @param signal - combined timeout and caller cancellation signal
 *
 * @param toolChoice - provider-specific forced tool choice for the first attempt
 *
 * @returns pi-ai simple stream options
 *
 * @example
 * ```typescript
 * buildStreamOptions({ auth: {}, signal: new AbortController().signal });
 * ```
 */
function buildStreamOptions(
  {
    auth,
    signal,
    toolChoice,
  }: {
    readonly auth: BudgetModelAuth;
    readonly signal: AbortSignal;
    readonly toolChoice?: unknown;
  },
): SimpleStreamOptions {
  /**
   * Provider-specific stream options assembled key-by-key so `auth` fields stay optional.
   */
  const opts: Record<string, unknown> = {
    signal,
  };
  if (auth.apiKey
    !== undefined)
    opts.apiKey = auth.apiKey;
  if (auth.headers
    !== undefined)
    opts.headers = auth.headers;
  if (toolChoice
    !== undefined)
    opts.toolChoice = toolChoice;
  return opts as SimpleStreamOptions;
}

/**
 * Combine a judge's private timeout with a foreign race cancellation handle.
 *
 * @param handles - timeout and outer cancellation handles borrowed from host APIs
 *
 * @returns signal that aborts after either input signal aborts
 *
 * @example
 * ```typescript
 * const signal = mergeJudgeAbortSignals({ timeout, outer });
 * ```
 */
function mergeJudgeAbortSignals(
  {
    timeout,
    outer,
  }: ForeignBorrowed<{
    readonly timeout: AbortSignal;
    readonly outer: AbortSignal;
  }>,
): AbortSignal {
  return AbortSignal.any([
    timeout,
    outer,
  ],);
}

/**
 * Create a disposable timeout that clears itself on scope exit.
 *
 * @param ms - timeout duration in milliseconds
 *
 * @param onTimeout - callback that aborts outstanding judge work
 *
 * @returns disposable object
 *
 * @example
 * ```typescript
 * using timer = disposableTimeout({ ms: 5_000, onTimeout() { controller.abort(); } });
 * ```
 */
function disposableTimeout(
  {
    ms,
    onTimeout,
  }: {
    readonly ms: number;
    readonly onTimeout: () => void;
  },
): Disposable {
  /**
   * Timer handle returned by setTimeout; cleared on dispose to cancel pending callbacks.
   */
  const id = setTimeout(
    onTimeout,
    ms,
  );
  return {
    [Symbol.dispose]() {
      clearTimeout(id,);
    },
  };
}

export {
  buildStreamOptions,
  disposableTimeout,
  mergeJudgeAbortSignals,
};
