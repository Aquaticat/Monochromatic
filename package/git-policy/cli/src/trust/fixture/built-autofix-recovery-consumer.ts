/**
 * Packed process-interruption transaction recovery verification.
 *
 * @module
 */
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
import {
  assertFixtureEqual,
  resolveFixtureOid,
} from './built-post-commit-helpers.ts';
import { verifyCompletedInstallRecovery, } from './built-autofix-recovery-completed.ts';
import {
  verifyConflictingRecoveryReflog,
  verifyReplacedRecoveryLock,
  verifyUnsafeRecoveryDirectory,
} from './built-autofix-recovery-adversarial.ts';
import {
  assertNoTransactionDirectories,
  resolveSingleTransactionDirectory,
} from './built-transaction-registry.ts';

/**
 * Executable private hook mode.
 */
const EXECUTABLE_MODE = 0o700;
/**
 * Preparation-hook source prefix that kills the wrapper owning the transaction.
 *
 * Preparation hooks run under the dispatcher shim beneath native Git,
 * so the wrapper is found through the preparation lease's transaction directory and its owner record.
 */
export const KILL_OWNER_SOURCE = `#!/usr/bin/env node
const { readFileSync } = require('node:fs');
const lease = JSON.parse(process.env.CLI_GIT_PREPARATION_LEASE);
const owner = JSON.parse(readFileSync(lease.directory + '/owner.json', 'utf8'));
process.kill(owner.ownerPid, 'SIGKILL');
`;

/**
 * Hook the landing's compare-and-swap runs in the real repository.
 */
export const LANDING_HOOK = 'reference-transaction';

/**
 * `reference-transaction` hook source prefix that kills the wrapper once its compare-and-swap committed,
 * leaving a landed ref with the real index lock held and the index not installed.
 * The landing runs `git update-ref` directly, so the hook's grandparent is the wrapper.
 */
export const KILL_LANDING_SOURCE = `#!/usr/bin/env node
const { readFileSync } = require('node:fs');
readFileSync(0);
if (process.argv[2] === 'committed') {
  const status = readFileSync('/proc/' + process.ppid + '/status', 'utf8');
  const parentLine = status.split('\\n').find((line) => line.startsWith('PPid:'));
  if (parentLine === undefined) throw new Error('wrapper pid unavailable');
  process.kill(Number(parentLine.slice('PPid:'.length).trim()), 'SIGKILL');
}
`;

/**
 * Reports path presence.
 *
 * @param path - exact fixture path
 *
 * @returns whether access succeeds
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
 * Encodes exact real index bytes.
 *
 * @param repository - disposable repository
 *
 * @returns reversible binary text
 */
async function readIndex(repository: string,): Promise<string> {
  return Buffer.from(await readFile(`${repository}/.git/index`,))
    .toString('base64',);
}

/**
 * Waits for orphaned real Git to settle after wrapper kill.
 */
export async function waitForOrphan(): Promise<void> {
  await execute({
    command: 'sleep',
    args: ['1',],
  },);
}

/**
 * Exercises commit-not-created and commit-created recovery on next shim invocation.
 *
 * @param repository - initialized trusted autofix repository
 *
 * @param env - packed shadow environment
 *
 * @example
 * ```ts
 * await verifyAutofixRecovery({ repository: '/work/repo', env: process.env });
 * ```
 */
