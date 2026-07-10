/**
 * Adversarial packed recovery filesystem verification.
 *
 * @module
 */
import {
  access,
  copyFile,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import {
  assertIncludes,
  execute,
} from './built-consumer-helpers.ts';
import { resolveFixtureOid, } from './built-post-commit-helpers.ts';

/**
 * Executable private hook mode.
 */
const EXECUTABLE_MODE = 0o700;

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

/**
 * Proves same-OID ref movement without private nonce fails closed.
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
 * await verifyConflictingRecoveryReflog({ repository, transactionDirectory, lockPath, postHookPath, killingHookSource, waitForOrphan, env });
 * ```
 */
export async function verifyConflictingRecoveryReflog({
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
    `${repository}/conflict-recovery.txt`,
    'conflict recovery\n',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'selected.txt',
      'conflict-recovery.txt',
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
      'interrupted conflict provenance',
    ],
    expectedExit: -1,
    cwd: repository,
    env,
  },);
  await waitForOrphan();
  await rm(postHookPath,);
  /**
   * Landed OID touched externally without transaction nonce.
   */
  const conflictingLandedHead = await resolveFixtureOid({ repository, },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'update-ref',
      'HEAD',
      conflictingLandedHead,
      conflictingLandedHead,
    ],
    cwd: repository,
    env: {
      ...env,
      GIT_REFLOG_ACTION: 'external movement',
    },
  },);
  /**
   * Same-OID movement without private nonce remains a recovery conflict.
   */
  const conflictedRecovery = await execute({
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
    text: conflictedRecovery.stderr,
    expected: 'Current HEAD reflog does not identify prepared transaction',
    context: 'same-OID external movement recovery conflict',
  },);
  try {
    await access(transactionDirectory,);
  }
  catch (error: unknown) {
    throw new Error(
      'conflicting recovery discarded journal',
      { cause: error, },
    );
  }
  await rm(
    transactionDirectory,
    { recursive: true, },
  );
  await rm(lockPath,);
}
