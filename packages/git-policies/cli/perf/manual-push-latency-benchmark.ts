#!/usr/bin/env node
/**
 * Reproducible packed cli-git repository-scale manual-push benchmark.
 *
 * Run in documented Node container with `/fixture/cli.tgz`,
 * `/fixture/forbidden-strings`, and read-only `/source` mounts.
 * Container limits must be 2 GiB RAM, 2 CPUs, and a 1 GiB `/tmp` tmpfs.
 *
 * @module
 */

import { execute } from './manual-push-latency-command.ts';
import {
  BenchmarkError,
  CPU_LIMIT,
  DECIMAL_PLACES,
  LIMIT_MS,
  MEMORY_LIMIT_BYTES,
  RUNS,
  TEMPORARY_FILESYSTEM_LIMIT_BYTES,
} from './manual-push-latency-contracts.ts';
import {
  collectSamples,
  collectWarmups,
} from './manual-push-latency-collection.ts';
import { prepareFixture } from './manual-push-latency-fixture.ts';
import {
  addedValues,
  directValues,
  median,
  medianAbsoluteDeviation,
  p95,
  wrapperValues,
} from './manual-push-latency-statistics.ts';

//region Benchmark execution -- Prepare fixture, stabilize measurements, record samples, and enforce ceiling.

/**
 * Prepared source revisions for repeatable pair execution.
 */
const fixture = await prepareFixture();
/**
 * Warm-up pair state accumulated until stability or maximum count.
 */
const warmups = await collectWarmups({ baseOid: fixture.baseOid });
if (!warmups.stable) {
  throw new BenchmarkError('Benchmark did not reach its warm-up stability threshold.');
}
/**
 * Recorded benchmark pairs after stable warm-up.
 */
const samples = await collectSamples({ baseOid: fixture.baseOid });
/**
 * Wrapper-added latency values extracted for threshold enforcement.
 */
const added = addedValues(samples);
/**
 * Direct Git latency values used by summary statistics.
 */
const direct = directValues(samples);
/**
 * Wrapper latency values used by summary statistics.
 */
const wrapped = wrapperValues(samples);
/**
 * Largest observed wrapper-added latency.
 */
const maximumAddedMs = Math.max(...added);
console.log(JSON.stringify(
  {
  revision: fixture.headOid,
  baseOid: fixture.baseOid,
  limits: {
    memoryBytes: MEMORY_LIMIT_BYTES,
    cpus: CPU_LIMIT,
    temporaryFilesystem: 'tmpfs',
    temporaryFilesystemBytes: TEMPORARY_FILESYSTEM_LIMIT_BYTES,
    addedLatencyCeilingMs: LIMIT_MS,
  },
  platform: process.platform,
  node: process.version,
  git: await execute({
    command: '/usr/bin/git',
    args: ['--version']
  }),
  scanner: await execute({
    command: '/fixture/forbidden-strings',
    args: ['--version']
  }),
  warmups: warmups.samples
    .length,
  runs: RUNS,
  medianDirectMs: median(direct),
  p95DirectMs: p95(direct),
  madDirectMs: medianAbsoluteDeviation(direct),
  medianWrapperMs: median(wrapped),
  p95WrapperMs: p95(wrapped),
  madWrapperMs: medianAbsoluteDeviation(wrapped),
  medianAddedMs: median(added),
  p95AddedMs: p95(added),
  madAddedMs: medianAbsoluteDeviation(added),
  maximumAddedMs,
  samples,
},
  null,
  2
));
if (maximumAddedMs >= LIMIT_MS) {
  throw new BenchmarkError(
    `Wrapper added ${maximumAddedMs.toFixed(DECIMAL_PLACES)} ms, exceeding ${String(LIMIT_MS)} ms ceiling.`,
  );
}

//endregion Benchmark execution
