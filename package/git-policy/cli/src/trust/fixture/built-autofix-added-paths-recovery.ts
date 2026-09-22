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
  KILL_WRAPPER_SOURCE,
  waitForOrphan,
} from './built-autofix-recovery-consumer.ts';
import { execute, } from './built-consumer-helpers.ts';
import {
  assertFixtureEqual,
  resolveFixtureOid,
} from './built-post-commit-helpers.ts';

/**
 * Executable private hook mode.
 */
const EXECUTABLE_MODE = 0o700;

/**
 * Paths of the recovery artifacts an interrupted transaction leaves.
 */
type RecoveryPaths = Readonly<{
  /**
   * Persistent transaction directory for the main worktree.
   */
  transactionDirectory: string;
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
 * @param hook - Git hook that kills the wrapper
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
  hook: 'pre-commit' | 'post-commit';
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
    `${KILL_WRAPPER_SOURCE}${hookSuffix}`,
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
  if ((!(await pathExists(recovery.transactionDirectory,))) || (!(await pathExists(recovery.lockPath,))))
    throw new Error(`${round} interruption did not retain recovery artifacts`,);
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
  if ((await pathExists(recovery.transactionDirectory,)) || (await pathExists(recovery.lockPath,)))
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
    transactionDirectory: `${repository}/.git/cli-git-transaction`,
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
    hook: 'post-commit',
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
    hook: 'post-commit',
    // Keeps the killed wrapper's Git alive briefly, matching the completed-install sibling fixture.
    hookSuffix: 'setTimeout(() => {}, 250);\n',
    recovery,
  },);
  // Simulates an interruption after the wrapper installed the prepared index and wrote its durable marker.
  await copyFile(
    `${recovery.transactionDirectory}/post.index`,
    recovery.lockPath,
  );
  await rename(
    recovery.lockPath,
    `${repository}/.git/index`,
  );
  await writeFile(
    `${recovery.transactionDirectory}/index-installed`,
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
