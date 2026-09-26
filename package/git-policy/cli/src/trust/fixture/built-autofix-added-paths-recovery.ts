/**
 * Packed verification that interrupted commits recover added paths in the index and worktree.
 *
 * @module
 */
import {
  copyFile,
  readFile,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import {
  assertAddedPathCommitted,
  commitFiles,
  gitText,
  pathExists,
  realGit,
} from './built-autofix-added-paths-helpers.ts';
import {
  KILL_LANDING_SOURCE,
  KILL_OWNER_SOURCE,
  LANDING_HOOK,
  waitForOrphan,
} from './built-autofix-recovery-consumer.ts';
import { execute, } from './built-consumer-helpers.ts';
import {
  assertFixtureEqual,
  resolveFixtureOid,
} from './built-post-commit-helpers.ts';
import {
  assertNoTransactionDirectories,
  resolveSingleTransactionDirectory,
} from './built-transaction-registry.ts';

/**
 * Executable private hook mode.
 */
const EXECUTABLE_MODE = 0o700;

/**
 * Paths of the recovery artifacts an interrupted transaction leaves.
 */
type RecoveryPaths = Readonly<{
  /**
   * Real index lock the interrupted wrapper held.
   */
  lockPath: string;
}>;

/**
 * Commits a stale dependent baseline, stages a version bump, and kills the wrapper from a hook during the shim commit.
 *
 * @param repository - trusted added-path repository
 *
 * @param env - packed shadow environment
 *
 * @param round - distinct version text for this scenario
 *
 * @param hook - Git hook that kills the wrapper: a preparation hook, or the landing's compare-and-swap hook
 *
 * @param hookSuffix - hook source appended after the kill
 *
 * @param recovery - artifacts the interruption must retain
 */
async function interruptAddedPathCommit({
  repository,
  env,
  round,
  hook,
  hookSuffix,
  recovery,
}: Readonly<{
  repository: string;
  env: NodeJS.ProcessEnv;
  round: string;
  hook: 'pre-commit' | typeof LANDING_HOOK;
  hookSuffix: string;
  recovery: RecoveryPaths;
}>,): Promise<void> {
  /**
   * Disposable hook path.
   */
  const hookPath = `${repository}/.git/hooks/${hook}`;
  await commitFiles({
    repository,
    files: {
      'version.txt': `${round} base\n`,
      'dependent.txt': 'stale\n',
    },
    message: `${round} baseline`,
  },);
  await writeFile(
    `${repository}/version.txt`,
    `${round}\n`,
  );
  await realGit({
    repository,
    args: [
      'add',
      'version.txt',
    ],
  },);
  await writeFile(
    hookPath,
    `${hook === 'pre-commit' ? KILL_OWNER_SOURCE : KILL_LANDING_SOURCE}${hookSuffix}`,
    { mode: EXECUTABLE_MODE, },
  );
  await execute({
    command: 'git',
    args: [
      'commit',
      '--no-only',
      '--quiet',
      '-m',
      `interrupted ${round}`,
    ],
    expectedExit: -1,
    cwd: repository,
    env,
  },);
  await waitForOrphan();
  await rm(hookPath,);
  await resolveSingleTransactionDirectory(repository,);
  // Only a landing holds the real index lock; preparation never takes it.
  if ((await pathExists(recovery.lockPath,)) !== (hook === LANDING_HOOK))
    throw new Error(`${round} interruption left unexpected real index lock state`,);
  assertFixtureEqual({
    actual: await readFile(
      `${repository}/dependent.txt`,
      'utf8',
    ),
    expected: 'stale\n',
    context: `${round} worktree dependent before recovery`,
  },);
}

/**
 * Runs a shim command that triggers recovery and asserts the artifacts are gone.
 *
 * @param repository - disposable repository
 *
 * @param env - packed shadow environment
 *
 * @param recovery - artifacts recovery must remove
 *
 * @param context - scenario label
 */
async function recoverThroughShim({
  repository,
  env,
  recovery,
  context,
}: Readonly<{
  repository: string;
  env: NodeJS.ProcessEnv;
  recovery: RecoveryPaths;
  context: string;
}>,): Promise<void> {
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
    context: `${context} recovery`,
  },);
  if (await pathExists(recovery.lockPath,))
    throw new Error(`${context} recovery did not clean artifacts`,);
}

