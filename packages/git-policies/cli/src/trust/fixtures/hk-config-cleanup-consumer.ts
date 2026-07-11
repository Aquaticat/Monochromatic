#!/usr/bin/env node
/**
 * Disposable configured and unconfigured hk Git-config cleanup verification.
 *
 * @module
 */

import { mkdtempDisposable, } from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import nanoSpawn from 'nano-spawn';

import { cleanupHkGitConfig, } from '../../maintenance/hk-config-cleanup.ts';
import { resolveGit, } from '../../resolve-git.ts';

//region Cleanup fixture -- Prove exact ownership and repeated no-op behavior in disposable config files.

/**
 * Throws when exact string arrays differ.
 *
 * @param actual - observed ordered values
 *
 * @param expected - required ordered values
 *
 * @param context - failure boundary
 *
 * @throws {@link TypeError} when values differ
 *
 * @example
 * ```ts
 * assertStrings({ actual: ['a'], expected: ['a'], context: 'example' });
 * ```
 */
function assertStrings({
  actual,
  expected,
  context,
}: Readonly<{
  actual: readonly string[];
  expected: readonly string[];
  context: string;
}>,): void {
  if (JSON.stringify(actual,) !== JSON.stringify(expected,))
    throw new TypeError(`${context}: expected ${JSON.stringify(expected,)}, received ${JSON.stringify(actual,)}`,);
}

/**
 * Real Git executable outside cli-git's package shim.
 */
const gitPath = await resolveGit();
/**
 * Disposable owner for repository and global config bytes.
 */
await using tempDirectory = await mkdtempDisposable(join(
  tmpdir(),
  'cli-git-hk-cleanup-',
),);
/**
 * Repository receiving isolated local Git configuration.
 */
const repository = join(
  tempDirectory.path,
  'repository',
);
/**
 * Explicit global configuration path prevents fixture access to user Git state.
 */
const globalConfig = join(
  tempDirectory.path,
  'global.gitconfig',
);
/**
 * Environment redirecting every global Git-config operation into disposable bytes.
 */
const globalEnvironment = { GIT_CONFIG_GLOBAL: globalConfig, };

await nanoSpawn(
  gitPath,
  [
    'init',
    '--quiet',
    repository,
  ],
);

/**
 * Empty local cleanup result before any hk key exists.
 */
const emptyLocal = await cleanupHkGitConfig({
  gitPath,
  scope: 'local',
  cwd: repository,
},);
/**
 * Empty global cleanup result before any hk key exists.
 */
const emptyGlobal = await cleanupHkGitConfig({
  gitPath,
  scope: 'global',
  cwd: repository,
  env: globalEnvironment,
},);
assertStrings({
  actual: emptyLocal.removedKeys,
  expected: [],
  context: 'unconfigured local cleanup',
},);
assertStrings({
  actual: emptyGlobal.removedKeys,
  expected: [],
  context: 'unconfigured global cleanup',
},);

await nanoSpawn(
  gitPath,
  [
  'config',
  '--local',
  'hook.hk-pre-commit.command',
  'hk-local-command',
],
  { cwd: repository, },
);
await nanoSpawn(
  gitPath,
  [
  'config',
  '--local',
  'hook.hk-pre-commit.event',
  'pre-commit',
],
  { cwd: repository, },
);
await nanoSpawn(
  gitPath,
  [
  'config',
  '--local',
  'hook.other.command',
  'preserve-local',
],
  { cwd: repository, },
);
await nanoSpawn(
  gitPath,
  [
  'config',
  '--global',
  'hook.hk-pre-push.command',
  'hk-global-command',
],
  {
  cwd: repository,
  env: globalEnvironment,
},
);
await nanoSpawn(
  gitPath,
  [
  'config',
  '--global',
  'hook.hk-pre-push.event',
  'pre-push',
],
  {
  cwd: repository,
  env: globalEnvironment,
},
);
await nanoSpawn(
  gitPath,
  [
  'config',
  '--global',
  'hook.other.command',
  'preserve-global',
],
  {
  cwd: repository,
  env: globalEnvironment,
},
);

/**
 * Configured local cleanup result.
 */