export async function verifyAutofixRecovery({
  repository,
  env,
}: Readonly<{
  repository: string;
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  /**
   * Real index lock held by interrupted wrapper.
   */
  const lockPath = `${repository}/.git/index.lock`;
  /**
   * Disposable repository hook path.
   */
  const hookPath = `${repository}/.git/hooks/pre-commit`;

  /**
   * Wrapper interruption before commit creation retains prepared state.
   */
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
    `${repository}/before-marker.txt`,
    'before interruption\n',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'selected.txt',
      'before-marker.txt',
    ],
    cwd: repository,
  },);
  /**
   * Exact index before interrupted non-created commit.
   */
  const beforeIndex = await readIndex(repository,);
  /**
   * Exact HEAD before interrupted non-created commit.
   */
  const beforeHead = await resolveFixtureOid({ repository, },);
  await writeFile(
    hookPath,
    `${KILL_OWNER_SOURCE}throw new Error('abort before commit');\n`,
    { mode: EXECUTABLE_MODE, },
  );
  await execute({
    command: 'git',
    args: [
      'commit',
      '--no-only',
      '--quiet',
      '-m',
      'interrupted before ref',
    ],
    expectedExit: -1,
    cwd: repository,
    env,
  },);
  await waitForOrphan();
  await rm(hookPath,);
  assertFixtureEqual({
    actual: await resolveFixtureOid({ repository, },),
    expected: beforeHead,
    context: 'pre-ref interruption head',
  },);
  assertFixtureEqual({
    actual: await readIndex(repository,),
    expected: beforeIndex,
    context: 'pre-ref interruption index',
  },);
  await resolveSingleTransactionDirectory(repository,);
  if (await pathExists(lockPath,))
    throw new Error('preparation interruption left a real index lock; preparation must never hold it',);
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
    context: 'commit-not-created recovery',
  },);
  if (await pathExists(lockPath,))
    throw new Error('commit-not-created recovery did not clean artifacts',);
  assertFixtureEqual({
    actual: await readIndex(repository,),
    expected: beforeIndex,
    context: 'commit-not-created recovered index',
  },);

  /**
   * Wrapper interruption after commit creation installs prepared index later.
   */
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
    `${repository}/after-marker.txt`,
    'after interruption\n',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'selected.txt',
      'after-marker.txt',
    ],
    cwd: repository,
  },);
  /**
   * Original HEAD before post-ref interruption.
   */
  const postRefOriginalHead = await resolveFixtureOid({ repository, },);
  /**
   * Landing hook kills the wrapper after its compare-and-swap advanced the ref.
   */
  const postHookPath = `${repository}/.git/hooks/${LANDING_HOOK}`;
  await writeFile(
    postHookPath,
    KILL_LANDING_SOURCE,
    { mode: EXECUTABLE_MODE, },
  );
  await execute({
    command: 'git',
    args: [
      'commit',
      '--no-only',
      '--quiet',
      '-m',
      'interrupted after ref',
    ],
    expectedExit: -1,
    cwd: repository,
    env,
  },);
  await waitForOrphan();
  await rm(postHookPath,);
  /**
   * Landed HEAD before recovery.
   */
  const postRefLandedHead = await resolveFixtureOid({ repository, },);
  if (postRefLandedHead === postRefOriginalHead)
    throw new Error('post-ref interruption did not create commit',);
  await resolveSingleTransactionDirectory(repository,);
  if (!(await pathExists(lockPath,)))
    throw new Error('post-ref interruption did not retain recovery artifacts',);
  await verifyReplacedRecoveryLock({
    repository,
    lockPath,
    env,
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
    context: 'commit-created recovery',
  },);
  if (await pathExists(lockPath,))
    throw new Error('commit-created recovery did not clean artifacts',);
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
    context: 'commit-created recovered staged state',
  },);
  assertFixtureEqual({
    actual: await readFile(
      `${repository}/selected.txt`,
      'utf8',
    ),
    expected: 'bad\n',
    context: 'commit-created recovered worktree',
  },);

  await verifyCompletedInstallRecovery({
    repository,
    lockPath,
    postHookPath,
    killingHookSource: KILL_LANDING_SOURCE,
    waitForOrphan,
    env,
  },);

  await verifyConflictingRecoveryReflog({
    repository,
    lockPath,
    postHookPath,
    killingHookSource: KILL_LANDING_SOURCE,
    waitForOrphan,
    env,
  },);

  await verifyUnsafeRecoveryDirectory({
    repository,
    env,
  },);
}
