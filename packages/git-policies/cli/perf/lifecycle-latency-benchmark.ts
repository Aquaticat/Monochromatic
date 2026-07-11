#!/usr/bin/env node
/**
 * Packed cli-git lifecycle latency benchmark and budget gate.
 *
 * Run only through the bounded `perf:lifecycle-latency` mise task.
 *
 * @module
 */

import { writeFile, } from 'node:fs/promises';
import { availableParallelism, } from 'node:os';
import {
  MAXIMUM_BUDGET_MS,
  RECORDED_RUNS,
  TREE_FILE_COUNT,
  WARMUP_RUNS,
} from './lifecycle-latency-contracts.ts';
import { execute, } from './lifecycle-latency-command.ts';
import { prepareLifecycleFixture, } from './lifecycle-latency-fixture.ts';
import { collectLifecycleScenarios, } from './lifecycle-latency-scenarios.ts';

//region Benchmark execution -- Prepare packed fixture, collect required paths, and emit reproducible evidence.

/**
 * Prepared repositories and trust state.
 */
const fixture = await prepareLifecycleFixture();
/**
 * Complete measured scenario matrix.
 */
const scenarios = await collectLifecycleScenarios(fixture,);
/**
 * Machine-readable evidence containing raw samples and derived statistics.
 */
const benchmarkResult = {
  schemaVersion: 1,
  revision: process.env
    .CLI_GIT_BENCHMARK_REVISION
    ?? 'unrecorded',
  platform: process.platform,
  node: process.version,
  git: await execute({
    command: '/usr/bin/git',
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
    maximumBudgetMs: MAXIMUM_BUDGET_MS,
  },
  fixture: {
    trackedFiles: TREE_FILE_COUNT,
    warmups: WARMUP_RUNS,
    runs: RECORDED_RUNS,
  },
  scenarios,
};
/**
 * Stable serialized evidence shared by logs and CI artifact storage.
 */
const serializedResult = JSON.stringify(benchmarkResult, null, 2,);
/**
 * Optional caller-owned artifact destination mounted outside the disposable benchmark container.
 */
const outputPath = process.env.CLI_GIT_BENCHMARK_OUTPUT;

if (outputPath !== undefined)
  await writeFile(outputPath, serializedResult, 'utf8',);

console.log(serializedResult,);

//endregion Benchmark execution
