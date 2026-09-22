/**
 * Racily clean index fixture helpers for #544.
 *
 * Git re-hashes a cached entry only when its mtime is not older than the index file's mtime,
 * so pinning a tracked file's cached stat and an index to one past second leaves a same-size edit
 * that only the index timestamp exposes.
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
export async function initializeRacyRepository({
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
 * Pins one tracked file's cached stat and the real index to the same past second without editing the file.
 *
 * @param repository - disposable repository root
 *
 * @param path - tracked file whose cached stat is pinned
 *
 * @returns pinned whole second
 *
 * @example
 * ```ts
 * const pinnedSecond = await pinCachedStat({ repository: '/work/racy', path: 'a.txt' });
 * ```
 */
export async function pinCachedStat({
  repository,
  path,
}: Readonly<{
  repository: string;
  path: string;
}>,): Promise<number> {
  /**
   * Whole past second shared by the cached stat and the real index.
   */
  const pinnedSecond = Math.floor(Date.now() / MILLISECONDS_PER_SECOND,) - PINNED_SECONDS_AGO;
  await utimes(
    `${repository}/${path}`,
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
    `${repository}/.git/index`,
    pinnedSecond,
    pinnedSecond,
  );
  return pinnedSecond;
}

/**
 * JavaScript statements that rewrite a pinned file with same-size bytes at the pinned second.
 *
 * @param path - repository-relative file, resolved from the hook's repository-root working directory
 *
 * @param edited - replacement text with the baseline's byte length
 *
 * @param pinnedSecond - cached stat second to keep
 *
 * @returns CommonJS statements for a Node hook
 *
 * @example
 * ```ts
 * racyEditStatements({ path: 'a.txt', edited: 'b\n', pinnedSecond: 1 });
 * ```
 */
export function racyEditStatements({
  path,
  edited,
  pinnedSecond,
}: Readonly<{
  path: string;
  edited: string;
  pinnedSecond: number;
}>,): string {
  return `require('node:fs').writeFileSync(${JSON.stringify(path,)}, ${JSON.stringify(edited,)});
require('node:fs').utimesSync(${JSON.stringify(path,)}, ${String(pinnedSecond,)}, ${String(pinnedSecond,)});
`;
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
export async function pinRacyEdit({
  repository,
  path,
  edited,
}: Readonly<{
  repository: string;
  path: string;
  edited: string;
}>,): Promise<void> {
  /**
   * Absolute file path.
   */
  const filePath = `${repository}/${path}`;
  assertFixtureEqual({
    actual: String(Buffer.byteLength(edited,),),
    expected: String((await readFile(filePath,)).byteLength,),
    context: `racy edit size for ${path}`,
  },);
  /**
   * Cached stat second the edit keeps.
   */
  const pinnedSecond = await pinCachedStat({
    repository,
    path,
  },);
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
    `${repository}/.git/index`,
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
export async function assertEditVisible({
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
