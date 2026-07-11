/**
 * Local post-commit remote fixtures for lifecycle latency measurements.
 *
 * @module
 */

import { execute, } from './lifecycle-latency-command.ts';
import {
  DIRECT_COMMIT_REMOTE,
  DIRECT_COMMIT_REPOSITORY,
  REAL_GIT,
  TYPESCRIPT_REPOSITORY,
  WRAPPED_COMMIT_REMOTE,
} from './lifecycle-latency-contracts.ts';

/**
 * Creates equivalent local remotes and direct commit counterpart.
 *
 * @example
 * ```ts
 * await prepareCommitRemotes();
 * ```
 */
export async function prepareCommitRemotes(): Promise<void> {
  await execute({
    command: REAL_GIT,
    args: [
      'init',
      '--quiet',
      '--bare',
      WRAPPED_COMMIT_REMOTE,
    ],
    cwd: '/work',
  },);
  await execute({
    command: REAL_GIT,
    args: [
      'remote',
      'add',
      'origin',
      WRAPPED_COMMIT_REMOTE,
    ],
    cwd: TYPESCRIPT_REPOSITORY,
  },);
  await execute({
    command: REAL_GIT,
    args: [
      'push',
      '--quiet',
      '--set-upstream',
      'origin',
      'main',
    ],
    cwd: TYPESCRIPT_REPOSITORY,
  },);
  await execute({
    command: REAL_GIT,
    args: [
      'clone',
      '--quiet',
      TYPESCRIPT_REPOSITORY,
      DIRECT_COMMIT_REPOSITORY,
    ],
    cwd: '/work',
  },);
  await execute({
    command: REAL_GIT,
    args: [
      'remote',
      'remove',
      'origin',
    ],
    cwd: DIRECT_COMMIT_REPOSITORY,
  },);
  await execute({
    command: REAL_GIT,
    args: [
      'init',
      '--quiet',
      '--bare',
      DIRECT_COMMIT_REMOTE,
    ],
    cwd: '/work',
  },);
  await execute({
    command: REAL_GIT,
    args: [
      'remote',
      'add',
      'origin',
      DIRECT_COMMIT_REMOTE,
    ],
    cwd: DIRECT_COMMIT_REPOSITORY,
  },);
  await execute({
    command: REAL_GIT,
    args: [
      'push',
      '--quiet',
      '--set-upstream',
      'origin',
      'main',
    ],
    cwd: DIRECT_COMMIT_REPOSITORY,
  },);
  await execute({
    command: REAL_GIT,
    args: [
      'config',
      'user.email',
      'cli-git-benchmark@example.invalid',
    ],
    cwd: DIRECT_COMMIT_REPOSITORY,
  },);
  await execute({
    command: REAL_GIT,
    args: [
      'config',
      'user.name',
      'cli-git benchmark',
    ],
    cwd: DIRECT_COMMIT_REPOSITORY,
  },);
}
