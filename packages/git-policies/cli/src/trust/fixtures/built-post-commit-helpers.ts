/**
 * Packed post-commit Git fixture helpers. @module
 */
import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import { execute, } from './built-consumer-helpers.ts';

/**
 * Initializes disposable repository with main branch and identity.
 *
 * @param path - repository root
 *
 * @example
 * ```ts
 * await initializePostCommitRepository('/work/repo');
 * ```
 */
export async function initializePostCommitRepository(path: string,): Promise<void> {
  await mkdir(path,);
  await execute({
    command: '/usr/bin/git',
    args: [
      'init',
      '--quiet',
      '--initial-branch=main',
    ],
    cwd: path,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'config',
      'user.email',
      'cli-git@example.invalid',
    ],
    cwd: path,
  },);
  await execute({
    command: '/usr/bin/git',
    args: [
      'config',
      'user.name',
      'cli-git fixture',
    ],
    cwd: path,
  },);
}

/**
 * Initializes disposable bare remote.
 *
 * @param path - bare repository path
 *
 * @example
 * ```ts
 * await initializeBareRemote('/work/origin.git');
 * ```
 */
export async function initializeBareRemote(path: string,): Promise<void> {
  await mkdir(path,);
  await execute({
    command: '/usr/bin/git',
    args: [
      'init',
      '--bare',
      '--quiet',
      '--initial-branch=main',
    ],
    cwd: path,
  },);
}

/**
 * Writes and stages one path with real Git.
 *
 * @param repository - worktree root
 *
 * @param path - repository-relative file
 *
 * @param contents - exact text contents
 *
 * @example
 * ```ts
 * await writeAndStageReal({ repository: '/work/repo', path: 'file.txt', contents: 'text' });
 * ```
 */
export async function writeAndStageReal({
  repository,
  path,
  contents,
}: Readonly<{
  repository: string;
  path: string;
  contents: string;
}>,): Promise<void> {
  await writeFile(
    `${repository}/${path}`,
    contents,
  );
  await execute({
    command: '/usr/bin/git',
    args: [
      'add',
      path,
    ],
    cwd: repository,
  },);
}

/**
 * Resolves exact local or bare ref OID.
 *
 * @param repository - worktree or bare repository path
 *
 * @param revision - revision to resolve
 *
 * @returns exact object ID
 *
 * @example
 * ```ts
 * await resolveFixtureOid({ repository: '/work/repo' });
 * ```
 */
export async function resolveFixtureOid({
  repository,
  revision = 'HEAD',
}: Readonly<{
  repository: string;
  revision?: string;
}>,): Promise<string> {
  /**
   * Captured rev-parse result.
   */
  const result = await execute({
    command: '/usr/bin/git',
    args: [
      'rev-parse',
      '--verify',
      revision,
    ],
    cwd: repository,
  },);
  return result.stdout
    .trim();
}

/**
 * Asserts exact fixture value equality.
 *
 * @param actual - observed value
 *
 * @param expected - required value
 *
 * @param context - failure label
 *
 * @example
 * ```ts
 * assertFixtureEqual({ actual: 'a', expected: 'a', context: 'sample' });
 * ```
 */
export function assertFixtureEqual({
  actual,
  expected,
  context,
}: Readonly<{
  actual: string;
  expected: string;
  context: string;
}>,): void {
  if (actual !== expected)
    throw new Error(`${context}: expected ${expected}, got ${actual}`,);
}
