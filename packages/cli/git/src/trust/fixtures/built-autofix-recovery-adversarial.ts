/**
 * Adversarial packed recovery filesystem verification.
 *
 * @module
 */
import {
  copyFile,
  rename,
  rm,
  symlink,
} from 'node:fs/promises';
import {
  assertIncludes,
  execute,
} from './built-consumer-helpers.ts';

/**
 * Proves replaced real-index lock identity fails closed.
 *
 * @param repository - disposable repository
 *
 * @param lockPath - held real-index lock
 *
 * @param env - packed wrapper environment
 *
 * @example
 * ```ts
 * await verifyReplacedRecoveryLock({ repository, lockPath, env });
 * ```
 */
export async function verifyReplacedRecoveryLock({
  repository,
  lockPath,
  env,
}: Readonly<{
  repository: string;
  lockPath: string;
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  /**
   * Original owned lock moved aside for replacement-identity evidence.
   */
  const originalLockPath = `${lockPath}.original`;
  await rename(
    lockPath,
    originalLockPath,
  );
  await copyFile(
    originalLockPath,
    lockPath,
  );
  /**
   * Replaced lock recovery rejection.
   */
  const replacedLock = await execute({
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
    text: replacedLock.stderr,
    expected: 'Index lock identity changed',
    context: 'replaced recovery lock',
  },);
  await rm(lockPath,);
  await rename(
    originalLockPath,
    lockPath,
  );
}

/**
 * Proves symlinked recovery directory fails before target reads.
 *
 * @param repository - disposable repository
 *
 * @param transactionDirectory - absent private recovery directory path
 *
 * @param env - packed wrapper environment
 *
 * @example
 * ```ts
 * await verifyUnsafeRecoveryDirectory({ repository, transactionDirectory, env });
 * ```
 */
export async function verifyUnsafeRecoveryDirectory({
  repository,
  transactionDirectory,
  env,
}: Readonly<{
  repository: string;
  transactionDirectory: string;
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  await symlink(
    '/tmp',
    transactionDirectory,
    'dir',
  );
  /**
   * Symlinked directory rejection.
   */
  const symlinked = await execute({
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
    text: symlinked.stderr,
    expected: 'Unsafe transaction recovery directory',
    context: 'symlinked recovery directory',
  },);
  await rm(transactionDirectory,);
}