/**
 * Exercises commit-not-created, commit-created, and index-already-installed recovery for a transaction with an added path.
 *
 * @param repository - trusted added-path repository on `main`
 *
 * @param env - packed shadow environment
 *
 * @example
 * ```ts
 * await verifyAddedPathRecovery({ repository: '/work/autofix-added-paths', env: process.env });
 * ```
 */
export async function verifyAddedPathRecovery({
  repository,
  env,
}: Readonly<{
  repository: string;
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  /**
   * Recovery artifacts for the main worktree.
   */
  const recovery: RecoveryPaths = {
    lockPath: `${repository}/.git/index.lock`,
  };

  //region Commit-not-created recovery leaves the dependent untouched

  await interruptAddedPathCommit({
    repository,
    env,
    round: 'recovery-before-ref',
    hook: 'pre-commit',
    hookSuffix: "throw new Error('abort before commit');\n",
    recovery,
  },);
  await recoverThroughShim({
    repository,
    env,
    recovery,
    context: 'commit-not-created',
  },);
  assertFixtureEqual({
    actual: await gitText({
      repository,
      revision: ':dependent.txt',
    },),
    expected: 'stale\n',
    context: 'commit-not-created indexed dependent',
  },);
  assertFixtureEqual({
    actual: await readFile(
      `${repository}/dependent.txt`,
      'utf8',
    ),
    expected: 'stale\n',
    context: 'commit-not-created worktree dependent',
  },);
  assertFixtureEqual({
    actual: await gitText({
      repository,
      revision: ':version.txt',
    },),
    expected: 'recovery-before-ref\n',
    context: 'commit-not-created staged version',
  },);

  //endregion Commit-not-created recovery leaves the dependent untouched

  //region Commit-created recovery installs the index and the dependent worktree copy

  /**
   * `HEAD` before the interrupted landed commit.
   */
  const headBeforeLanded = await resolveFixtureOid({ repository, },);
  await interruptAddedPathCommit({
    repository,
    env,
    round: 'recovery-after-ref',
    hook: LANDING_HOOK,
    hookSuffix: '',
    recovery,
  },);
  if ((await resolveFixtureOid({ repository, },)) === headBeforeLanded)
    throw new Error('added-path post-ref interruption did not create a commit',);
  await recoverThroughShim({
    repository,
    env,
    recovery,
    context: 'commit-created',
  },);
  await assertAddedPathCommitted({
    repository,
    context: 'commit-created recovery',
  },);

  //endregion Commit-created recovery installs the index and the dependent worktree copy

  //region Index-already-installed recovery completes the dependent worktree copy

  await interruptAddedPathCommit({
    repository,
    env,
    round: 'recovery-installed',
    hook: LANDING_HOOK,
    // Keeps the killed wrapper's Git alive briefly, matching the completed-install sibling fixture.
    hookSuffix: 'setTimeout(() => {}, 250);\n',
    recovery,
  },);
  /**
   * Transaction directory the interrupted wrapper retained.
   */
  const transactionDirectory = await resolveSingleTransactionDirectory(repository,);
  // Simulates an interruption after the wrapper installed the prepared index and wrote its durable marker.
  await copyFile(
    `${transactionDirectory}/post-1.index`,
    recovery.lockPath,
  );
  await rename(
    recovery.lockPath,
    `${repository}/.git/index`,
  );
  await writeFile(
    `${transactionDirectory}/index-installed`,
    new Uint8Array(),
  );
  await recoverThroughShim({
    repository,
    env,
    recovery,
    context: 'index-already-installed',
  },);
  await assertAddedPathCommitted({
    repository,
    context: 'index-already-installed recovery',
  },);

  //endregion Index-already-installed recovery completes the dependent worktree copy
}