const configuredLocal = await cleanupHkGitConfig({
  gitPath,
  scope: 'local',
  cwd: repository,
},);
/**
 * Configured global cleanup result.
 */
const configuredGlobal = await cleanupHkGitConfig({
  gitPath,
  scope: 'global',
  cwd: repository,
  env: globalEnvironment,
},);
assertStrings({
  actual: configuredLocal.removedKeys,
  expected: [
    'hook.hk-pre-commit.command',
    'hook.hk-pre-commit.event',
  ],
  context: 'configured local cleanup',
},);
assertStrings({
  actual: configuredGlobal.removedKeys,
  expected: [
    'hook.hk-pre-push.command',
    'hook.hk-pre-push.event',
  ],
  context: 'configured global cleanup',
},);

/**
 * Preserved unrelated local hook value.
 */
const preservedLocal = await nanoSpawn(
  gitPath,
  [
  'config',
  '--local',
  '--get',
  'hook.other.command',
],
  { cwd: repository, },
);
/**
 * Preserved unrelated global hook value.
 */
const preservedGlobal = await nanoSpawn(
  gitPath,
  [
  'config',
  '--global',
  '--get',
  'hook.other.command',
],
  {
  cwd: repository,
  env: globalEnvironment,
},
);
assertStrings({
  actual: [preservedLocal.stdout,],
  expected: ['preserve-local',],
  context: 'unrelated local key',
},);
assertStrings({
  actual: [preservedGlobal.stdout,],
  expected: ['preserve-global',],
  context: 'unrelated global key',
},);

/**
 * Repeated local cleanup proving idempotence.
 */
const repeatedLocal = await cleanupHkGitConfig({
  gitPath,
  scope: 'local',
  cwd: repository,
},);
/**
 * Repeated global cleanup proving idempotence.
 */
const repeatedGlobal = await cleanupHkGitConfig({
  gitPath,
  scope: 'global',
  cwd: repository,
  env: globalEnvironment,
},);
assertStrings({
  actual: repeatedLocal.removedKeys,
  expected: [],
  context: 'repeated local cleanup',
},);
assertStrings({
  actual: repeatedGlobal.removedKeys,
  expected: [],
  context: 'repeated global cleanup',
},);

await nanoSpawn(
  gitPath,
  [
  'config',
  '--local',
  'hook.hk-pre-commit.command',
  'hk-task-local-command',
],
  { cwd: repository, },
);
await nanoSpawn(
  gitPath,
  [
  'config',
  '--global',
  'hook.hk-pre-push.command',
  'hk-task-global-command',
],
  {
  cwd: repository,
  env: globalEnvironment,
},
);
/**
 * Root cleanup task result proving usage flags reach exact local and global scopes.
 */
const taskCleanup = await nanoSpawn(
  'mise',
  [
  'run',
  '//:cleanup:hk-git-config',
  '--',
  '--local',
  '--global',
],
  {
  cwd: process.cwd(),
  env: {
    CLI_GIT_HK_CLEANUP_CWD: repository,
    GIT_CONFIG_GLOBAL: globalConfig,
  },
  stderr: 'inherit',
},
);
if ((!taskCleanup.stdout
  .includes('hook.hk-pre-commit.command',))
  || (!taskCleanup.stdout
    .includes('hook.hk-pre-push.command',)))
  throw new TypeError('Root cleanup task omitted configured hk keys from its result.',);

/**
 * Local cleanup after root-task execution; empty proves task removed configured key.
 */
const taskCleanedLocal = await cleanupHkGitConfig({
  gitPath,
  scope: 'local',
  cwd: repository,
},);
/**
 * Global cleanup after root-task execution; empty proves task removed configured key.
 */
const taskCleanedGlobal = await cleanupHkGitConfig({
  gitPath,
  scope: 'global',
  cwd: repository,
  env: globalEnvironment,
},);
assertStrings({
  actual: taskCleanedLocal.removedKeys,
  expected: [],
  context: 'root task local cleanup',
},);
assertStrings({
  actual: taskCleanedGlobal.removedKeys,
  expected: [],
  context: 'root task global cleanup',
},);

//endregion Cleanup fixture
