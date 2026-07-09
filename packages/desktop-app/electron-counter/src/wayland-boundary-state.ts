/**
 * Observed-state helpers for the pure-Wayland Electron boundary test.
 *
 * @example
 * ```ts
 * await waitForObservedCount({ statePath: '/tmp/state.json', expectedCount: 1 });
 * ```
 *
 * @packageDocumentation
 */

import { readFile, } from 'node:fs/promises';
import { setTimeout as wait, } from 'node:timers/promises';

import {
  pollIntervalMs,
  stateReadyDeadlineMs,
  type ObservedCounterState,
} from './wayland-boundary-constants.js';

/**
 * Sentinel for an observed counter state file that has not been written yet.
 *
 * @example
 * ```ts
 * console.log(typeof OBSERVED_COUNTER_STATE_ABSENT);
 * ```
 */
const OBSERVED_COUNTER_STATE_ABSENT: unique symbol = Symbol(
  'Electron counter state file is absent',
);

/**
 * Parses the observed state JSON written by the Electron main process.
 *
 * @param value - Parsed JSON value.
 *
 * @returns Observed counter state.
 *
 * @throws Error when JSON shape is unexpected.
 *
 * @example
 * ```ts
 * parseObservedCounterState({ value: { count: 1 } });
 * ```
 */
function parseObservedCounterState({ value, }: { readonly value: unknown; },): ObservedCounterState {
  if (
    ((typeof value) !== 'object')
    || (value === null)
    || (!('count' in value))
  )
    throw new Error('Observed counter state did not contain a count.',);

  /**
   * State after structural narrowing.
   */
  const state = value as { readonly count: unknown; };

  if ((typeof state.count) !== 'number')
    throw new Error('Observed counter count must be numeric.',);

  return { count: state.count, };
}

/**
 * Reads the observed state file if it exists.
 *
 * @param statePath - State file path written by Electron main process.
 *
 * @returns Parsed observed state, or {@link OBSERVED_COUNTER_STATE_ABSENT} when file is not present yet.
 *
 * @example
 * ```ts
 * await readObservedState({ statePath: '/tmp/state.json' });
 * ```
 */
async function readObservedState(
  { statePath, }: { readonly statePath: string; },
): Promise<ObservedCounterState | typeof OBSERVED_COUNTER_STATE_ABSENT> {
  try {
    /**
     * Raw state JSON emitted by Electron main process.
     */
    const stateText = await readFile(
      statePath,
      'utf8',
    );
    return parseObservedCounterState({ value: JSON.parse(stateText,), },);
  }
  catch (error: unknown) {
    if (
      Error.isError(error,)
      && ('code' in error)
      && (error.code === 'ENOENT')
    )
      return OBSERVED_COUNTER_STATE_ABSENT;

    throw error;
  }
}

/**
 * Waits until the observed counter state reaches an expected value.
 *
 * @param expectedCount - Expected counter value.
 *
 * @param statePath - State file path written by Electron main process.
 *
 * @example
 * ```ts
 * await waitForObservedCount({ statePath: '/tmp/state.json', expectedCount: 1 });
 * ```
 */
export async function waitForObservedCount(
  {
    expectedCount,
    statePath,
  }: {
    readonly expectedCount: number;
    readonly statePath: string;
  },
): Promise<void> {
  /**
   * Absolute timestamp when state waiting must fail.
   */
  const deadline = Date.now() + stateReadyDeadlineMs;

  while (Date.now() < deadline) {
    /**
     * Current observed state, if Electron has written one.
     */
    // oxlint-disable-next-line eslint/no-await-in-loop -- sequential polling must read the latest state file before sleeping.
    const state = await readObservedState({ statePath, },);

    if (state !== OBSERVED_COUNTER_STATE_ABSENT && state.count === expectedCount)
      return;

    // oxlint-disable-next-line eslint/no-await-in-loop -- sequential polling must delay between state reads.
    await wait(pollIntervalMs,);
  }

  throw new Error(`Timed out waiting for counter state ${expectedCount}`,
  );
}
