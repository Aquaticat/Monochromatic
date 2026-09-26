#!/usr/bin/env node
/**
 Packed cli-git concurrent-commit throughput benchmark.

 Run only through the bounded `perf:concurrent-commits` mise task.
 It records a baseline and enforces no budget,
 because `SPEC.md` "Benchmark method" accepts a budget only after a measured baseline.

 @module
 */

import { writeFile, } from 'node:fs/promises';
import { availableParallelism, } from 'node:os';
import { execute, } from './lifecycle-latency-command.ts';
import {
  MAXIMUM_WARMUP_BATCHES,
  RECORDED_BATCHES,
  REAL_GIT,
  SLOW_HOOK_SECONDS,
  WARMUP_STABILITY_RATIO,
  WARMUP_WINDOW,
} from './concurrent-commit-latency-contracts.ts';
import { collectConcurrentScenarios, } from './concurrent-commit-latency-scenarios.ts';

//region Benchmark execution -- Measure the concurrent matrix and emit reproducible evidence.

/**
 Scenario selection in measurement order; empty measures the complete matrix.
 */
const selection = process.env
  .CLI_GIT_BENCHMARK_SCENARIOS
  ?? '';
/**
 Measured scenarios.
 */
const scenarios = await collectConcurrentScenarios({ selection, },);
/**
 Machine-readable evidence containing raw batches and derived statistics.
 */
const benchmarkResult = {
  schemaVersion: 1,
  revision: process.env
    .CLI_GIT_BENCHMARK_REVISION
    ?? 'unrecorded',
  platform: process.platform,
  node: process.version,
  git: await execute({
    command: REAL_GIT,
    args: ['--version',],
    cwd: '/work',
  },),
  filesystem: await execute({
    command: '/usr/bin/df',
    args: [
      '--output=fstype',
      '/work',
    ],
    cwd: '/work',
  },),
  limits: {
    memoryBytes: 2_147_483_648,
    cpus: 2,
    availableCpus: availableParallelism(),
  },
  method: {
    recordedBatches: RECORDED_BATCHES,
    warmupWindow: WARMUP_WINDOW,
    maximumWarmupBatches: MAXIMUM_WARMUP_BATCHES,
    warmupStabilityRatio: WARMUP_STABILITY_RATIO,
    slowHookSeconds: SLOW_HOOK_SECONDS,
    lockHolds: 'inotify rename events of landing.lock and index.lock paired into intervals',
    selection,
  },
  scenarios,
};
/**
 Stable serialized evidence shared by logs and artifact storage.
 */
const serializedResult = JSON.stringify(
  benchmarkResult,
  null,
  2,
);
/**
 Optional caller-owned artifact destination mounted outside the disposable benchmark container.
 */
const outputPath = process.env
  .CLI_GIT_BENCHMARK_OUTPUT;

if (outputPath !== undefined)
  await writeFile(
    outputPath,
    `${serializedResult}\n`,
    'utf8',
  );

//endregion Benchmark execution
