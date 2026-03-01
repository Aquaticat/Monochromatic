/**
 * Per-probe execution: consistency runs and timeout enforcement.
 *
 * Consistency runs are sequential to avoid rate limits. A 5-minute timeout covers
 * all turns (all consistency runs + the second pass fix turn).
 */
import { mean, } from './math.ts';
import { createProbeClient, executeProbe, } from './runner-client.ts';
import { runSecondPass, } from './runner-second-pass.ts';

import type { ProbeResult, } from './runner-types.ts';
import type { RunnerConfig, } from './runner-config.ts';
import type { Probe, ScoreContext, } from './probes.ts';

/** Minutes before a probe is considered timed out */
const PROBE_TIMEOUT_MINUTES = 5;

/** Seconds per minute for timeout computation */
const SECONDS_PER_MINUTE = 60;

/** Milliseconds per second for timeout computation */
const MS_PER_SECOND = 1000;

/** 5 minutes per probe (all consistency runs + fix pass) -- slower inference is unusable */
const PROBE_TIMEOUT_MS = PROBE_TIMEOUT_MINUTES * SECONDS_PER_MINUTE * MS_PER_SECOND;

/**
 * Core probe logic: runs consistency checks then the second-pass fix loop.
 * @param probe - canary probe to execute
 * @param config - runner configuration
 * @param timestamp - authoritative server timestamp for artifact naming
 * @param signal - abort signal from the timeout controller; cancels HTTP streams and containers
 * @returns scored result with consistency information
 */
async function runProbeCore(probe: Probe, config: RunnerConfig, timestamp: string, signal: AbortSignal): Promise<ProbeResult> {
  const client = createProbeClient(config);
  // Consistency runs must be sequential (rate limits) and each run's score is
  // logged immediately. scores uses push because each run appends in the loop;
  // functional reduce/map would require pre-running all turns before collecting.
  const scores: number[] = [];
  // lastResponse is let because the for-of loop reassigns it each run, and the
  // final value is needed after the loop for the second-pass fix turn.
  let lastResponse = '';
  for (const runIndex of Array.from({ length: config.consistencyRuns, }).keys()) {
    // eslint-disable-next-line no-await-in-loop -- sequential to avoid rate limits
    lastResponse = await executeProbe(probe, config, client, signal);
    const scoreContext: ScoreContext = { modelId: config.model, pass: 'initial', timestamp, signal, };
    // eslint-disable-next-line no-await-in-loop -- score may involve container execution
    const runScore = await probe.score(lastResponse, scoreContext);
    scores.push(runScore);
    console.log(`  [${config.model}:${probe.name}] run ${String(runIndex + 1)}/${String(config.consistencyRuns)}: score=${runScore.toFixed(2)}`);
  }

  const meanScore = mean(scores);
  const consistent = scores.every((score) => score === scores[0]);
  const fixContext: ScoreContext = { modelId: config.model, pass: 'fix', timestamp, signal, };
  const pass2Result = await runSecondPass(probe, config, client, lastResponse, fixContext);
  if (pass2Result !== undefined) {
    const delta = pass2Result - meanScore;
    const deltaStr = delta >= 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2);
    console.log(`  [${config.model}:${probe.name}] pass2: score=${pass2Result.toFixed(2)} delta=${deltaStr}`);
  }

  return {
    name: probe.name,
    category: probe.category,
    scores,
    meanScore,
    consistent,
    pass2Score: pass2Result,
    fixDelta: pass2Result !== undefined ? pass2Result - meanScore : undefined,
  };
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
 * @param probe - canary probe to execute
 * @param config - runner configuration
 * @param timestamp - authoritative server timestamp for artifact naming
 * @returns scored result; on timeout, a zero-score result with `timedOut: true`
 */
// eslint-disable-next-line require-await -- returns Promise.race directly; async needed for callers expecting Promise<ProbeResult>
export async function runProbe(probe: Probe, config: RunnerConfig, timestamp: string): Promise<ProbeResult> {
  // new Promise required: no standard promisified API exists for time-based resolution,
  // and @monochromatic-dev/module-es is not a dependency of this package.
  // timer.unref() prevents the timer from keeping the process alive after the probe finishes.
  const controller = new AbortController();
  const corePromise = runProbeCore(probe, config, timestamp, controller.signal);
  // Suppress unhandled-rejection warning: after the timeout wins the race,
  // corePromise may still reject (via AbortError) with no observer.
  // eslint-disable-next-line promise/prefer-await-to-then -- catch handler on a racing promise; await is not viable here
  corePromise.catch(() => { /* expected: abort-triggered rejection after timeout */ });
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
  // timer is let so corePromise's finally handler can clear it before the callback fires,
  // preventing a misleading "timed out" log for probes that complete before the deadline.
  let timer: ReturnType<typeof setTimeout> | undefined = undefined;
  return Promise.race([
    // eslint-disable-next-line promise/prefer-await-to-then -- finally on a racing promise; await is not viable here
    corePromise.finally(() => { if (timer !== undefined) clearTimeout(timer); }),
    // eslint-disable-next-line promise/avoid-new -- timeout racing requires manual Promise construction
    new Promise<ProbeResult>((resolve) => {
      timer = setTimeout(
        () => {
          controller.abort();
          console.error(`  [${config.model}:${probe.name}] timed out after ${String(PROBE_TIMEOUT_MINUTES)} minutes`);
          resolve(timedOutResult);
        },
        PROBE_TIMEOUT_MS,
      );
      timer.unref();
    }),
  ]);
}
