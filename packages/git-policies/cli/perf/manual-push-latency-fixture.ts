/**
 * Disposable repository fixture for repository-scale manual-push latency measurements.
 *
 * @module
 */

import {
  mkdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';

import { execute, measure } from './manual-push-latency-command.ts';
import {
  DIRECT_REMOTE,
  DIRECT_REPOSITORY,
  MAXIMUM_WARMUPS,
  PACKAGE_BIN,
  RUNS,
  WRAPPED_REMOTE,
  WRAPPED_REPOSITORY,
} from './manual-push-latency-contracts.ts';
import type {
  PairCollectionState,
  Sample,
} from './manual-push-latency-contracts.ts';
import { warmupsAreStable } from './manual-push-latency-statistics.ts';

/**
 * Prepared revisions needed by benchmark execution and evidence.
 *
 * @example
 * ```ts
 * const fixture: BenchmarkFixture = { baseOid: 'base', headOid: 'head' };
 * ```
 */
export type BenchmarkFixture = Readonly<{
  baseOid: string;
  headOid: string;
}>;

/**
 * Create numeric sequence from zero to count minus one.
 *
 * @param count - Number of indices required.
 * @returns Ordered numeric indices.
 *
 * @example
 * ```ts
 * createIndices(2);
 * ```
 */
function createIndices(count: number): readonly number[] {
  return Array.from({ length: count }, function selectIndex(_unused: unknown, index: number): number {
    return index;
  });
}

/**
 * Prepare equivalent direct and wrapped repositories from source mount.
 *
 * @returns Baseline and evidence revisions.
 * @throws Error when filesystem or command setup fails.
 *
 * @example
 * ```ts
 * await prepareFixture();
 * ```
 */
export async function prepareFixture(): Promise<BenchmarkFixture> {
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
  return { baseOid, headOid };
}

/**
 * Reset both benchmark remotes to common baseline revision.
 *
 * @param baseOid - Revision installed on both remote main branches.
 * @returns Completion after both refs are restored.
 * @throws Error when either update-ref command fails.
 *
 * @example
 * ```ts
 * await resetRemotes({ baseOid: '0123456789abcdef' });
 * ```
 */
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
 * @throws Error when reset or either push fails.
 *
 * @example
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
    /** Wrapped push duration measured first for this pair. */
    const wrapperMs = await measure({
      command: PACKAGE_BIN,
      args: ['push', 'origin', 'main:main'],
      cwd: WRAPPED_REPOSITORY,
    });
    /** Direct push duration measured second for this pair. */
    const directMs = await measure({
      command: '/usr/bin/git',
      args: ['push', 'origin', 'main:main'],
      cwd: DIRECT_REPOSITORY,
    });
    return { directMs, wrapperMs, addedMs: wrapperMs - directMs };
  }
  /** Direct push duration measured first for this pair. */
  const directMs = await measure({
    command: '/usr/bin/git',
    args: ['push', 'origin', 'main:main'],
    cwd: DIRECT_REPOSITORY,
  });
  /** Wrapped push duration measured second for this pair. */
  const wrapperMs = await measure({
    command: PACKAGE_BIN,
    args: ['push', 'origin', 'main:main'],
    cwd: WRAPPED_REPOSITORY,
  });
  return { directMs, wrapperMs, addedMs: wrapperMs - directMs };
}

/**
 * Collect paired measurements sequentially through immutable reducer state.
 *
 * @param count - Maximum number of pairs to collect.
 * @param baseOid - Revision restored before each pair.
 * @param stopWhenStable - Whether collection ends after stable warm-up windows.
 * @returns Ordered paired measurements and stability state.
 * @throws Error when any pair cannot be measured.
 *
 * @example
 * ```ts
 * await collectPairs({ count: 2, baseOid: '0123456789abcdef', stopWhenStable: false });
 * ```
 */
async function collectPairs({
  count,
  baseOid,
  stopWhenStable,
}: Readonly<{
  count: number;
  baseOid: string;
  stopWhenStable: boolean;
}>): Promise<PairCollectionState> {
  return createIndices(count).reduce(
    async function appendSequentialPair(
      previousPromise: Promise<PairCollectionState>,
      index: number,
    ): Promise<PairCollectionState> {
      /** State produced by all earlier sequential pair measurements. */
      const previous = await previousPromise;
      if (previous.stable) {
        return previous;
      }
      /** Next pair measured only after earlier state resolves. */
      const sample = await runPair({ wrapperFirst: (index % 2) === 1, baseOid });
      /** Immutable ordered pair list including new sample. */
      const samples = [...previous.samples, sample];
      return {
        samples,
        stable: stopWhenStable && warmupsAreStable(samples),
      };
    },
    Promise.resolve<PairCollectionState>({ samples: [], stable: false }),
  );
}

/**
 * Collect warm-up pairs until stability or maximum count.
 *
 * @param baseOid - Revision restored before each pair.
 * @returns Warm-up state with ordered samples and stability result.
 * @throws Error when any pair cannot be measured.
 *
 * @example
 * ```ts
 * await collectWarmups({ baseOid: '0123456789abcdef' });
 * ```
 */
export async function collectWarmups({
  baseOid,
}: Readonly<{ baseOid: string }>): Promise<PairCollectionState> {
  return collectPairs({ count: MAXIMUM_WARMUPS, baseOid, stopWhenStable: true });
}

/**
 * Collect fixed count of recorded paired measurements.
 *
 * @param baseOid - Revision restored before each pair.
 * @returns Ordered recorded samples.
 * @throws Error when any pair cannot be measured.
 *
 * @example
 * ```ts
 * await collectSamples({ baseOid: '0123456789abcdef' });
 * ```
 */
export async function collectSamples({
  baseOid,
}: Readonly<{ baseOid: string }>): Promise<readonly Sample[]> {
  /** Pair state after requested recorded count. */
  const state = await collectPairs({ count: RUNS, baseOid, stopWhenStable: false });
  return state.samples;
}
