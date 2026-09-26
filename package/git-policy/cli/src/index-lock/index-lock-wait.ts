/**
 Waiting for a foreign `index.lock` under the classification rules.

 Every attempt re-reads the evidence.
 A proven-alive owner gets an unbounded wait and one stderr line naming it.
 A dead or evidence-free owner gets Git's `lock_file_timeout` schedule:
 quadratic backoff (1,
 4,
 9,
 ... milliseconds,
 capped at 1000)
 with each wait jittered to between 75 % and 125 % of the backoff,
 until the time spent in attempts without a proven owner reaches `indexLock.unprovenOwnerTimeoutMs`.
 That time includes evidence gathering,
 because an open-holder scan is not free:
 a Linux `/proc` scan over about 1000 processes took 59 to 106 ms on the development host.
 then the wait fails with {@link IndexLockUnprovenOwnerError}.
 Nothing here deletes a lock.

 @module
 */
import { wait, } from '@monochromatic-dev/module-async-time/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  classifyIndexLock,
  describeIndexLockEvidence,
  gatherIndexLockEvidence,
  LOCK_ABSENT,
  provenHolderLine,
} from './index-lock-evidence.ts';
import type {
  IndexLockEvidence,
  IndexLockVerdict,
} from './index-lock-types.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 The attempt found the lock held.
 */
export const LOCK_HELD: unique symbol = Symbol('index lock held by another process',);

/**
 Git's `BACKOFF_MAX_MULTIPLIER`.
 */
export const BACKOFF_MAX_MULTIPLIER = 1_000;

/**
 Git's jitter floor in thousandths of the backoff.
 */
const JITTER_FLOOR_PERMILLE = 750;

/**
 Git's jitter span in thousandths of the backoff.
 */
const JITTER_SPAN_PERMILLE = 500;

/**
 Thousandths per whole.
 */
const PERMILLE = 1_000;

/**
 Longest single poll while a PID file proves the owner alive,
 so its release is noticed promptly even after the backoff grew;
 re-reading a PID file costs little.
 */
export const PROVEN_BY_PID_FILE_POLL_CAP_MS = 100;

/**
 Longest single poll while only an open descriptor proves the owner alive;
 longer than {@link PROVEN_BY_PID_FILE_POLL_CAP_MS} because each poll repeats the open-holder scan.
 */
export const PROVEN_BY_DESCRIPTOR_POLL_CAP_MS = 500;

/**
 A foreign lock with a dead or unproven owner outlasted the backoff budget.
 */
export class IndexLockUnprovenOwnerError extends Error {
  /**
   Last attempt's evidence.
   */
  public readonly evidence: IndexLockEvidence;

  /**
   Last verdict.
   */
  public readonly verdict: Exclude<IndexLockVerdict, { kind: 'proven-alive'; }>;

  /**
   Creates the diagnostic.

   @param evidence - last attempt's evidence

   @param verdict - last verdict

   @param timeoutMs - exhausted budget

   @param consequence - what cli-git therefore did not do
   */
  public constructor({
    evidence,
    verdict,
    timeoutMs,
    consequence,
  }: Readonly<{
    evidence: IndexLockEvidence;
    verdict: Exclude<IndexLockVerdict, { kind: 'proven-alive'; }>;
    timeoutMs: number;
    consequence: string;
  }>,) {
    /**
     Owner description.
     */
    const owner = verdict.kind === 'dead'
      ? `whose owner PID ${String(verdict.pid,)} no longer runs`
      : 'whose owner cli-git could not prove alive';
    super(`Another process left ${evidence.lockPath}, ${owner}; after ${String(timeoutMs,)} ms (indexLock.unprovenOwnerTimeoutMs) the lock was still there. cli-git left the lock in place and ${consequence}. Evidence: ${describeIndexLockEvidence(evidence,)}. Remove the lock only after confirming no Git process is using this repository.`,);
    this.name = 'IndexLockUnprovenOwnerError';
    this.evidence = evidence;
    this.verdict = verdict;
  }
}

/**
 Git's backoff position.
 */
export type BackoffState = Readonly<{
  /**
   Git's `n`.
   */
  step: number;
  /**
   Git's `multiplier`: the current backoff in milliseconds.
   */
  multiplier: number;
}>;

/**
 Backoff state before the first wait.
 */
export const INITIAL_BACKOFF: BackoffState = {
  step: 1,
  multiplier: 1,
};

/**
 Computes one jittered wait from Git's formula `(750 + rand() % 500) * backoff / 1000`.

 @param state - backoff position

 @param random - uniform value in `[0, 1)`

 @returns wait in whole milliseconds

 @example
 ```ts
 jitteredWait({ state: { step: 3, multiplier: 9 }, random: 0.5 }); // 9
 ```
 */
export function jitteredWait({
  state,
  random,
}: Readonly<{
  state: BackoffState;
  random: number;
}>,): number {
  return Math.floor(((JITTER_FLOOR_PERMILLE + Math.floor(random * JITTER_SPAN_PERMILLE,)) * state.multiplier) / PERMILLE,);
}

/**
 Advances Git's backoff: `multiplier += 2n + 1`, capped at {@link BACKOFF_MAX_MULTIPLIER}.

 @param state - backoff position

 @returns next position

 @example
 ```ts
 nextBackoff({ step: 1, multiplier: 1 }); // { step: 2, multiplier: 4 }
 ```
 */
