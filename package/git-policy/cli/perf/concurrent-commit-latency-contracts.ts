/**
 Contracts for the packed cli-git concurrent-commit throughput benchmark.

 `SPEC.md` "Benchmark method" requires concurrent commits at levels 1, 2, 4, and 8 with disjoint paths,
 same-file non-overlapping replays,
 conflicting pairs,
 a slow hook with `hooks.concurrentCommits` `false` and `true`,
 and a `landing.reserveAfterLostRaces` sweep,
 each reporting per-commit completion time,
 landing lock and real `index.lock` hold times,
 lost races per commit,
 and a paired serialized baseline.
 No budget exists yet:
 a budget is accepted only after a measured baseline,
 so this benchmark records and never enforces.

 @module
 */

/**
 Stable concurrent scenario identity.
 */
export type ConcurrentScenarioId =
  | 'disjoint-1'
  | 'disjoint-2'
  | 'disjoint-4'
  | 'disjoint-8'
  | 'same-file-non-overlapping'
  | 'conflicting-pair'
  | 'slow-hook-serialized'
  | 'slow-hook-concurrent'
  | 'reserve-after-1'
  | 'reserve-after-2'
  | 'reserve-after-4'
  | 'reserve-after-8';

/**
 One commit's observation inside a batch.
 */
export type CommitObservation = Readonly<{
  /**
   Spawn-to-exit wall time.
   */
  completionMs: number;
  /**
   Process exit code.
   */
  exitCode: number;
  /**
   `landing-race-lost` events the commit emitted.
   */
  lostRaces: number;
  /**
   `commit-replayed` events the commit emitted.
   */
  replays: number;
  /**
   Whether the commit emitted a `core-finding` event, as a conflicting replay must.
   */
  coreFinding: boolean;
  /**
   Complete stdout and stderr of a commit that exited nonzero, for the failure diagnostic.
   */
  failureOutput?: string;
}>;

/**
 One measured batch.
 */
export type BatchSample = Readonly<{
  /**
   Wall time from the first spawn to the last exit.
   */
  wallMs: number;
  /**
   Every commit in spawn order.
   */
  commits: readonly CommitObservation[];
  /**
   Landing lock hold intervals observed during the batch.
   */
  landingLockHoldMs: readonly number[];
  /**
   Real `index.lock` hold intervals observed during the batch.
   */
  indexLockHoldMs: readonly number[];
}>;

/**
 Distribution summary of one metric.
 */
export type Distribution = Readonly<{
  /**
   Observation count.
   */
  count: number;
  /**
   Median.
   */
  medianMs: number;
  /**
   Nearest-rank ninety-fifth percentile.
   */
  p95Ms: number;
  /**
   Median absolute deviation.
   */
  madMs: number;
  /**
   Largest observation.
   */
  maximumMs: number;
}>;

/**
 One scenario's recorded evidence.
 */
export type ConcurrentScenarioResult = Readonly<{
  /**
   Stable scenario identity.
   */
  id: ConcurrentScenarioId;
  /**
   Commits started together in each batch.
   */
  concurrency: number;
  /**
   Warm-up batches run before the stability rule held.
   */
  warmups: number;
  /**
   Concurrent batch wall time.
   */
  wall: Distribution;
  /**
   Median commits per second over concurrent batches.
   */
  medianThroughputPerSecond: number;
  /**
   Spawn-to-exit time of every recorded commit.
   */
  perCommitCompletion: Distribution;
  /**
   Mean lost landing races per recorded commit.
   */
  meanLostRacesPerCommit: number;
  /**
   Most lost races of one recorded commit.
   */
  maximumLostRaces: number;
  /**
   Mean replays per recorded commit.
   */
  meanReplaysPerCommit: number;
  /**
   Landing lock hold intervals.
   */
  landingLockHold: Distribution;
  /**
   Real `index.lock` hold intervals.
   */
  indexLockHold: Distribution;
  /**
   Paired serialized baseline wall time: the same commits one after another through the wrapper.
   */
  serializedWall: Distribution;
  /**
   Direct real-Git serialized wall time of the same commits, for disjoint scenarios.
   */
  directSerializedWall?: Distribution;
  /**
   Recorded concurrent batches.
   */
  samples: readonly BatchSample[];
  /**
   Recorded serialized batches.
   */
  serializedSamples: readonly BatchSample[];
}>;

