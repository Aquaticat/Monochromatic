/**
 * Packed verification that `git cli-git fix` adds unchanged tracked paths and rewrites only their worktree copies.
 *
 * @module
 */
import {
  readFile,
  writeFile,
} from 'node:fs/promises';
import {
  commitFiles,
  gitText,
} from './built-autofix-added-paths-helpers.ts';
import {
  assertIncludes,
  execute,
} from './built-consumer-helpers.ts';
import {
  assertFixtureEqual,
  resolveFixtureOid,
} from './built-post-commit-helpers.ts';

/**
 * Reads exact real index bytes as reversible text.
 *
 * @param repository - disposable repository
 *
 * @returns base64 index bytes
 */
async function readIndex(repository: string,): Promise<string> {
  return Buffer.from(await readFile(`${repository}/.git/index`,),)
    .toString('base64',);
}

/**
 * Commits a baseline where `dependent.txt` reads `stale`, then bumps `version.txt` in the worktree only.
 *
 * @param repository - trusted added-path repository
 *
 * @param round - distinct version text for this scenario
 */
async function prepareUnstagedBump({
  repository,
  round,
}: Readonly<{
  repository: string;
  round: string;
}>,): Promise<void> {
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
}

/**
 * Exercises direct fix adding a clean unselected dependent, refusing a dirty one, and fixing a selected dirty one.
 *
 * @param repository - trusted added-path repository on `main` whose policy declares the `direct-fix` trigger
 *
 * @param env - packed shadow environment
 *
 * @example
 * ```ts
 * await verifyAddedPathDirectFix({ repository: '/work/autofix-added-paths', env: process.env });
 * ```
 */
export async function verifyAddedPathDirectFix({
  repository,
  env,
}: Readonly<{
  repository: string;
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  //region Direct fix adds the clean unselected dependent to the worktree only

  await prepareUnstagedBump({
    repository,
    round: 'direct-fix-clean',
  },);
  /**
   * Exact real index before the fix.
   */
  const indexBeforeClean = await readIndex(repository,);
  /**
   * `HEAD` before the fix.
   */
  const headBeforeClean = await resolveFixtureOid({ repository, },);
  /**
   * Direct fix selecting only the bumped file.
   */
  const clean = await execute({
    command: 'git',
    args: [
      'cli-git',
      'fix',
      '--',
      'version.txt',
    ],
    cwd: repository,
    env,
  },);
  assertIncludes({
    text: clean.stdout,
    expected: '"changedPaths":["dependent.txt"]',
    context: 'direct-fix added path summary',
  },);
  assertFixtureEqual({
    actual: await readFile(
      `${repository}/dependent.txt`,
      'utf8',
    ),
    expected: 'bumped\n',
    context: 'direct-fix added path worktree',
  },);
  assertFixtureEqual({
    actual: await readIndex(repository,),
    expected: indexBeforeClean,
    context: 'direct-fix added path real index bytes',
  },);
  assertFixtureEqual({
    actual: await gitText({
      repository,
      revision: ':dependent.txt',
    },),
    expected: 'stale\n',
    context: 'direct-fix added path indexed dependent',
  },);
  assertFixtureEqual({
    actual: await resolveFixtureOid({ repository, },),
    expected: headBeforeClean,
    context: 'direct-fix added path HEAD',
  },);

  //endregion Direct fix adds the clean unselected dependent to the worktree only

  //region Direct fix refuses an unselected dependent with local edits

  await prepareUnstagedBump({
    repository,
    round: 'direct-fix-dirty',
  },);
  await writeFile(
    `${repository}/dependent.txt`,
    'local edit\n',
  );
  /**
   * Exact real index before the refused fix.
   */
  const indexBeforeDirty = await readIndex(repository,);
  /**
   * Refused direct fix.
   */
  const dirty = await execute({
    command: 'git',
    args: [
      'cli-git',
      'fix',
      '--',
      'version.txt',
    ],
    cwd: repository,
    env,
    expectedExit: 2,
  },);
  assertIncludes({
    text: `${dirty.stdout}${dirty.stderr}`,
    expected: 'which this fix did not select, but its worktree copy has unstaged changes',
    context: 'direct-fix dirty dependent diagnostic',
  },);
  assertIncludes({
    text: `${dirty.stdout}${dirty.stderr}`,
    expected: '"code":"patch-conflict"',
    context: 'direct-fix dirty dependent failure code',
  },);
  assertFixtureEqual({
    actual: await readFile(
      `${repository}/dependent.txt`,
      'utf8',
    ),
    expected: 'local edit\n',
    context: 'direct-fix dirty dependent worktree unchanged',
  },);
  assertFixtureEqual({
    actual: await readIndex(repository,),
    expected: indexBeforeDirty,
    context: 'direct-fix dirty dependent real index bytes',
  },);

  //endregion Direct fix refuses an unselected dependent with local edits

  //region Selecting the dirty dependent lets the fix apply to its worktree copy

  await execute({
    command: 'git',
    args: [
      'cli-git',
      'fix',
      '--',
      'version.txt',
      'dependent.txt',
    ],
    cwd: repository,
    env,
  },);
  assertFixtureEqual({
    actual: await readFile(
      `${repository}/dependent.txt`,
      'utf8',
    ),
    expected: 'bumped\n',
    context: 'direct-fix selected dependent worktree',
  },);
  assertFixtureEqual({
    actual: await readIndex(repository,),
    expected: indexBeforeDirty,
    context: 'direct-fix selected dependent real index bytes',
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'restore',
      '--worktree',
      '--',
      'version.txt',
      'dependent.txt',
    ],
    cwd: repository,
  },);

  //endregion Selecting the dirty dependent lets the fix apply to its worktree copy
}
