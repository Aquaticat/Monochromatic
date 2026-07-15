/**
 * Runtime helpers shared by judge stream attempts.
 *
 * @module
 */

import type { SimpleStreamOptions, } from '@earendil-works/pi-ai';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import type { BudgetModelAuth, } from './types.ts';

/**
 * Build stream options shared by the tool-call attempt and JSON retry.
 *
 * @param auth - API key and headers for the selected judge model
 *
 * @param controller - abort controller enforcing the total judge timeout
 *
 * @param toolChoice - provider-specific forced tool choice for the first attempt
 *
 * @returns pi-ai simple stream options
 *
 * @example
 * ```typescript
 * buildStreamOptions({ auth: {}, controller: new AbortController() });
 * ```
 */
function buildStreamOptions(
  {
    auth,
    controller,
    toolChoice,
  }: {
    readonly auth: BudgetModelAuth;
    readonly controller: AbortController;
    readonly toolChoice?: unknown;
  },
): SimpleStreamOptions {
  /**
   * Provider-specific stream options assembled key-by-key so `auth` fields stay optional.
   */
  const opts: Record<string, unknown> = {
    signal: controller.signal,
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
 * Create a disposable timeout that clears itself on scope exit.
 *
 * @param ms - timeout duration in milliseconds
 *
 * @param onTimeout - callback that aborts outstanding judge work
 *
 * @returns disposable object
 *
 * @mutates onTimeout - global `setTimeout` schedules callback capability for deferred invocation
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
    readonly onTimeout: ForeignBorrowed<() => void>;
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
};
