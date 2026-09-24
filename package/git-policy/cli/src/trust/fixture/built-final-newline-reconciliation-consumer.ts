//region Disposable packed-wrapper regression
/**
 * Selected final-newline commit and no-commit reconciliation through the packed CLI.
 *
 * @module
 */
import { readFile, writeFile, } from 'node:fs/promises';
import { execute, } from './built-consumer-helpers.ts';
import { assertFixtureEqual, initializePostCommitRepository, } from './built-post-commit-helpers.ts';

/**
 * Exercises canonical input, corrected worktrees, and normalization-only commits.
 *
 * @param env - packed shadow Git environment
 *
 * @example
 * ```ts
 * await verifyFinalNewlineReconciliation({ env: process.env });
 * ```
 */
export async function verifyFinalNewlineReconciliation({ env, }: Readonly<{
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  /** Disposable foreign repository without cli-git config. */
  const repository = '/work/final-newline-reconciliation';
  await initializePostCommitRepository(repository,);
  for (const [path, content,] of [
    ['canonical.txt', 'old\n',],
    ['missing.txt', 'old\n',],
    ['repeated.txt', 'old\n',],
    ['newline-only.txt', 'same\n',],
    ['unrelated.txt', 'old\n',],
  ] as const)
    // oxlint-disable-next-line no-await-in-loop -- Each fixture file is created before the baseline commit.
    await writeFile(`${repository}/${path}`, content,);
  await execute({
    command: '/usr/bin/git',
    args: ['add', '--all',],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: ['commit', '--quiet', '--message=baseline',],
    cwd: repository,
  },);
  await writeFile(`${repository}/canonical.txt`, 'canonical\n',);
  /** Already-canonical add must not warn. */
  const canonicalAdd = await execute({
    command: 'git',
    args: ['add', '--', 'canonical.txt',],
    cwd: repository,
    env,
  },);
  assertFixtureEqual({
    actual: canonicalAdd.stderr,
    expected: '',
    context: 'canonical add emits no newline warning',
  },);
  /** Already-canonical commit must not claim a fix. */
  const canonicalCommit = await execute({
    command: 'git',
    args: ['commit', '--quiet', '--message=canonical', '--', 'canonical.txt',],
    cwd: repository,
    env,
  },);
  assertFixtureEqual({
    actual: canonicalCommit.stderr,
    expected: '',
    context: 'canonical pathspec commit emits no fix summary',
  },);
  await writeFile(`${repository}/missing.txt`, 'first\nlast',);
  await writeFile(`${repository}/repeated.txt`, 'first\nlast\n\n',);
  await execute({
    command: 'git',
    args: ['add', '--', 'missing.txt', 'repeated.txt',],
    cwd: repository,
    env,
  },);
  /** Selected worktree files must match normalized committed content. */
  const fixed = await execute({
    command: 'git',
    args: ['commit', '--quiet', '--message=normalized', '--', 'missing.txt', 'repeated.txt',],
    cwd: repository,
    env,
  },);
  if (!fixed.stderr.includes('"changedPaths":["missing.txt","repeated.txt"]',))
    throw new Error(`Expected both selected paths in fix summary: ${fixed.stderr}`,);
  for (const path of ['missing.txt', 'repeated.txt',]) {
    const expected = 'first\nlast\n';
    // oxlint-disable-next-line no-await-in-loop -- Each worktree and HEAD pair must match exact bytes.
    const worktree = await readFile(`${repository}/${path}`, 'utf8',);
    assertFixtureEqual({ actual: worktree, expected, context: `${path} normalized worktree`, },);
    // oxlint-disable-next-line no-await-in-loop -- Each Git blob is checked against its selected worktree copy.
    const committed = await execute({
      command: '/usr/bin/git',
      args: ['show', `HEAD:${path}`,],
      cwd: repository,
    },);
    assertFixtureEqual({ actual: committed.stdout, expected, context: `${path} committed bytes`, },);
  }
  assertFixtureEqual({
    actual: (await execute({ command: '/usr/bin/git', args: ['status', '--short',], cwd: repository, },)).stdout,
    expected: '',
    context: 'normalized pathspec commit is clean',
  },);
  /** A second staged file must survive no-op normalization untouched. */
  await writeFile(`${repository}/unrelated.txt`, 'staged elsewhere\n',);
  await execute({ command: '/usr/bin/git', args: ['add', '--', 'unrelated.txt',], cwd: repository, },);
  await writeFile(`${repository}/newline-only.txt`, 'same',);
  await execute({ command: 'git', args: ['add', '--', 'newline-only.txt',], cwd: repository, env, },);
  const originalHead = (await execute({
    command: '/usr/bin/git', args: ['rev-parse', 'HEAD',], cwd: repository,
  },)).stdout;
  /** Git must not create an empty commit when the normalized tree equals HEAD. */
  const noCommit = await execute({
    command: 'git',
    args: ['commit', '--quiet', '--message=not-created', '--', 'newline-only.txt',],
    cwd: repository,
    env,
    expectedExit: 1,
  },);
  if (!noCommit.stderr.includes('normalization removed every selected change',))
    throw new Error(`Missing normalization-only diagnostic: ${noCommit.stderr}`,);
  assertFixtureEqual({
    actual: (await execute({ command: '/usr/bin/git', args: ['rev-parse', 'HEAD',], cwd: repository, },)).stdout,
    expected: originalHead,
    context: 'normalization-only command leaves HEAD unchanged',
  },);
  assertFixtureEqual({
    actual: await readFile(`${repository}/newline-only.txt`, 'utf8',),
    expected: 'same\n',
    context: 'normalization-only command cleans worktree',
  },);
  assertFixtureEqual({
    actual: (await execute({ command: '/usr/bin/git', args: ['status', '--short',], cwd: repository, },)).stdout,
    expected: 'M  unrelated.txt\n',
    context: 'normalization-only command cleans selected index but preserves unrelated staging',
  },);
}
//endregion Disposable packed-wrapper regression
