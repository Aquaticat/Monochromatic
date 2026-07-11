/**
 * Static scenario declarations for lifecycle latency benchmark.
 *
 * @module
 */

import { appendFile, } from 'node:fs/promises';
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
 * Scenario absolute-command declaration.
 */
export type AbsoluteScenario = Readonly<{
  /**
   * Stable scenario identity.
   */
  id: LifecycleScenarioId;
  /**
   * Builds next stateful request.
   */
  request: (input: Readonly<{
    /**
     * Unique state sequence.
     */
    iteration: number;
    /**
     * Prepared trust facts.
     */
    fixture: LifecycleFixture;
  }>,) => Promise<CommandRequest>;
}>;

/**
 * Builds validator trust request after changing exact bytes.
 *
 * @param iteration - unique source sequence
 *
 * @returns trust request
 */
async function validatorRequest({
  iteration,
}: Readonly<{
  iteration: number;
}>,): Promise<CommandRequest> {
  await appendFile(
    join(
      MJS_REPOSITORY,
      'cli-git.config.mjs',
    ),
    `// validator-${String(iteration,)}\n`,
  );
  return {
    command: PACKAGE_BIN,
    args: [
      'cli-git',
      'trust',
      '--yes',
    ],
    cwd: MJS_REPOSITORY,
  };
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
}>,): Promise<CommandRequest> {
  await appendFile(
    join(
      TYPESCRIPT_REPOSITORY,
      'cli-git.config.ts',
    ),
    `// relaxed-${String(iteration,)}\n`,
  );
  return {
    command: PACKAGE_BIN,
    args: [
      'status',
      '--short',
    ],
    cwd: TYPESCRIPT_REPOSITORY,
    env: fixture.relaxedEnvironment,
  };
}

/**
 * Builds scanner direct-check request.
 *
 * @returns scanner request
 */
function scannerRequest(): Promise<CommandRequest> {
  return Promise.resolve({
    command: PACKAGE_BIN,
    args: [
      'cli-git',
      'check',
      '--policy',
      'security/forbidden-strings',
      '--',
      BENCHMARK_FILE,
    ],
    cwd: TYPESCRIPT_REPOSITORY,
  },);
}

/**
 * Builds normalizer direct-check request.
 *
 * @returns normalizer request
 */
function normalizerRequest(): Promise<CommandRequest> {
  return Promise.resolve({
    command: PACKAGE_BIN,
    args: [
      'cli-git',
      'check',
      '--policy',
      'final-newline',
      '--',
      BENCHMARK_FILE,
    ],
    cwd: TYPESCRIPT_REPOSITORY,
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
 * Absolute scenarios in stable report order.
 */
export const ABSOLUTE_SCENARIOS: readonly AbsoluteScenario[] = [
  {
  id: 'validator',
  request: validatorRequest,
},
  {
  id: 'relaxed-rebuild',
  request: relaxedRequest,
},
  {
  id: 'scanner',
  request: scannerRequest,
},
  {
  id: 'normalizer',
  request: normalizerRequest,
},
];
