/**
 Warm-up rule, validation, and summaries for the concurrent-commit benchmark.

 @module
 */
import {
  median,
  medianAbsoluteDeviation,
  p95,
} from './lifecycle-latency-command.ts';
import {
  type BatchSample,
  type ConcurrentScenarioId,
  type ConcurrentScenarioResult,
  ConcurrentBenchmarkError,
  type Distribution,
  MAXIMUM_WARMUP_BATCHES,
  MILLISECONDS_PER_SECOND,
  WARMUP_STABILITY_RATIO,
  WARMUP_WINDOW,
} from './concurrent-commit-latency-contracts.ts';

/**
 Outcome every commit of a batch must reach.
 */
export type ExpectedOutcome = 'landed' | 'replay-conflict';

/**
 Summarizes one metric.

 @param values - observations

 @returns distribution, all zero when nothing was observed

 @example
 ```ts
 distribution([1, 2, 3]).medianMs; // 2
 ```
 */
export function distribution(values: readonly number[],): Distribution {
  if (values.length === 0)
    return {
      count: 0,
      medianMs: 0,
      p95Ms: 0,
      madMs: 0,
      maximumMs: 0,
    };
  return {
    count: values.length,
    medianMs: median(values,),
    p95Ms: p95(values,),
    madMs: medianAbsoluteDeviation(values,),
    maximumMs: Math.max(...values,),
  };
}

/**
 Fails the benchmark when any commit of a batch missed its expected outcome.

 @param id - scenario identity

 @param sample - measured batch

 @param expected - required outcome

 @throws {@link ConcurrentBenchmarkError} naming the scenario and every observed outcome

 @example
 ```ts
 assertOutcome({ id: 'disjoint-4', sample, expected: 'landed' });
 ```
 */
export function assertOutcome({
  id,
  sample,
  expected,
}: Readonly<{
  id: ConcurrentScenarioId;
  sample: BatchSample;
  expected: ExpectedOutcome;
}>,): void {
  /**
   Whether every commit reached the expected outcome.
   */
  const reached = sample.commits
    .every(function matches(commit,): boolean {
    return expected === 'landed'
      ? commit.exitCode === 0
      : (commit.exitCode === 1) && commit.coreFinding;
  },);
  if (!reached)
    throw new ConcurrentBenchmarkError(`${id}: expected every commit to reach ${expected}, observed ${JSON.stringify(sample.commits,)}.`,);
}

/**
 Reports whether adjacent warm-up windows of batch wall times drifted within the stability ratio.

 @param walls - warm-up batch wall times so far

 @returns whether the warm-up rule holds

 @example
 ```ts
 warmupStable([100, 101, 99, 100, 102, 98]); // true
 ```
 */
export function warmupStable(walls: readonly number[],): boolean {
  if (walls.length < (2 * WARMUP_WINDOW))
    return false;
  /**
   Previous window median.
   */
  const previous = median(walls.slice(
    (-2) * WARMUP_WINDOW,
    -WARMUP_WINDOW,
  ),);
  /**
   Latest window median.
   */
  const current = median(walls.slice(-WARMUP_WINDOW,),);
  return (Math.abs(current - previous,) / previous) <= WARMUP_STABILITY_RATIO;
}

/**
 Runs warm-up batches until the stability rule holds.

 @param id - scenario identity

 @param runBatch - runs one concurrent batch

 @returns warm-up batches run

 @throws {@link ConcurrentBenchmarkError} when {@link MAXIMUM_WARMUP_BATCHES} pass without stability

 @example
 ```ts
 await warmUp({ id: 'disjoint-1', runBatch });
 ```
 */
export async function warmUp({
  id,
  runBatch,
}: Readonly<{
  id: ConcurrentScenarioId;
  runBatch: () => Promise<BatchSample>;
}>,): Promise<number> {
  /**
   Warm-up wall times.
   */
  const walls: number[] = [];
  // Every iteration runs one batch; the maximum bounds the loop.
  while (!warmupStable(walls,)) {
    if (walls.length >= MAXIMUM_WARMUP_BATCHES)
      throw new ConcurrentBenchmarkError(`${id}: warm-up never stabilized: ${JSON.stringify(walls,)}.`,);
    // oxlint-disable-next-line no-await-in-loop -- Warm-up batches run one at a time against one repository.
    walls.push((await runBatch()).wallMs,);
  }
  return walls.length;
}

/**
 Summarizes one scenario.

 @param id - scenario identity

 @param concurrency - commits per concurrent batch

 @param warmups - warm-up batches run

 @param samples - recorded concurrent batches

 @param serializedSamples - recorded serialized batches

 @returns scenario evidence

 @example
 ```ts
 summarizeScenario({ id: 'disjoint-2', concurrency: 2, warmups: 6, samples, serializedSamples });
 ```
 */
export function summarizeScenario({
  id,
  concurrency,
  warmups,
  samples,
  serializedSamples,
}: Readonly<{
  id: ConcurrentScenarioId;
  concurrency: number;
  warmups: number;
  samples: readonly BatchSample[];
  serializedSamples: readonly BatchSample[];
}>,): ConcurrentScenarioResult {
  /**
   Every recorded concurrent commit.
   */
  const commits = samples.flatMap(function sampleCommits(sample,) {
    return sample.commits;
  },);
  return {
    id,
    concurrency,
    warmups,
    wall: distribution(samples.map(function wall(sample,): number {
      return sample.wallMs;
    },),),
    medianThroughputPerSecond: median(samples.map(function throughput(sample,): number {
      return (sample.commits
        .length
        * MILLISECONDS_PER_SECOND) / sample.wallMs;
    },),),
    perCommitCompletion: distribution(commits.map(function completion(commit,): number {
      return commit.completionMs;
    },),),
    meanLostRacesPerCommit: commits.reduce(
      function sumLost(
        total,
        commit,
      ): number {
      return total + commit.lostRaces;
    },
      0,
    ) / commits.length,
    maximumLostRaces: Math.max(...commits.map(function lost(commit,): number {
      return commit.lostRaces;
    },),),
    meanReplaysPerCommit: commits.reduce(
      function sumReplays(
        total,
        commit,
      ): number {
      return total + commit.replays;
    },
      0,
    ) / commits.length,
    landingLockHold: distribution(samples.flatMap(function landingHolds(sample,) {
      return sample.landingLockHoldMs;
    },),),
    indexLockHold: distribution(samples.flatMap(function indexHolds(sample,) {
      return sample.indexLockHoldMs;
    },),),
    serializedWall: distribution(serializedSamples.map(function serializedWall(sample,): number {
      return sample.wallMs;
    },),),
    samples,
    serializedSamples,
  };
}
