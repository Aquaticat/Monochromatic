/**
 * Shared real-Git helpers for packed added-path fixtures.
 *
 * @module
 */
import {
  access,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { execute, } from './built-consumer-helpers.ts';
import { assertFixtureEqual, } from './built-post-commit-helpers.ts';

/**
 * Reads exact Git object or index text with real Git.
 *
 * @param repository - disposable repository
 *
 * @param revision - Git object expression
 *
 * @returns exact text
 */
export async function gitText({
  repository,
  revision,
}: Readonly<{
  repository: string;
  revision: string;
}>,): Promise<string> {
  return (await execute({
    command: '/usr/bin/git',
    args: [
      'show',
      revision,
    ],
    cwd: repository,
  },)).stdout;
}

/**
 * Runs real Git without the shim.
 *
 * @param repository - disposable repository
 *
 * @param args - Git arguments
 *
 * @returns standard output
 */
export async function realGit({
  repository,
  args,
}: Readonly<{
  repository: string;
  args: readonly string[];
}>,): Promise<string> {
  return (await execute({
    command: '/usr/bin/git',
    args,
    cwd: repository,
  },)).stdout;
}

/**
 * Resets fixture files to a committed baseline where `dependent.txt` reads `stale`.
 *
 * @param repository - disposable repository
 *
 * @param round - distinct version text for this scenario
 */
export async function resetScenario({
  repository,
  round,
}: Readonly<{
  repository: string;
  round: string;
}>,): Promise<void> {
  await writeFile(
    `${repository}/dependent.txt`,
    'stale\n',
  );
  await realGit({
    repository,
    args: [
      'commit',
      '--quiet',
      '--allow-empty',
      '-m',
      `baseline ${round}`,
      '--',
      'dependent.txt',
    ],
  },);
  await writeFile(
    `${repository}/version.txt`,
    `${round}\n`,
  );
}

/**
 * Asserts the scenario committed the added path and left index and worktree clean.
 *
 * @param repository - disposable repository
 *
 * @param context - scenario label
 */
export async function assertAddedPathCommitted({
  repository,
  context,
}: Readonly<{
  repository: string;
  context: string;
}>,): Promise<void> {
  assertFixtureEqual({
    actual: await gitText({
      repository,
      revision: 'HEAD:dependent.txt',
    },),
    expected: 'bumped\n',
    context: `${context} committed added path`,
  },);
  assertFixtureEqual({
    actual: await gitText({
      repository,
      revision: ':dependent.txt',
    },),
    expected: 'bumped\n',
    context: `${context} indexed added path`,
  },);
  assertFixtureEqual({
    actual: await readFile(
      `${repository}/dependent.txt`,
      'utf8',
    ),
    expected: 'bumped\n',
    context: `${context} worktree added path`,
  },);
  assertFixtureEqual({
    actual: await realGit({
      repository,
      args: [
        'status',
        '--porcelain',
        '--',
        'dependent.txt',
        'version.txt',
      ],
    },),
    expected: '',
    context: `${context} clean status`,
  },);
}

/**
 * Writes files and commits exactly those paths with real Git, bypassing policies.
 *
 * @param repository - disposable repository
 *
 * @param files - exact text by repository path
 *
 * @param message - commit message
 */
export async function commitFiles({
  repository,
  files,
  message,
}: Readonly<{
  repository: string;
  files: Readonly<Record<string, string>>;
  message: string;
}>,): Promise<void> {
  /**
   * Repository paths in the commit.
   */
  const paths = Object.keys(files,);
  await Promise.all(Object.entries(files,)
    .map(async function writeFixtureFile([path, text,],) {
      await writeFile(
        `${repository}/${path}`,
        text,
      );
    },),);
  await realGit({
    repository,
    args: [
      'add',
      '--',
      ...paths,
    ],
  },);
  await realGit({
    repository,
    args: [
      'commit',
      '--quiet',
      '-m',
      message,
      '--',
      ...paths,
    ],
  },);
}

/**
 * Reports path presence.
 *
 * @param path - exact fixture path
 *
 * @returns whether the path exists
 */
export async function pathExists(path: string,): Promise<boolean> {
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
