/**
 * Adversarial packed recovery filesystem verification.
 *
 * @module
 */
import {
  access,
  copyFile,
  mkdir,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import {
  assertIncludes,
  execute,
} from './built-consumer-helpers.ts';
import {
  assertFixtureEqual,
  resolveFixtureOid,
} from './built-post-commit-helpers.ts';
import {
  assertNoTransactionDirectories,
  resolveSingleTransactionDirectory,
  transactionRegistry,
} from './built-transaction-registry.ts';

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
 * Proves symlinked registry and legacy recovery directories fail before target reads.
 *
 * @param repository - disposable repository
 *
 * @param env - packed wrapper environment
 *
 * @example
 * ```ts
 * await verifyUnsafeRecoveryDirectory({ repository, env });
 * ```
 */
export async function verifyUnsafeRecoveryDirectory({
  repository,
  env,
}: Readonly<{
  repository: string;
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  /**
   * Symlinked entries named like a transaction directory and like the legacy journal directory.
   */
  const unsafeDirectories = [
    `${transactionRegistry(repository,)}/0b6c2c1e-6f5b-4d0e-9a55-3f5d8e2f6a10`,
    `${repository}/.git/cli-git-transaction`,
  ];
  await mkdir(
    transactionRegistry(repository,),
    { recursive: true, },
  );
  for (const unsafeDirectory of unsafeDirectories) {
    // oxlint-disable-next-line no-await-in-loop -- Each unsafe entry is checked alone against a clean registry.
    await symlink(
      '/tmp',
      unsafeDirectory,
      'dir',
    );
    /**
     * Symlinked directory rejection.
     */
    // oxlint-disable-next-line no-await-in-loop -- Each unsafe entry is checked alone against a clean registry.
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
      context: `symlinked recovery directory ${unsafeDirectory}`,
    },);
    // oxlint-disable-next-line no-await-in-loop -- Each unsafe entry is checked alone against a clean registry.
    await rm(unsafeDirectory,);
  }
}

/**
 * Interrupts a landing after its compare-and-swap advanced the ref and before the wrapper recorded it.
 *
 * @param repository - disposable repository
 *
 * @param path - file staged for the interrupted commit
 *
 * @param postHookPath - disposable landing hook
 *
 * @param killingHookSource - wrapper-killing hook prefix
 *
 * @param waitForOrphan - bounded child-settlement wait
 *
 * @param env - packed wrapper environment
 *
 * @returns landed commit
 */
async function interruptAfterRef({
  repository,
  path,
  postHookPath,
  killingHookSource,
  waitForOrphan,
  env,
}: Readonly<{
  repository: string;
  path: string;
  postHookPath: string;
  killingHookSource: string;
  waitForOrphan: () => Promise<void>;
  env: NodeJS.ProcessEnv;
}>,): Promise<string> {
  await writeFile(
    `${repository}/${path}`,
    `${path}\n`,
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'selected.txt',
      path,
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
      `interrupted ${path}`,
    ],
    expectedExit: -1,
    cwd: repository,
    env,
  },);
  await waitForOrphan();
  await rm(postHookPath,);
  return resolveFixtureOid({ repository, },);
}

/**
 * Proves the reflog nonce is found below a later same-commit movement and that a missing nonce fails closed.
 *
 * @param repository - disposable repository
 *
 * @param lockPath - held real-index lock
 *
 * @param postHookPath - disposable landing hook
 *
 * @param killingHookSource - wrapper-killing hook prefix
 *
 * @param waitForOrphan - bounded child-settlement wait
 *
 * @param env - packed wrapper environment
 *
 * @example
 * ```ts
 * await verifyConflictingRecoveryReflog({ repository, lockPath, postHookPath, killingHookSource, waitForOrphan, env });
 * ```
 */
export async function verifyConflictingRecoveryReflog({
  repository,
  lockPath,
  postHookPath,
  killingHookSource,
  waitForOrphan,
  env,
}: Readonly<{
  repository: string;
  lockPath: string;
  postHookPath: string;
  killingHookSource: string;
  waitForOrphan: () => Promise<void>;
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  /**
   * Commit landed before a later external same-commit movement.
   */
  const deeperLanded = await interruptAfterRef({
    repository,
    path: 'deeper-recovery.txt',
    postHookPath,
    killingHookSource,
    waitForOrphan,
    env,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'update-ref',
      '-m',
      'external movement',
      'HEAD',
      deeperLanded,
      deeperLanded,
    ],
    cwd: repository,
  },);
  await execute({
    command: 'git',
    args: [
      'status',
      '--short',
    ],
    cwd: repository,
    env,
  },);
  await assertNoTransactionDirectories({
    repository,
    context: 'recovery with nonce below newest reflog entry',
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
    context: 'recovery with nonce below newest reflog entry staged state',
  },);

  await interruptAfterRef({
    repository,
    path: 'conflict-recovery.txt',
    postHookPath,
    killingHookSource,
    waitForOrphan,
    env,
  },);
  /**
   * Transaction directory whose nonce entry is deleted.
   */
  const transactionDirectory = await resolveSingleTransactionDirectory(repository,);
  /**
   * Branch the landing advanced; its reflog carries the transaction nonce.
   */
  const targetRef = (await execute({
    command: '/usr/bin/git',
    args: [
      'symbolic-ref',
      'HEAD',
    ],
    cwd: repository,
  },)).stdout.trim();
  await execute({
    command: '/usr/bin/git',
    args: [
      'reflog',
      'delete',
      `${targetRef}@{0}`,
    ],
    cwd: repository,
  },);
  /**
   * Ref movement without its nonce remains a recovery conflict.
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
    expected: 'but its reflog lacks the nonce entry',
    context: 'missing reflog nonce recovery conflict',
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