export function nextBackoff(state: BackoffState,): BackoffState {
  /**
   Uncapped next multiplier, since `(n + 1)^2 = n^2 + 2n + 1`.
   */
  const multiplier = state.multiplier + (2 * state.step)
    + 1;
  return multiplier > BACKOFF_MAX_MULTIPLIER
    ? {
      step: state.step,
      multiplier: BACKOFF_MAX_MULTIPLIER,
    }
    : {
      step: state.step + 1,
      multiplier,
    };
}

/**
 Side effects of the wait, injectable for tests.
 */
export type IndexLockWaitEffects = Readonly<{
  /**
   Gathers one attempt's evidence.
   */
  gather: (realIndexPath: string) => Promise<IndexLockEvidence | typeof LOCK_ABSENT>;
  /**
   Sleeps.
   */
  sleep: (ms: number) => Promise<void>;
  /**
   Uniform value in `[0, 1)`.
   */
  random: () => number;
  /**
   Writes the holder line.
   */
  report: (line: string) => void;
  /**
   Current time in milliseconds.
   */
  now: () => number;
}>;

/**
 Host effects.
 */
export const HOST_WAIT_EFFECTS: IndexLockWaitEffects = {
  gather: async function gatherHost(realIndexPath,) {
    return await gatherIndexLockEvidence({ realIndexPath, },);
  },
  sleep: async function sleepHost(ms,): Promise<void> {
    await wait(ms,);
  },
  random: Math.random,
  report: function reportHost(line,): void {
    process.stderr
      .write(line,);
  },
  now: performance.now
    .bind(performance,),
};

/**
 Runs an attempt until it no longer finds the lock held, waiting between attempts under the classification rules.

 @param realIndexPath - real index path; the lock is `<realIndexPath>.lock`

 @param timeoutMs - `indexLock.unprovenOwnerTimeoutMs`

 @param consequence - what cli-git does not do when the budget runs out, for the diagnostic

 @param attempt - tries to proceed, returning {@link LOCK_HELD} while a lock exists

 @param effects - side effects

 @returns attempt result

 @throws {@link IndexLockUnprovenOwnerError} when a dead or unproven owner outlasts the budget

 @example
 ```ts
 await waitForIndexLock({ realIndexPath: '/repo/.git/index', timeoutMs: 1_000, consequence: 'landed nothing', attempt: tryCreateLock });
 ```
 */
export async function waitForIndexLock<const Result,>({
  realIndexPath,
  timeoutMs,
  consequence,
  attempt,
  effects = HOST_WAIT_EFFECTS,
}: Readonly<{
  realIndexPath: string;
  timeoutMs: number;
  consequence: string;
  attempt: () => Promise<Result | typeof LOCK_HELD>;
  effects?: IndexLockWaitEffects;
}>,): Promise<Result> {
  /**
   Tagged wait logger.
   */
  const rl = tagged({
    tag: waitForIndexLock.name,
    l,
  },);
  /**
   Loop state: backoff position, time spent without a proven owner, and whether the holder line was written.
   */
  const state = {
    backoff: INITIAL_BACKOFF,
    unprovenMs: 0,
    reported: false,
  };
  // Every iteration returns, throws, or sleeps; the budget bounds the unproven iterations.
  for (;;) {
    /**
     When this iteration started.
     */
    const iterationStartedAt = effects.now();
    /* oxlint-disable no-await-in-loop -- Each attempt observes whether the previous holder released the lock. */
    /**
     Attempt outcome.
     */
    const result = await attempt();
    /* oxlint-enable no-await-in-loop */
    if (result !== LOCK_HELD)
      return result;
    /* oxlint-disable no-await-in-loop -- Evidence is re-read on every attempt. */
    /**
     This attempt's evidence.
     */
    const evidence = await effects.gather(realIndexPath,);
    /* oxlint-enable no-await-in-loop */
    if (evidence === LOCK_ABSENT) {
      rl.debug('lock released between the attempt and the evidence read',);
      continue;
    }
    /**
     This attempt's verdict.
     */
    const verdict = classifyIndexLock(evidence,);
    /**
     Jittered backoff wait.
     */
    const backoffMs = jitteredWait({
      state: state.backoff,
      random: effects.random(),
    },);
    state.backoff = nextBackoff(state.backoff,);
    if (verdict.kind === 'proven-alive') {
      if (!state.reported) {
        effects.report(provenHolderLine({
          verdict,
          lockPath: evidence.lockPath,
        },),);
        state.reported = true;
      }
      // oxlint-disable-next-line no-await-in-loop -- Polling a live holder in order.
      await effects.sleep(Math.min(
        backoffMs,
        verdict.source === 'pid-file' ? PROVEN_BY_PID_FILE_POLL_CAP_MS : PROVEN_BY_DESCRIPTOR_POLL_CAP_MS,
      ),);
      continue;
    }
    state.unprovenMs += effects.now() - iterationStartedAt;
    if (state.unprovenMs >= timeoutMs)
      throw new IndexLockUnprovenOwnerError({
        evidence,
        verdict,
        timeoutMs,
        consequence,
      },);
    rl.debug(`${verdict.kind} owner of ${evidence.lockPath}; backing off ${String(backoffMs,)} ms`,);
    /**
     When the backoff sleep started.
     */
    const sleepStartedAt = effects.now();
    // oxlint-disable-next-line no-await-in-loop -- Backoff between ordered attempts.
    await effects.sleep(backoffMs,);
    state.unprovenMs += effects.now() - sleepStartedAt;
  }
}
