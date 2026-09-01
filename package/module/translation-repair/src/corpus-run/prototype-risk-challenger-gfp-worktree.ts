// PROTOTYPE ONLY: Disposable detached worktree for Candidate M GFP.

import {
  lstat,
  mkdir,
  mkdtemp,
  rm,
  symlink,
} from 'node:fs/promises';
import { homedir, } from 'node:os';
import {
  join,
  resolve,
} from 'node:path';

import { runCandidateMGfpCommand, } from './prototype-risk-challenger-gfp-process.ts';

/**
 * Prototype repository root derived from package-scoped mise working directory.
 */
const REPOSITORY_ROOT = resolve(
  process.cwd(),
  '../../..',
);
/**
 * Existing dependency roots linked into each disposable worktree.
 */
const DEPENDENCY_DIRECTORIES = [
  'node_modules',
  'package/config/oxlint/node_modules',
  'package/dev-script/task-util/node_modules',
  'package/module/translation-repair/node_modules',
] as const;

/**
 * Whether dependency path already exists after worktree setup.
 *
 * @param path - Candidate dependency path
 *
 * @returns Whether path already exists
 */
async function pathExists(path: string,): Promise<boolean> {
  try {
    await lstat(path,);
    return true;
  }
  catch (error) {
    if (Error.isError(error,) && ('code' in error)
      && (error.code === 'ENOENT'))
      return false;
    throw error;
  }
}

/**
 * Disposable detached worktree containing one mutation.
 *
 * @example
 * ```ts
 * await using fixture = await createCandidateMGfpFixture();
 * ```
 */
export type CandidateMGfpFixture = AsyncDisposable & {
  /**
   * Detached disposable worktree root.
   */
  readonly root: string;
};

/**
 * Removes one detached disposable worktree and private parent.
 *
 * @param parent - Private temporary parent
 *
 * @param root - Detached worktree root
 *
 */
async function removeFixture({
  parent,
  root,
}: {
  readonly parent: string;
  readonly root: string;
}): Promise<void> {
  /**
   * Worktree removal command outcome.
   */
  const removal = await runCandidateMGfpCommand({
    command: 'git',
    arguments_: [
      '-C',
      REPOSITORY_ROOT,
      'worktree',
      'remove',
      '--force',
      root,
    ],
    cwd: REPOSITORY_ROOT,
  },);
  await rm(
    parent,
    {
      recursive: true,
      force: true,
    },
  );
  if ((removal.kind !== 'exited') || (removal.status !== 0))
    throw new Error('Candidate M GFP worktree removal failed');
}

/**
 * Creates one private detached worktree with existing dependency links.
 *
 * @returns Disposable worktree isolated from publication worktree mutations
 *
 * @throws Error when fixture creation or dependency linking fails
 *
 * @example
 * ```ts
 * await using fixture = await createCandidateMGfpFixture();
 * ```
 */
export async function createCandidateMGfpFixture(): Promise<CandidateMGfpFixture> {
  /**
   * Private parent created with current restrictive process umask.
   */
  const parent = await mkdtemp(join(
    homedir(),
    'temp',
    'agent',
    'candidate-m-gfp-',
  ),);
  /**
   * Absent path where Git creates detached worktree.
   */
  const root = join(
    parent,
    'worktree',
  );
  /**
   * Worktree creation command outcome.
   */
  const addition = await runCandidateMGfpCommand({
    command: 'git',
    arguments_: [
      '-C',
      REPOSITORY_ROOT,
      'worktree',
      'add',
      '--detach',
      root,
      'HEAD',
    ],
    cwd: REPOSITORY_ROOT,
  },);
  if ((addition.kind !== 'exited') || (addition.status !== 0)) {
    await rm(
      parent,
      {
        recursive: true,
        force: true,
      },
    );
    throw new Error('Candidate M GFP worktree creation failed');
  }
  try {
    await Promise.all(DEPENDENCY_DIRECTORIES.map(async function linkDependency(relativePath,) {
      /**
       * Dependency-link destination in disposable worktree.
       */
      const destination = resolve(
        root,
        relativePath,
      );
      if (await pathExists(destination,))
        return;
      await mkdir(
        resolve(
          destination,
          '..',
        ),
        { recursive: true, },
      );
      await symlink(
        resolve(
          REPOSITORY_ROOT,
          relativePath,
        ),
        destination,
        'dir',
      );
    },),);
  }
  catch (error) {
    await removeFixture({
      parent,
      root,
    },);
    throw error;
  }
  return {
    root,
    async [Symbol.asyncDispose](): Promise<void> {
      await removeFixture({
        parent,
        root,
      },);
    },
  };
}
