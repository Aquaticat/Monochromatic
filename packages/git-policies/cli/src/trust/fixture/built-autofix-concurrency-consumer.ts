/**
 * Packed concurrent transaction-owner rejection verification.
 *
 * @module
 */
import { spawn, } from 'node:child_process';
import { once, } from 'node:events';
import {
  access,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import {
  assertIncludes,
  execute,
} from './built-consumer-helpers.ts';
import { assertFixtureEqual, } from './built-post-commit-helpers.ts';

/**
 * Executable private hook mode.
 */
const EXECUTABLE_MODE = 0o700;
/**
 * Bounded one-second readiness probes.
 */
const MAXIMUM_READY_ATTEMPTS = 2 ** (2 + 1);

/**
 * Reports fixture path presence.
 *
 * @param path - exact path
 *
 * @returns whether path exists
 */
async function pathExists(path: string,): Promise<boolean> {
  try {
    await access(path,);
    return true;
  }
  catch (error: unknown) {
    if (Error.isError(error,) && ('code' in error)
      && (error.code === 'ENOENT'))
      return false;
    throw error;
  }
}

/**
 * Waits until active pre-commit hook reports readiness.
 *
 * @param path - ready marker path
 */
async function waitUntilReady(path: string,): Promise<void> {
  for (let attempt = 0; attempt < MAXIMUM_READY_ATTEMPTS; attempt += 1) {
    // oxlint-disable-next-line no-await-in-loop -- Readiness polling is bounded and serial by design.
    if (await pathExists(path,))
      return;
    // oxlint-disable-next-line no-await-in-loop -- One-second process wait bounds active-hook synchronization.
    await execute({
      command: 'sleep',
      args: ['1',],
    },);
  }
  throw new Error('active transaction hook did not become ready',);
}

/**
 * Exercises second wrapper refusal while first transaction owner is alive.
 *
 * @param repository - initialized trusted autofix repository
 *
 * @param env - packed shadow environment
 *
 * @example
 * ```ts
 * await verifyAutofixConcurrency({ repository: '/work/repo', env: process.env });
 * ```
 */
export async function verifyAutofixConcurrency({
  repository,
  env,
}: Readonly<{
  repository: string;
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  await execute({
    command: '/usr/bin/git',
    args: [
      'reset',
      '--hard',
      '--quiet',
      'HEAD',
    ],
    cwd: repository,
  },);
  await writeFile(
    `${repository}/selected.txt`,
    'bad\n',
  );
  await writeFile(
    `${repository}/concurrent-marker.txt`,
    'concurrent marker\n',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'selected.txt',
      'concurrent-marker.txt',
    ],
    cwd: repository,
  },);
  /**
   * Exact real index before active transaction.
   */
  const originalIndex = Buffer.from(await readFile(`${repository}/.git/index`,))
    .toString('base64',);
  /**
   * Active hook readiness path.
   */
  const readyPath = `${repository}/.git/active-transaction-ready`;
  /**
   * Disposable slow failing hook path.
   */
  const hookPath = `${repository}/.git/hooks/pre-commit`;
  await writeFile(
    hookPath,
    `#!/usr/bin/env node
const { execFileSync } = require('node:child_process');
const { writeFileSync } = require('node:fs');
writeFileSync('.git/active-transaction-ready', 'ready\\n');
execFileSync('sleep', ['3']);
throw new Error('active transaction fixture failure');
`,
    { mode: EXECUTABLE_MODE, },
  );
  /**
   * First wrapper holding real-index lock and durable journal.
   */
  const active = spawn(
    'git',
    [
      'commit',
      '--no-only',
      '--quiet',
      '-m',
      'active transaction',
    ],
    {
      cwd: repository,
      env,
      stdio: 'ignore',
    },
  );
  await waitUntilReady(readyPath,);
  /**
   * Concurrent wrapper result while owner PID remains alive.
   */
  const concurrent = await execute({
    command: 'git',
    args: [
      'status',
      '--short',
    ],
    expectedExit: 2,
    cwd: repository,
    env,
  },);
  assertIncludes({
    text: concurrent.stderr,
    expected: 'is still active',
    context: 'concurrent transaction owner',
  },);
  await once(
    active,
    'close',
  );
  if (active.exitCode !== 1)
    throw new Error(`active transaction expected exit 1, got ${String(active.exitCode,)}`,);
  await rm(hookPath,);
  await rm(readyPath,);
  assertFixtureEqual({
    actual: Buffer.from(await readFile(`${repository}/.git/index`,))
      .toString('base64',),
    expected: originalIndex,
    context: 'concurrent transaction real index',
  },);
  if (await pathExists(`${repository}/.git/cli-git-transaction`,))
    throw new Error('failed active transaction left journal after graceful cleanup',);
}
