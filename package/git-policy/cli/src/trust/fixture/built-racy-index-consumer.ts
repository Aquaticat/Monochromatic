/**
 * Packed verification that private index copies and installs keep Git's racy-entry protection (#544).
 *
 * Each scenario pins a tracked file's cached stat and the real index to one past second,
 * then rewrites the file with same-size bytes and the same mtime.
 * Only the index timestamp tells Git to re-hash that entry,
 * so a private index copy or install with a fresh mtime hides the edit.
 *
 * @module
 */
import {
  copyFile,
  readFile,
  rm,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { execute, } from './built-consumer-helpers.ts';
import {
  assertFixtureEqual,
  initializePostCommitRepository,
} from './built-post-commit-helpers.ts';

/**
 * Seconds between the pinned stat second and the scenario start, well outside any same-second window.
 */
const PINNED_SECONDS_AGO = 100;
/**
 * Milliseconds per second for converting wall-clock time.
 */
const MILLISECONDS_PER_SECOND = 1000;

/**
 * Creates a trusted repository whose tracked files form its first commit.
 *
 * @param repository - disposable repository root
 *
 * @param files - baseline text keyed by repository path
 *
 * @param env - PATH-first packed shadow environment
 *
 * @example
 * ```ts
 * await initializeRacyRepository({ repository: '/work/racy', files: { 'a.txt': 'a\n' }, env });
 * ```
 */
async function initializeRacyRepository({
  repository,
  files,
  env,
}: Readonly<{
  repository: string;
  files: Readonly<Record<string, string>>;
  env: NodeJS.ProcessEnv;
}>,): Promise<void> {
  await initializePostCommitRepository(repository,);
  // A rewrite changes ctime, so ctime must not decide staleness for the pinned mtime to matter.
  await execute({
    command: '/usr/bin/git',
    args: [
      'config',
      'core.trustctime',
      'false',
    ],
    cwd: repository,
  },);
  await writeFile(
    `${repository}/cli-git.config.mjs`,
    'export default {};\n',
  );
  await Promise.all(Object.entries(files,)
    .map(async function writeBaseline([path, text,],) {
    await writeFile(
      `${repository}/${path}`,
      text,
    );
  },),);
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      '--all',
    ],
    cwd: repository,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'commit',
      '--quiet',
      '--message=racy baseline',
    ],
    cwd: repository,
  },);
  await execute({
    command: 'git',
    args: [
      'cli-git',
      'trust',
      '--yes',
    ],
    cwd: repository,
    env,
  },);
}

/**
 * Leaves a same-size edit that only the real index timestamp exposes, and proves that precondition.
 *
 * @param repository - disposable repository root
 *
 * @param path - tracked file whose edit must stay visible
 *
 * @param edited - replacement text with the baseline's byte length
 *
 * @example
 * ```ts
 * await pinRacyEdit({ repository: '/work/racy', path: 'a.txt', edited: 'b\n' });
 * ```
 */
async function pinRacyEdit({
  repository,
  path,
  edited,
}: Readonly<{
  repository: string;
  path: string;
  edited: string;
}>,): Promise<void> {
  /**
   * Whole past second shared by the cached stat, the edit, and the real index.
   */
  const pinnedSecond = Math.floor(Date.now() / MILLISECONDS_PER_SECOND,) - PINNED_SECONDS_AGO;
  /**
   * Absolute file path.
   */
  const filePath = `${repository}/${path}`;
  /**
   * Absolute real index path.
   */
  const indexPath = `${repository}/.git/index`;
  assertFixtureEqual({
    actual: String(Buffer.byteLength(edited,),),
    expected: String((await readFile(filePath,)).byteLength,),
    context: `racy edit size for ${path}`,
  },);
  await utimes(
    filePath,
    pinnedSecond,
    pinnedSecond,
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'update-index',
      '--refresh',
    ],
    cwd: repository,
  },);
  await utimes(
    indexPath,
    pinnedSecond,
    pinnedSecond,
  );
  await writeFile(
    filePath,
    edited,
  );
  await utimes(
    filePath,
    pinnedSecond,
    pinnedSecond,
  );
  // Positive control: the real index exposes the edit, and a plain copy with a fresh mtime hides it.
  await execute({
    command: '/usr/bin/git',
    args: [
      'diff-files',
      '--quiet',
      '--',
      path,
    ],
    cwd: repository,
    expectedExit: 1,
  },);
  /**
   * Plain copy of the real index carrying a fresh modification time.
   */
  const controlIndexPath = `${repository}/.git/racy-control-index`;
  await copyFile(
    indexPath,
    controlIndexPath,
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'diff-files',
      '--quiet',
      '--',
      path,
    ],
    cwd: repository,
    env: {
      ...process.env,
      GIT_INDEX_FILE: controlIndexPath,
    },
  },);
  await rm(controlIndexPath,);
}

/**
 * Requires the real index to still expose the pinned edit.
 *
 * @param repository - disposable repository root
 *
 * @param path - tracked file with the pinned edit
 *
 * @param context - lifecycle that just replaced or read the index
 *
 * @example
 * ```ts
 * await assertEditVisible({ repository: '/work/racy', path: 'a.txt', context: 'commit' });
 * ```
 */
async function assertEditVisible({
  repository,
  path,
  context,
}: Readonly<{
  repository: string;
  path: string;
  context: string;
}>,): Promise<void> {
  /**
   * Plumbing status that never refreshes or rewrites the index.
   */
  const visible = await execute({
    command: '/usr/bin/git',
    args: [
      'diff-files',
      '--name-only',
      '--',
      path,
    ],
    cwd: repository,
  },);
  assertFixtureEqual({
    actual: visible.stdout,
    expected: `${path}\n`,
    context: `${context} keeps the same-size edit of ${path} visible in the real index`,
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

  //region commits keep an unselected edit visible in the installed index

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
    'other changed\n',
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
    files: { 'hold.txt': 'racy hold base\n', },
    env,
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
      '--quiet',
      '--allow-empty',
      '--message=index commit beside racy edit',
    ],
    cwd: indexRepository,
    env,
  },);
  await assertEditVisible({
    repository: indexRepository,
    path: 'hold.txt',
    context: 'index-mode commit',
  },);

  //endregion commits keep an unselected edit visible in the installed index
}
