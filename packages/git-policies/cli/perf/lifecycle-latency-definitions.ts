/**
 * Static scenario declarations for lifecycle latency benchmark.
 *
 * @module
 */

import {
  appendFile,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import {
  BENCHMARK_FILE,
  MJS_REPOSITORY,
  NO_CONFIG_REPOSITORY,
  PACKAGE_BIN,
  REAL_GIT,
  type CommandRequest,
  type LifecycleScenarioId,
  TYPESCRIPT_REPOSITORY,
} from './lifecycle-latency-contracts.ts';
import type { LifecycleFixture, } from './lifecycle-latency-fixture.ts';

/**
 * Scenario paired-command declaration.
 */
export type PairedScenario = Readonly<{
  /**
   * Stable scenario identity.
   */
  id: LifecycleScenarioId;
  /**
   * Direct Git request.
   */
  direct: CommandRequest;
  /**
   * Wrapped request.
   */
  wrapper: CommandRequest;
}>;

/**
 * Direct and wrapped requests sharing one prepared repository state.
 */
export type PreparedPair = Readonly<{
  /**
   * Direct real-Git baseline request.
   */
  direct: CommandRequest;
  /**
   * Wrapped lifecycle request.
   */
  wrapper: CommandRequest;
}>;

/**
 * Scenario requiring fresh state before each command pair.
 */
export type PreparedPairedScenario = Readonly<{
  /**
   * Stable scenario identity.
   */
  id: LifecycleScenarioId;
  /**
   * Builds next equivalent direct and wrapped requests.
   */
  prepare: (input: Readonly<{
    /**
     * Unique state sequence.
     */
    iteration: number;
    /**
     * Prepared trust facts.
     */
    fixture: LifecycleFixture;
  }>,) => Promise<PreparedPair>;
}>;

/**
 * Creates one same-command pair over prepared repository state.
 *
 * @param args - literal Git arguments
 *
 * @param cwd - shared repository
 *
 * @param env - optional wrapped trust environment
 *
 * @returns direct and wrapped requests differing only by executable and wrapped environment
 *
 * @example
 * ```ts
 * commandPair({ args: ['status'], cwd: '/work/repository' });
 * ```
 */
function commandPair({
  args,
  cwd,
  env,
}: Readonly<{
  args: readonly string[];
  cwd: string;
  env?: Readonly<Record<string, string>>;
}>,): PreparedPair {
  return {
    direct: {
      command: REAL_GIT,
      args,
      cwd,
    },
    wrapper: {
      command: PACKAGE_BIN,
      args,
      cwd,
      ...(env === undefined ? {} : { env, }),
    },
  };
}

/**
 * Creates dry-run commit arguments that exercise selected content without changing repository state.
 *
 * @param iteration - unique diagnostic sequence
 *
 * @returns same direct and wrapped Git argument vector
 *
 * @example
 * ```ts
 * dryRunCommitArgs(1);
 * ```
 */
function dryRunCommitArgs(iteration: number,): readonly string[] {
  return [
    'commit',
    '--dry-run',
    '--only',
    `--message=benchmark-${String(iteration,)}`,
    '--',
    BENCHMARK_FILE,
  ];
}

/**
 * Builds validator trust request after changing exact bytes.
 *
 * @param iteration - unique source sequence
 *
 * @returns trust request
 */
async function validatorRequest({
  iteration,
  fixture,
}: Readonly<{
  iteration: number;
  fixture: LifecycleFixture;
}>,): Promise<PreparedPair> {
  await appendFile(
    join(
      MJS_REPOSITORY,
      'cli-git.config.mjs',
    ),
    `// validator-${String(iteration,)}\n`,
  );
  return commandPair({
    args: [
      'status',
      '--short',
    ],
    cwd: MJS_REPOSITORY,
    env: fixture.mjsRelaxedEnvironment,
  },);
}

/**
 * Builds relaxed TypeScript refresh request after changing exact bytes.
 *
 * @param iteration - unique source sequence
 *
 * @param fixture - exact relaxed trust environment
 *
 * @returns relaxed wrapper request
 */
async function relaxedRequest({
  iteration,
  fixture,
}: Readonly<{
  iteration: number;
  fixture: LifecycleFixture;
}>,): Promise<PreparedPair> {
  await appendFile(
    join(
      TYPESCRIPT_REPOSITORY,
      'cli-git.config.ts',
    ),
    `// relaxed-${String(iteration,)}\n`,
  );
  return commandPair({
    args: [
      'status',
      '--short',
    ],
    cwd: TYPESCRIPT_REPOSITORY,
    env: fixture.typescriptRelaxedEnvironment,
  },);
}

/**
 * Builds scanner direct-check request.
 *
 * @returns scanner request
 */
async function scannerRequest({
  iteration,
}: Readonly<{
  iteration: number;
}>,): Promise<PreparedPair> {
  await writeFile(
    join(
      TYPESCRIPT_REPOSITORY,
      BENCHMARK_FILE,
    ),
    `scanner-${String(iteration,)}\n`,
  );
  return commandPair({
    args: dryRunCommitArgs(iteration,),
    cwd: TYPESCRIPT_REPOSITORY,
  },);
}

/**
 * Builds changed normalizer direct-fix request.
 *
 * @param iteration - unique content sequence
 *
 * @returns normalizer fix request
 */
async function normalizerChangedRequest({
  iteration,
}: Readonly<{
  iteration: number;
}>,): Promise<PreparedPair> {
  await writeFile(
    join(
      MJS_REPOSITORY,
      BENCHMARK_FILE,
    ),
    `changed-${String(iteration,)}`,
  );
  return commandPair({
    args: dryRunCommitArgs(iteration,),
    cwd: MJS_REPOSITORY,
  },);
}

/**
 * Builds normalizer direct-check request.
 *
 * @returns normalizer request
 */
async function normalizerRequest({
  iteration,
}: Readonly<{
  iteration: number;
}>,): Promise<PreparedPair> {
  await writeFile(
    join(
      MJS_REPOSITORY,
      BENCHMARK_FILE,
    ),
    `normalizer-${String(iteration,)}\n`,
  );
  return commandPair({
    args: dryRunCommitArgs(iteration,),
    cwd: MJS_REPOSITORY,
  },);
}

/**
 * Paired scenarios in stable report order.
 */
export const PAIRED_SCENARIOS: readonly PairedScenario[] = [
  {
  id: 'no-config',
  direct: {
    command: REAL_GIT,
    args: [
      'status',
      '--short',
    ],
    cwd: NO_CONFIG_REPOSITORY,
  },
  wrapper: {
    command: PACKAGE_BIN,
    args: [
      'status',
      '--short',
    ],
    cwd: NO_CONFIG_REPOSITORY,
  },
},
  {
  id: 'read-only',
  direct: {
    command: REAL_GIT,
    args: [
      'rev-parse',
      'HEAD',
    ],
    cwd: TYPESCRIPT_REPOSITORY,
  },
  wrapper: {
    command: PACKAGE_BIN,
    args: [
      'rev-parse',
      'HEAD',
    ],
    cwd: TYPESCRIPT_REPOSITORY,
  },
},
  {
  id: 'strict-mjs',
  direct: {
    command: REAL_GIT,
    args: [
      'status',
      '--short',
    ],
    cwd: MJS_REPOSITORY,
  },
  wrapper: {
    command: PACKAGE_BIN,
    args: [
      'status',
      '--short',
    ],
    cwd: MJS_REPOSITORY,
  },
},
  {
  id: 'strict-typescript',
  direct: {
    command: REAL_GIT,
    args: [
      'status',
      '--short',
    ],
    cwd: TYPESCRIPT_REPOSITORY,
  },
  wrapper: {
    command: PACKAGE_BIN,
    args: [
      'status',
      '--short',
    ],
    cwd: TYPESCRIPT_REPOSITORY,
  },
},
];

/**
 * Prepared paired scenarios in stable report order.
 */
export const PREPARED_PAIRED_SCENARIOS: readonly PreparedPairedScenario[] = [
  {
    id: 'scanner',
    prepare: scannerRequest,
  },
  {
    id: 'normalizer',
    prepare: normalizerRequest,
  },
  {
    id: 'normalizer-change',
    prepare: normalizerChangedRequest,
  },
  {
    id: 'validator',
    prepare: validatorRequest,
  },
  {
    id: 'relaxed-rebuild',
    prepare: relaxedRequest,
  },
];
