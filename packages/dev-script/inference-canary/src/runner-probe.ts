/**
 * Per-probe timeout and execution entry point.
 *
 * Wraps {@link runProbeCore} with a 5-minute timeout covering all turns
 * (consistency runs + fix pass). On timeout the probe resolves with score=0
 * rather than throwing, so partial results from other probes can still be collected.
 */
import { runProbeCore, } from './runner-probe-core.ts';

import type { Probe, } from './probes.ts';
import type { RunnerConfig, } from './runner-config.ts';
import type { ProbeResult, } from './runner-types.ts';

/** Minutes before a probe is considered timed out */
const PROBE_TIMEOUT_MINUTES = 5;

/** Seconds per minute for timeout computation */
const SECONDS_PER_MINUTE = 60;

/** Milliseconds per second for timeout computation */
const MS_PER_SECOND = 1_000;

/** 5 minutes per probe (all consistency runs + fix pass) -- slower inference is unusable */
const PROBE_TIMEOUT_MS = PROBE_TIMEOUT_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND;

/**
 * Creates a disposable timeout that auto-clears via `Symbol.dispose`.
 * Calling `unref()` on the timer prevents it from keeping the event loop alive.
 *
 * @param callback - function to execute when the timeout fires
 *
 * @param ms - timeout duration in milliseconds
 *
 * @returns disposable handle; timer is cleared when disposed
 */
function createDisposableTimeout(callback: () => void, ms: number,): Disposable {
  const id = setTimeout(callback, ms,);
  id.unref();
  return { [Symbol.dispose](): void {
    clearTimeout(id,);
  }, };
}

/**
 * Runs a single probe with a 5-minute timeout covering all turns (consistency + fix).
 *
 * Uses `AbortController` so the timeout doesn't just cancel the promise -- it also
 * cancels in-flight HTTP streams (OpenAI SDK respects `signal`) and kills any live
 * container processes (`execBun` listens for abort). Without cancellation, orphaned
 * coroutines keep the Bun event loop alive well past the timeout.
 *
 * On timeout the probe resolves with score=0 and `timedOut: true` rather than throwing,
 * so partial results from other probes can still be collected and written to history.
 *
 * @param probe - canary probe to execute
 *
 * @param config - runner configuration
 *
 * @param timestamp - authoritative server timestamp for artifact naming
 *
 * @returns scored result; on timeout, a zero-score result with `timedOut: true`
 */
export async function runProbe(probe: Probe, config: RunnerConfig,
  timestamp: string,): Promise<ProbeResult>
{
  const controller = new AbortController();
  const corePromise = runProbeCore(probe, config, timestamp, controller.signal,);
  // Zero-score sentinel returned when the timeout fires; score 0 is recorded in history
  // so the overall model score reflects the failure without discarding other probe results.
  const timedOutResult: ProbeResult = {
    name: probe.name,
    category: probe.category,
    scores: [],
    meanScore: 0,
    consistent: true,
    timedOut: true,
  };

  /**
   * Wraps `corePromise` to absorb abort-triggered rejections.
   * After timeout wins the race, `controller.abort()` causes `corePromise` to reject
   * with no observer. This wrapper catches that expected rejection and returns
   * the timeout sentinel so the promise settles cleanly.
   *
   * @returns probe result, or the timeout sentinel if the abort was expected
   */
  async function observedCore(): Promise<ProbeResult> {
    try {
      return await corePromise;
    }
    catch (error) {
      if (controller.signal.aborted)
        return timedOutResult;
      throw error;
    }
  }

  const { promise: timeoutPromise, resolve: resolveTimeout, } = Promise.withResolvers<
    ProbeResult
  >();

  // Timer auto-clears when the function returns via Symbol.dispose.
  using _timer = createDisposableTimeout(
    function onTimeout(): void {
      controller.abort();
      console.error(
        `  [${config.label}:${probe.name}] timed out after ${
          String(PROBE_TIMEOUT_MINUTES,)
        } minutes`,
      );
      resolveTimeout(timedOutResult,);
    },
    PROBE_TIMEOUT_MS,
  );

  return await Promise.race([observedCore(), timeoutPromise,],);
}
