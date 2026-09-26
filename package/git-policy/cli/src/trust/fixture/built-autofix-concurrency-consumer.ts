/**
 * Packed verification that startup recovery skips a live transaction owner.
 *
 * Per-transaction journals let other invocations proceed while a commit transaction runs.
 * A concurrent commit prepares privately, waits for the hook lock while the first commit's hook runs,
 * and lands without ever touching the real index lock during preparation.
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
import {
  assertNoTransactionDirectories,
  listRegistryEntries,
} from './built-transaction-registry.ts';

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
 * Exercises a read-only invocation and a second commit while the first transaction owner is alive.
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
if (process.env.ACTIVE_TRANSACTION_HOOK === '1') {
  writeFileSync('.git/active-transaction-ready', 'ready\\n');
  execFileSync('sleep', ['6']);
  throw new Error('active transaction fixture failure');
}
`,
    { mode: EXECUTABLE_MODE, },
  );
  /**
   * First wrapper whose preparation hook holds the hook lock while it sleeps and then fails.
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
      env: {
        ...env,
        ACTIVE_TRANSACTION_HOOK: '1',
      },
      stdio: 'ignore',
    },
  );
  await waitUntilReady(readyPath,);
  /**
   * Transaction directories while the owner runs its hook.
   */
  const activeEntries = await listRegistryEntries(repository,);
  if (activeEntries.length !== 1)
    throw new Error(`active transaction expected one registry entry, found ${JSON.stringify(activeEntries,)}`,);
  /**
   * Read-only wrapper result while the owner PID remains alive; recovery skips the live transaction.
   */
  const concurrentStatus = await execute({
    command: 'git',
    args: [
      'status',
      '--short',
    ],
    cwd: repository,
    env,
  },);
  assertIncludes({
    text: concurrentStatus.stdout,
    expected: 'concurrent-marker.txt',
    context: 'status beside live transaction owner',
  },);
  /**
   * Exit of the first wrapper, observed from the moment it is known to be running.
   */
  const activeClosed = once(
    active,
    'close',
  );
  /**
   * Second commit while the first transaction's hook still runs; it waits for the hook lock and then lands.
   */
  const concurrentCommit = await execute({
    command: 'git',
    args: [
      'commit',
      '--no-only',
      '--quiet',
      '-m',
      'concurrent transaction',
    ],
    cwd: repository,
    env,
  },);
  if (concurrentCommit.stderr.includes('EEXIST',) || concurrentCommit.stderr.includes('index.lock',))
    throw new Error(`concurrent commit touched the real index lock\n${concurrentCommit.stderr}`,);
  await activeClosed;
  if (active.exitCode !== 1)
    throw new Error(`active transaction expected exit 1, got ${String(active.exitCode,)}`,);
  await rm(hookPath,);
  await rm(readyPath,);
  assertFixtureEqual({
    actual: (await execute({
      command: '/usr/bin/git',
      args: [
        'log',
        '-1',
        '--format=%s',
      ],
      cwd: repository,
    },)).stdout.trim(),
    expected: 'concurrent transaction',
    context: 'commit landed beside a live transaction owner',
  },);
  assertFixtureEqual({
    actual: (await execute({
      command: '/usr/bin/git',
      args: [
        'diff',
        '--cached',
        '--name-only',
      ],
      cwd: repository,
    },)).stdout,
    expected: '',
    context: 'real index after the concurrent commit landed',
  },);
  if (Buffer.from(await readFile(`${repository}/.git/index`,)).toString('base64',) === originalIndex)
    throw new Error('concurrent commit did not install its landed index',);
  await assertNoTransactionDirectories({
    repository,
    context: 'failed active transaction and landed concurrent transaction',
  },);
}
