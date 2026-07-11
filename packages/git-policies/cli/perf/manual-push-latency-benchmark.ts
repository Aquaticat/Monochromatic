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

import {
  mkdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import spawn from 'nano-spawn';

//region Benchmark contracts -- Name measurements and command behavior used throughout the harness.

/**
 * Result of one paired direct and wrapped push measurement.
 *
 * @example
 *
 * ```ts
 * const sample: Sample = { directMs: 10, wrapperMs: 20, addedMs: 10 };
 * ```
 */
type Sample = Readonly<{
  directMs: number;
  wrapperMs: number;
  addedMs: number;
}>;

/**
 * Optional command execution controls.
 *
 * @example
 *
 * ```ts
 * const options: ExecuteOptions = { cwd: '/work', discardOutput: true };
 * ```
 */
type ExecuteOptions = Readonly<{
  cwd?: string;
  discardOutput?: boolean;
}>;

/**
 * Reports benchmark setup, command, or threshold failures.
 *
 * @example
 *
 * ```ts
 * throw new BenchmarkError('Benchmark did not converge.');
 * ```
 */
class BenchmarkError extends Error {}

//endregion Benchmark contracts

//region Benchmark constants -- Keep sample counts, limits, and fixture locations explicit.

/** Number of recorded pairs after warm-up stability. */
const RUNS = 30;
/** Minimum number of warm-up pairs considered for stability. */
const MINIMUM_WARMUPS = 6;
/** Maximum number of warm-up pairs before benchmark failure. */
const MAXIMUM_WARMUPS = 30;
/** Number of samples in each compared warm-up window. */
const WARMUP_WINDOW = 3;
/** Maximum relative median drift accepted between warm-up windows. */
const STABILITY_RATIO = 5 / 100;
/** Maximum allowed wrapper-added latency in milliseconds. */
const LIMIT_MS = 2_000;
/** Nanoseconds in one millisecond. */
const NANOSECONDS_PER_MILLISECOND = 1_000_000;
/** Percentile represented by p95. */
const NINETY_FIFTH_PERCENTILE = 95 / 100;
/** Decimal places used in threshold failure messages. */
const DECIMAL_PLACES = 3;
/** Byte count for benchmark memory limit. */
const MEMORY_LIMIT_BYTES = 2_147_483_648;
/** CPU count for benchmark container limit. */
const CPU_LIMIT = 2;
/** Byte count for benchmark temporary filesystem limit. */
const TEMPORARY_FILESYSTEM_LIMIT_BYTES = 1_073_741_824;
/** Installed packed cli-git executable. */
const PACKAGE_BIN = '/work/node_modules/.bin/git';
/** Repository used for direct Git measurements. */
const DIRECT_REPOSITORY = '/work/direct';
/** Repository used for wrapper measurements. */
const WRAPPED_REPOSITORY = '/work/wrapped';
/** Bare remote used for direct Git measurements. */
const DIRECT_REMOTE = '/work/direct.git';
/** Bare remote used for wrapper measurements. */
const WRAPPED_REMOTE = '/work/wrapped.git';
/** Environment override that places packed cli-git before system Git. */
const COMMAND_ENV = {
  PATH: `/work/node_modules/.bin:/usr/bin:${process.env.PATH ?? ''}`,
} as const;

//endregion Benchmark constants

//region Statistical helpers -- Calculate stable summaries without external tooling.

/**
 * Compare numeric values in ascending order.
 *
 * @param left - Value placed on left side of comparison.
 * @param right - Value placed on right side of comparison.
 * @returns Negative, zero, or positive ordering value.
 *
 * @example
 *
 * ```ts
 * [2, 1].toSorted(compareNumbers);
 * ```
 */
function compareNumbers(left: number, right: number): number {
  return left - right;
}

/**
 * Read required numeric array element.
 *
 * @param values - Sequence containing required element.
 * @param index - Position expected to exist.
 * @returns Numeric element at requested position.
 * @throws {@link BenchmarkError} when position is absent.
 *
 * @example
 *
 * ```ts
 * requiredNumberAt({ values: [5], index: 0 });
 * ```
 */
function requiredNumberAt({
  values,
  index,
}: Readonly<{
  values: readonly number[];
  index: number;
}>): number {
  const value = values.at(index);
  if (value === undefined) {
    throw new BenchmarkError(`Missing numeric sample at index ${String(index)}.`);
  }
  return value;
}

/**
 * Calculate median of non-empty numeric samples.
 *
 * @param values - Samples whose midpoint represents central latency.
 * @returns Median sample value.
 * @throws {@link BenchmarkError} when no samples are supplied.
 *
 * @example
 *
 * ```ts
 * median([1, 3, 2]);
 * ```
 */
function median(values: readonly number[]): number {
  if (values.length === 0) {
    throw new BenchmarkError('Cannot calculate median of empty samples.');
  }
  const sorted = values.toSorted(compareNumbers);
  const middle = Math.floor(sorted.length / 2);
  if ((sorted.length % 2) !== 0) {
    return requiredNumberAt({ values: sorted, index: middle });
  }
  const lower = requiredNumberAt({ values: sorted, index: middle - 1 });
  const upper = requiredNumberAt({ values: sorted, index: middle });
  return (lower + upper) / 2;
}

/**
 * Calculate nearest-rank ninety-fifth percentile of non-empty samples.
 *
 * @param values - Samples whose upper-tail latency is required.
 * @returns Ninety-fifth percentile sample value.
 * @throws {@link BenchmarkError} when no samples are supplied.
 *
 * @example
 *
 * ```ts
 * p95([1, 2, 3]);
 * ```
 */
function p95(values: readonly number[]): number {
  if (values.length === 0) {
    throw new BenchmarkError('Cannot calculate percentile of empty samples.');
  }
  const sorted = values.toSorted(compareNumbers);
  const rank = Math.ceil(sorted.length * NINETY_FIFTH_PERCENTILE) - 1;
  return requiredNumberAt({ values: sorted, index: rank });
}

/**
 * Calculate median absolute deviation of non-empty samples.
 *
 * @param values - Samples whose robust spread is required.
 * @returns Median distance from sample median.
 * @throws {@link BenchmarkError} when no samples are supplied.
 *
 * @example
 *
 * ```ts
 * medianAbsoluteDeviation([1, 2, 3]);
 * ```
 */
function medianAbsoluteDeviation(values: readonly number[]): number {
  const center = median(values);
  return median(values.map(function distanceFromCenter(value: number): number {
    return Math.abs(value - center);
  }));
}

//endregion Statistical helpers

//region Command helpers -- Execute benchmark setup and timed pushes without shell interpolation.

/**
 * Execute command with benchmark environment and optional output suppression.
 *
 * @param command - Executable path or name.
 * @param args - Literal command arguments.
 * @param options - Working directory and output behavior.
 * @returns Trimmed standard output.
 * @throws Error from `nano-spawn` when command fails.
 *
 * @example
 *
 * ```ts
 * await execute({ command: '/usr/bin/git', args: ['--version'] });
 * ```
 */
async function execute({
  command,
  args,
  options = {},
}: Readonly<{
  command: string;
  args: readonly string[];
  options?: ExecuteOptions;
}>): Promise<string> {
  const result = await spawn(command, args, {
    cwd: options.cwd,
    env: COMMAND_ENV,
    stdin: 'ignore',
    stdout: options.discardOutput === true ? 'ignore' : 'pipe',
    stderr: options.discardOutput === true ? 'ignore' : 'pipe',
  });
  return result.stdout.trim();
}

/**
 * Measure successful command wall time.
 *
 * @param command - Executable path or name.
 * @param args - Literal command arguments.
 * @param cwd - Repository where command executes.
 * @returns Elapsed wall time in milliseconds.
 * @throws Error from `nano-spawn` when command fails.
 *
 * @example
 *
 * ```ts
 * await measure({ command: '/usr/bin/git', args: ['status'], cwd: '/work/direct' });
 * ```
 */
async function measure({
  command,
  args,
  cwd,
}: Readonly<{
  command: string;
  args: readonly string[];
  cwd: string;
}>): Promise<number> {
  const started = process.hrtime.bigint();
  await execute({ command, args, options: { cwd, discardOutput: true } });
  const elapsedNanoseconds = process.hrtime.bigint() - started;
  return Number(elapsedNanoseconds) / NANOSECONDS_PER_MILLISECOND;
}

//endregion Command helpers

//region Fixture lifecycle -- Prepare equivalent direct and wrapped repository paths.

/** Reset both benchmark remotes to common baseline revision. */
async function resetRemotes({ baseOid }: Readonly<{ baseOid: string }>): Promise<void> {
  await Promise.all([
    execute({
      command: '/usr/bin/git',
      args: ['update-ref', 'refs/heads/main', baseOid],
      options: { cwd: DIRECT_REMOTE },
    }),
    execute({
      command: '/usr/bin/git',
      args: ['update-ref', 'refs/heads/main', baseOid],
      options: { cwd: WRAPPED_REMOTE },
    }),
  ]);
}

/**
 * Measure one direct and wrapped push in alternating order.
 *
 * @param wrapperFirst - Whether wrapped push runs before direct push.
 * @param baseOid - Revision restored before measurements.
 * @returns Paired direct, wrapped, and added latency values.
 *
 * @example
 *
 * ```ts
 * await runPair({ wrapperFirst: true, baseOid: '0123456789abcdef' });
 * ```
 */
async function runPair({
  wrapperFirst,
  baseOid,
}: Readonly<{
  wrapperFirst: boolean;
  baseOid: string;
}>): Promise<Sample> {
  await resetRemotes({ baseOid });
  if (wrapperFirst) {
    const wrapperMs = await measure({
      command: PACKAGE_BIN,
      args: ['push', 'origin', 'main:main'],
      cwd: WRAPPED_REPOSITORY,
    });
    const directMs = await measure({
      command: '/usr/bin/git',
      args: ['push', 'origin', 'main:main'],
      cwd: DIRECT_REPOSITORY,
    });
    return { directMs, wrapperMs, addedMs: wrapperMs - directMs };
  }
  const directMs = await measure({
    command: '/usr/bin/git',
    args: ['push', 'origin', 'main:main'],
    cwd: DIRECT_REPOSITORY,
  });
  const wrapperMs = await measure({
    command: PACKAGE_BIN,
    args: ['push', 'origin', 'main:main'],
    cwd: WRAPPED_REPOSITORY,
  });
  return { directMs, wrapperMs, addedMs: wrapperMs - directMs };
}

/**
 * Select direct latency from paired sample.
 *
 * @param sample - Paired measurement.
 * @returns Direct Git latency.
 *
 * @example
 *
 * ```ts
 * selectDirectMs({ directMs: 1, wrapperMs: 2, addedMs: 1 });
 * ```
 */
function selectDirectMs(sample: Sample): number {
  return sample.directMs;
}

/**
 * Select wrapper latency from paired sample.
 *
 * @param sample - Paired measurement.
 * @returns Wrapper latency.
 *
 * @example
 *
 * ```ts
 * selectWrapperMs({ directMs: 1, wrapperMs: 2, addedMs: 1 });
 * ```
 */
function selectWrapperMs(sample: Sample): number {
  return sample.wrapperMs;
}

/**
 * Select wrapper-added latency from paired sample.
 *
 * @param sample - Paired measurement.
 * @returns Wrapper-added latency.
 *
 * @example
 *
 * ```ts
 * selectAddedMs({ directMs: 1, wrapperMs: 2, addedMs: 1 });
 * ```
 */
function selectAddedMs(sample: Sample): number {
  return sample.addedMs;
}

/**
 * Determine whether recent warm-up windows have stable direct and wrapper medians.
 *
 * @param samples - Warm-up pairs accumulated in execution order.
 * @returns Whether both measurements remain within stability ratio.
 *
 * @example
 *
 * ```ts
 * warmupsAreStable([]);
 * ```
 */
function warmupsAreStable(samples: readonly Sample[]): boolean {
  if (samples.length < MINIMUM_WARMUPS) {
    return false;
  }
  const previous = samples.slice(-(2 * WARMUP_WINDOW), -WARMUP_WINDOW);
  const current = samples.slice(-WARMUP_WINDOW);
  const previousDirect = median(previous.map(selectDirectMs));
  const previousWrapper = median(previous.map(selectWrapperMs));
  const directDrift = Math.abs(median(current.map(selectDirectMs)) - previousDirect) / previousDirect;
  const wrapperDrift = Math.abs(median(current.map(selectWrapperMs)) - previousWrapper) / previousWrapper;
  return directDrift <= STABILITY_RATIO && wrapperDrift <= STABILITY_RATIO;
}

//endregion Fixture lifecycle

//region Benchmark execution -- Build fixture, stabilize measurements, record samples, and enforce ceiling.

await execute({ command: 'apt-get', args: ['update'] });
await execute({
  command: 'apt-get',
  args: ['install', '--yes', '--no-install-recommends', 'git'],
});
await mkdir('/work', { recursive: true });
await execute({ command: 'npm', args: ['init', '--yes'], options: { cwd: '/work' } });
await execute({
  command: 'npm',
  args: ['install', '--ignore-scripts', '/fixture/cli.tgz'],
  options: { cwd: '/work' },
});
/** Remote baseline used before each paired measurement. */
const baseOid = await execute({
  command: '/usr/bin/git',
  args: ['-C', '/source', 'rev-parse', 'origin/main'],
});
/** Revision represented by benchmark evidence. */
const headOid = await execute({
  command: '/usr/bin/git',
  args: ['-C', '/source', 'rev-parse', 'HEAD'],
});
await execute({
  command: '/usr/bin/git',
  args: ['clone', '--quiet', '--bare', '/source', DIRECT_REMOTE],
});
await execute({
  command: '/usr/bin/git',
  args: ['clone', '--quiet', '--bare', '/source', WRAPPED_REMOTE],
});
await execute({
  command: '/usr/bin/git',
  args: ['clone', '--quiet', '/source', DIRECT_REPOSITORY],
});
await execute({
  command: '/usr/bin/git',
  args: ['clone', '--quiet', '/source', WRAPPED_REPOSITORY],
});
await execute({
  command: '/usr/bin/git',
  args: ['remote', 'set-url', 'origin', DIRECT_REMOTE],
  options: { cwd: DIRECT_REPOSITORY },
});
await execute({
  command: '/usr/bin/git',
  args: ['remote', 'set-url', 'origin', WRAPPED_REMOTE],
  options: { cwd: WRAPPED_REPOSITORY },
});
await rm(`${WRAPPED_REPOSITORY}/tsconfig.json`, { force: true });
await mkdir(`${WRAPPED_REPOSITORY}/packages/cli/forbidden-strings/target/release`, {
  recursive: true,
});
await symlink(
  '/fixture/forbidden-strings',
  `${WRAPPED_REPOSITORY}/packages/cli/forbidden-strings/target/release/forbidden-strings`,
);
/** Scanner rule guaranteed absent from source revision. */
const absentRule = `MANUAL_PUSH_LATENCY_${String(Date.now())}_${String(process.pid)}`;
await writeFile(`${WRAPPED_REPOSITORY}/forbidden-strings.local.txt`, `${absentRule}\n`);
await execute({
  command: PACKAGE_BIN,
  args: ['cli-git', 'trust', '--yes'],
  options: { cwd: WRAPPED_REPOSITORY },
});
/** Warm-up pairs accumulated until medians stabilize. */
const warmupSamples: Sample[] = [];
for (let index = 0; index < MAXIMUM_WARMUPS; index += 1) {
  const sample = await runPair({ wrapperFirst: (index % 2) === 1, baseOid });
  warmupSamples.push(sample);
  if (warmupsAreStable(warmupSamples)) {
    break;
  }
}
if (!warmupsAreStable(warmupSamples)) {
  throw new BenchmarkError('Benchmark did not reach its warm-up stability threshold.');
}
/** Recorded benchmark pairs. */
const samples: Sample[] = [];
for (let index = 0; index < RUNS; index += 1) {
  samples.push(await runPair({ wrapperFirst: (index % 2) === 1, baseOid }));
}
/** Wrapper-added latency values extracted for threshold enforcement. */
const added = samples.map(selectAddedMs);
/** Largest observed wrapper-added latency. */
const maximumAddedMs = Math.max(...added);
console.log(JSON.stringify({
  revision: headOid,
  baseOid,
  limits: {
    memoryBytes: MEMORY_LIMIT_BYTES,
    cpus: CPU_LIMIT,
    temporaryFilesystem: 'tmpfs',
    temporaryFilesystemBytes: TEMPORARY_FILESYSTEM_LIMIT_BYTES,
    addedLatencyCeilingMs: LIMIT_MS,
  },
  platform: process.platform,
  node: process.version,
  git: await execute({ command: '/usr/bin/git', args: ['--version'] }),
  scanner: await execute({ command: '/fixture/forbidden-strings', args: ['--version'] }),
  warmups: warmupSamples.length,
  runs: RUNS,
  medianDirectMs: median(samples.map(selectDirectMs)),
  p95DirectMs: p95(samples.map(selectDirectMs)),
  madDirectMs: medianAbsoluteDeviation(samples.map(selectDirectMs)),
  medianWrapperMs: median(samples.map(selectWrapperMs)),
  p95WrapperMs: p95(samples.map(selectWrapperMs)),
  madWrapperMs: medianAbsoluteDeviation(samples.map(selectWrapperMs)),
  medianAddedMs: median(added),
  p95AddedMs: p95(added),
  madAddedMs: medianAbsoluteDeviation(added),
  maximumAddedMs,
  samples,
}, null, 2));
if (maximumAddedMs >= LIMIT_MS) {
  throw new BenchmarkError(
    `Wrapper added ${maximumAddedMs.toFixed(DECIMAL_PLACES)} ms, exceeding ${String(LIMIT_MS)} ms ceiling.`,
  );
}

//endregion Benchmark execution
