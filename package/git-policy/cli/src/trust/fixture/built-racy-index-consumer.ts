/**
 * Packed verification that private index copies and installs keep Git's racy-entry protection (#544).
 *
 * Each scenario pins a tracked file's cached stat and the real index to one past second,
 * then rewrites the file with same-size bytes and the same mtime.
 * Only the index timestamp tells Git to re-hash that entry,
 * so a private index copy or install with a fresh mtime hides the edit.
 * Commit scenarios stage a file missing its final newline:
 * without a fix to apply,
 * cli-git hands the commit to real Git on the real index and no private index is installed.
 *
 * @module
 */
import {
  readFile,
  writeFile,
} from 'node:fs/promises';
import { execute, } from './built-consumer-helpers.ts';
import { assertFixtureEqual, } from './built-post-commit-helpers.ts';
import {
  assertEditVisible,
  initializeRacyRepository,
  pinRacyEdit,
} from './built-racy-index-helpers.ts';
import { verifyRacyIndexInstall, } from './built-racy-index-install.ts';

/**
 * Requires the landed commit to carry the final-newline fix, proving the private index was installed.
 *
 * @param repository - disposable repository root
 *
 * @param context - commit mode label
 *
 * @example
 * ```ts
 * await assertOtherFixed({ repository: '/work/racy', context: 'explicit-path commit' });
 * ```
 */
export async function assertOtherFixed({
  repository,
  context,
}: Readonly<{
  repository: string;
  context: string;
}>,): Promise<void> {
  assertFixtureEqual({
    actual: (await execute({
      command: '/usr/bin/git',
      args: [
        'show',
        'HEAD:other.txt',
      ],
      cwd: repository,
    },)).stdout,
    expected: 'other changed\n',
    context: `${context} committed final-newline fix`,
  },);
}

/**
 * Exercises direct fix, explicit-path commit, and index-mode commit over a racily clean edit.
 *
 * @param env - PATH-first packed shadow environment
 *
 * @example
 * ```ts
 * await verifyRacyIndexConsumer({ env: process.env });
 * ```
 */
export async function verifyRacyIndexConsumer({ env, }: Readonly<{
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  //region direct fix sees an edit hidden behind cached stat

  /**
   * Direct-fix repository.
   */
  const fixRepository = '/work/racy-index-fix';
  await initializeRacyRepository({
    repository: fixRepository,
    files: { 'fix.txt': 'racy fix base\n', },
    env,
  },);
  await pinRacyEdit({
    repository: fixRepository,
    path: 'fix.txt',
    edited: 'racy-fix-base!',
  },);
  /**
   * Direct fix selecting the pinned file.
   */
  const fixed = await execute({
    command: 'git',
    args: [
      'cli-git',
      'fix',
      '--policy',
      'final-newline',
      '--',
      'fix.txt',
    ],
    cwd: fixRepository,
    env,
  },);
  assertFixtureEqual({
    actual: fixed.stdout,
    expected: '{"schemaVersion":1,"sequence":0,"type":"fix-summary","trigger":"direct-fix","passes":1,"changedPaths":["fix.txt"]}\n',
    context: 'racy direct-fix summary',
  },);
  assertFixtureEqual({
    actual: await readFile(
      `${fixRepository}/fix.txt`,
      'utf8',
    ),
    expected: 'racy-fix-base!\n',
    context: 'racy direct-fix worktree bytes',
  },);

  //endregion direct fix sees an edit hidden behind cached stat

  //region fixed commits keep an unselected edit visible in the installed index

  /**
   * Explicit-path commit repository.
   */
  const explicitRepository = '/work/racy-index-explicit';
  await initializeRacyRepository({
    repository: explicitRepository,
    files: {
      'hold.txt': 'racy hold base\n',
      'other.txt': 'other base\n',
    },
    env,
  },);
  await pinRacyEdit({
    repository: explicitRepository,
    path: 'hold.txt',
    edited: 'racy hold edit\n',
  },);
  // Edited after the pin so refreshing the index sees only the held file.
  await writeFile(
    `${explicitRepository}/other.txt`,
    'other changed',
  );
  await execute({
    command: 'git',
    args: [
      'commit',
      '--quiet',
      '--message=explicit commit beside racy edit',
      '--',
      'other.txt',
    ],
    cwd: explicitRepository,
    env,
  },);
  await assertOtherFixed({
    repository: explicitRepository,
    context: 'explicit-path commit',
  },);
  await assertEditVisible({
    repository: explicitRepository,
    path: 'hold.txt',
    context: 'explicit-path commit',
  },);

  /**
   * Index-mode commit repository.
   */
  const indexRepository = '/work/racy-index-mode';
  await initializeRacyRepository({
    repository: indexRepository,
    files: {
      'hold.txt': 'racy hold base\n',
      'other.txt': 'other base\n',
    },
    env,
  },);
  // Staged with real Git before the pin, because any later real index write would re-hash the pinned entry itself.
  await writeFile(
    `${indexRepository}/other.txt`,
    'other changed',
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      'other.txt',
    ],
    cwd: indexRepository,
  },);
  await pinRacyEdit({
    repository: indexRepository,
    path: 'hold.txt',
    edited: 'racy hold edit\n',
  },);
  await execute({
    command: 'git',
    args: [
      'commit',
      '--no-only',
      '--quiet',
      '--message=index commit beside racy edit',
    ],
    cwd: indexRepository,
    env,
  },);
  await assertOtherFixed({
    repository: indexRepository,
    context: 'index-mode commit',
  },);
  await assertEditVisible({
    repository: indexRepository,
    path: 'hold.txt',
    context: 'index-mode commit',
  },);

  //endregion fixed commits keep an unselected edit visible in the installed index

  await verifyRacyIndexInstall({ env, },);
}