/**
 Stable benchmark failure.
 */
export class ConcurrentBenchmarkError extends Error {
  /**
   Stable diagnostic class name.
   */
  public override readonly name = 'ConcurrentBenchmarkError';
}

/**
 Packed cli-git executable after fixture installation.
 */
export const PACKAGE_BIN = '/work/node_modules/.bin/git';

/**
 System Git executable inside the benchmark container.
 */
export const REAL_GIT = '/usr/bin/git';

/**
 Root holding every concurrent-commit repository.
 */
export const CONCURRENT_ROOT = '/work/concurrent';

/**
 Recorded batches per scenario after warm-up.
 */
export const RECORDED_BATCHES = 30;

/**
 Warm-up batches per stability window.
 */
export const WARMUP_WINDOW = 3;

/**
 Most warm-up batches before the stability rule gives up and the benchmark fails.
 */
export const MAXIMUM_WARMUP_BATCHES = 18;

/**
 Denominator producing the accepted warm-up drift fraction.
 */
const WARMUP_STABILITY_DENOMINATOR = 5;

/**
 Largest relative drift between adjacent warm-up window medians.
 */
export const WARMUP_STABILITY_RATIO: number = 1 / WARMUP_STABILITY_DENOMINATOR;

/**
 Disjoint-path scenarios at the concurrency levels `SPEC.md` names.
 */
export const DISJOINT_SCENARIOS: readonly Readonly<{
  id: ConcurrentScenarioId;
  concurrency: number;
}>[] = [
  {
    id: 'disjoint-1',
    concurrency: 1,
  },
  {
    id: 'disjoint-2',
    concurrency: 2,
  },
  {
    id: 'disjoint-4',
    concurrency: 4,
  },
  {
    id: 'disjoint-8',
    concurrency: 8,
  },
];

/**
 Commits in each slow-hook batch.
 */
export const SLOW_HOOK_CONCURRENCY = 4;

/**
 Seconds the slow `pre-commit` hook sleeps, as `sleep` spells it.
 */
export const SLOW_HOOK_SECONDS = '0.2';

/**
 Commits in each reservation-sweep batch, the highest disjoint level.
 */
export const SWEEP_CONCURRENCY = 8;

/**
 `landing.reserveAfterLostRaces` sweep; `1` is the default.
 */
export const RESERVE_SWEEP: readonly Readonly<{
  id: ConcurrentScenarioId;
  reserve: number;
}>[] = [
  {
    id: 'reserve-after-1',
    reserve: 1,
  },
  {
    id: 'reserve-after-2',
    reserve: 2,
  },
  {
    id: 'reserve-after-4',
    reserve: 4,
  },
  {
    id: 'reserve-after-8',
    reserve: 8,
  },
];

/**
 Tracked disjoint files per repository, one per concurrent commit.
 */
export const DISJOINT_FILE_COUNT = 8;

/**
 Lines in the shared file edited by same-file and conflicting scenarios.
 */
export const SHARED_FILE_LINES = 40;

/**
 Shared file line one commit edits.
 */
export const FIRST_EDIT_LINE = 4;

/**
 Shared file line another commit edits, far from {@link FIRST_EDIT_LINE}.
 */
export const SECOND_EDIT_LINE = 34;

/**
 Nanoseconds in one millisecond.
 */
export const NANOSECONDS_PER_MILLISECOND = 1_000_000;

/**
 Milliseconds in one second.
 */
export const MILLISECONDS_PER_SECOND = 1_000;
