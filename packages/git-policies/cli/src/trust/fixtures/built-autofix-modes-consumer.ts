/**
 * Packed extended commit-mode autofix verification.
 *
 * @module
 */
import {
  rm,
  writeFile,
} from 'node:fs/promises';
import { execute, } from './built-consumer-helpers.ts';
import { verifyAutofixSelectionModes, } from './built-autofix-selection-modes-consumer.ts';
import { assertFixtureEqual, } from './built-post-commit-helpers.ts';

/**
 * Reads exact Git object text.
 *
 * @param repository - disposable repository
 *
 * @param revision - Git object expression
 *
 * @returns exact text
 */
async function gitText({
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
 * Exercises pathspec files, deletion, untracked, amend, allow-empty, and merge conclusion.
 *
 * @param repository - initialized trusted autofix repository
 *
 * @param env - packed shadow environment
 *
 * @example
 * ```ts
 * await verifyAutofixModes({ repository: '/work/repo', env: process.env });
 * ```
 */
export async function verifyAutofixModes({
  repository,
  env,
}: Readonly<{
  repository: string;
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
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

  /**
   * NUL pathspec file drives explicit private selection.
   */
  await writeFile(
    `${repository}/selected.txt`,
    'bad\n',
  );
  await writeFile(
    `${repository}/pathspec-marker.txt`,
    'pathspec marker\n',
  );
  await writeFile(
    `${repository}/paths.input`,
    new TextEncoder().encode('selected.txt\0pathspec-marker.txt\0',),
  );
  await execute({
    command: 'git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'pathspec file autofix',
      '--pathspec-from-file=paths.input',
      '--pathspec-file-nul',
    ],
    cwd: repository,
    env,
  },);
  assertFixtureEqual({
    actual: await gitText({
      repository,
      revision: 'HEAD:selected.txt',
    },),
    expected: 'good\n',
    context: 'pathspec file canonical blob',
  },);

  /**
   * Standard-input pathspec source is captured exactly once privately.
   */
  await writeFile(
    `${repository}/selected.txt`,
    'bad\n',
  );
  await writeFile(
    `${repository}/stdin-pathspec.txt`,
    'stdin pathspec\n',
  );
  await execute({
    command: 'git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'stdin pathspec autofix',
      '--pathspec-from-file=-',
    ],
    cwd: repository,
    env,
    input: 'selected.txt\nstdin-pathspec.txt\n',
  },);
  assertFixtureEqual({
    actual: await gitText({
      repository,
      revision: 'HEAD:selected.txt',
    },),
    expected: 'good\n',
    context: 'stdin pathspec canonical blob',
  },);

  /**
   * Deletion and selected untracked path coexist with canonical patch.
   */
  await writeFile(
    `${repository}/delete-me.txt`,
    'delete baseline\n',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'delete-me.txt',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'deletion baseline',
    ],
    cwd: repository,
  },);
  await writeFile(
    `${repository}/selected.txt`,
    'bad\n',
  );
  await rm(`${repository}/delete-me.txt`,);
  await writeFile(
    `${repository}/selected-untracked.txt`,
    'new selected\n',
  );
  await execute({
    command: 'git',
    args: [
      'commit',
      '--quiet',
      '-m',
      'delete and add autofix',
      'selected.txt',
      'delete-me.txt',
      'selected-untracked.txt',
    ],
    cwd: repository,
    env,
  },);
  assertFixtureEqual({
    actual: await gitText({
      repository,
      revision: 'HEAD:selected.txt',
    },),
    expected: 'good\n',
    context: 'delete/add canonical blob',
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'cat-file',
      '-e',
      'HEAD:selected-untracked.txt',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'cat-file',
      '-e',
      'HEAD:delete-me.txt',
    ],
    expectedExit: 128,
    cwd: repository,
  },);

  await verifyAutofixSelectionModes({
    repository,
    env,
  },);
}
