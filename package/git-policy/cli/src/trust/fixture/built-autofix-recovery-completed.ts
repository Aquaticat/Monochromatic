/**
 * Packed completed-index interruption recovery verification.
 *
 * @module
 */
import {
  access,
  copyFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { execute, } from './built-consumer-helpers.ts';
import { assertFixtureEqual, } from './built-post-commit-helpers.ts';

/**
 * Executable private hook mode.
 */
const EXECUTABLE_MODE = 0o700;

/**
 * Reports path presence.
 *
 * @param path - exact fixture path
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
 * Simulates interruption after owned index installation and durable marker.
 *
 * @param repository - disposable repository
 *
 * @param transactionDirectory - private recovery directory
 *
 * @param lockPath - held real-index lock
 *
 * @param postHookPath - disposable post-commit hook
 *
 * @param killingHookSource - wrapper-killing hook prefix
 *
 * @param waitForOrphan - bounded child-settlement wait
 *
 * @param env - packed wrapper environment
 *
 * @example
 * ```ts
 * await verifyCompletedInstallRecovery({ repository, transactionDirectory, lockPath, postHookPath, killingHookSource, waitForOrphan, env });
 * ```
 */
export async function verifyCompletedInstallRecovery({
  repository,
  transactionDirectory,
  lockPath,
  postHookPath,
  killingHookSource,
  waitForOrphan,
  env,
}: Readonly<{
  repository: string;
  transactionDirectory: string;
  lockPath: string;
  postHookPath: string;
  killingHookSource: string;
  waitForOrphan: () => Promise<void>;
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  await writeFile(
    `${repository}/completed-recovery.txt`,
    'completed recovery\n',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'selected.txt',
      'completed-recovery.txt',
    ],
    cwd: repository,
  },);
  await writeFile(
    postHookPath,
    `${killingHookSource}setTimeout(() => {}, 250);\n`,
    { mode: EXECUTABLE_MODE, },
  );
  await execute({
    command: 'git',
    args: [
      'commit',
      '--no-only',
      '--quiet',
      '-m',
      'interrupted completed install',
    ],
    expectedExit: -1,
    cwd: repository,
    env,
  },);
  await waitForOrphan();
  await rm(postHookPath,);
  await copyFile(
    `${transactionDirectory}/post.index`,
    lockPath,
  );
  await rename(
    lockPath,
    `${repository}/.git/index`,
  );
  await writeFile(
    `${transactionDirectory}/index-installed`,
    new Uint8Array(),
  );
  await execute({
    command: 'git',
    args: [
      'status',
      '--short',
    ],
    cwd: repository,
    env,
  },);
  if ((await pathExists(transactionDirectory,)) || (await pathExists(lockPath,)))
    throw new Error('completed-index recovery did not clean artifacts',);
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
    context: 'completed-index recovered staged state',
  },);
}
