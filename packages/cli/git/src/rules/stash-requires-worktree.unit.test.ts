import {
  mkdir,
  mkdtemp,
  rm,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';
import nanoSpawn from 'nano-spawn';

import { resolveGit, } from '../resolve-git.ts';
import { stashRequiresWorktree, } from './stash-requires-worktree.ts';

//region Test fixtures

/** Absolute path to real git binary used for fixture setup. */
const realGitPath = await resolveGit();

/** Options for running real git commands in tests. */
type RunGitOptions = {
  /** Working directory for subprocess. */
  readonly cwd: string;
  /** Arguments passed after executable name. */
  readonly args: readonly string[];
};

/** Disposable temporary directory used by stash-requires-worktree tests. */
type TempDirectory = {
  /** Absolute path to temporary directory. */
  readonly path: string;
  /** Deletes temporary directory after test exits. */
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};

/**
 * Creates disposable temporary directory for worktree-shape fixtures.
 *
 * @returns Temporary directory that removes itself when disposed.
 *
 * @example
 * ```ts
 * await using tempDirectory = await createTempDirectory();
 * console.log(tempDirectory.path);
 * ```
 */
async function createTempDirectory(): Promise<TempDirectory> {
  /** Absolute temporary directory path for one test case. */
  const path = await mkdtemp(join(
    tmpdir(),
    'cli-git-stash-requires-worktree-',
  ),);

  return {
    path,
    async [Symbol.asyncDispose](): Promise<void> {
      await rm(
        path,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

/**
 * Runs real git binary for fixture setup.
 *
 * @param options - Working directory and git argv.
 *
 * @returns Nothing after git command succeeds.
 *
 * @example
 * ```ts
 * await runRealGit({ cwd: '/repo', args: ['init', '--quiet'] });
 * ```
 */
async function runRealGit(options: RunGitOptions,): Promise<void> {
  await nanoSpawn(
    realGitPath,
    options.args,
    { cwd: options.cwd, },
  );
}

/**
 * Initializes disposable real git repository.
 *
 * @param repoPath - Repository path to create and initialize.
 *
 * @returns Nothing after repository is initialized.
 *
 * @example
 * ```ts
 * await initializeRepository({ repoPath: '/tmp/repo' });
 * ```
 */
async function initializeRepository({
  repoPath,
}: {
  /** Absolute repository root. */
  readonly repoPath: string;
},): Promise<void> {
  await mkdir(
    repoPath,
    { recursive: true, },
  );
  await runRealGit({
    cwd: repoPath,
    args: [
      'init',
      '--quiet',
    ],
  },);
}

/**
 * Captures asynchronous error from stash-requires-worktree invocation.
 *
 * @param args - Git argv to pass through stash-requires-worktree rule.
 *
 * @returns Error thrown by rule, or `undefined` when rule passes.
 *
 * @example
 * ```ts
 * const caught = await catchStashRequiresWorktreeError(['-C', '/tmp', 'stash']);
 * expect(caught).toBeInstanceOf(Error);
 * ```
 */
async function catchStashRequiresWorktreeError(
  args: readonly string[],
): Promise<unknown> {
  try {
    await stashRequiresWorktree(args,);
  }
  catch (error) {
    return error;
  }
  return undefined;
}

//endregion Test fixtures

await describe({
  name: stashRequiresWorktree.name,
  children: [
    it({
      name: 'passes through non-stash commands outside a worktree',
      fn: async function testNonStashOutsideWorktree(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        /** Status argv rooted at directory outside any real worktree. */
        const args = [
          '-C',
          tempDirectory.path,
          'status',
        ] as const;

        expect(await stashRequiresWorktree(args,),).toBe(args,);
      },
    },),
    it({
      name: 'rejects stash when effective cwd is outside a worktree',
      fn: async function testStashOutsideWorktree(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        /** Error thrown for stash argv rooted at directory outside any real worktree. */
        const caught = await catchStashRequiresWorktreeError([
          '-C',
          tempDirectory.path,
          'stash',
          'list',
        ],);

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain(
          'cli-git: git stash requires the effective working directory to be inside a git worktree',
        );
      },
    },),
    it({
      name: 'passes stash at worktree root when .git is a directory',
      fn: async function testGitDirectoryWorktreeRoot(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        await initializeRepository({ repoPath: tempDirectory.path, },);

        /** Stash argv rooted at real worktree root. */
        const args = [
          '-C',
          tempDirectory.path,
          'stash',
          'list',
        ] as const;

        expect(await stashRequiresWorktree(args,),).toBe(args,);
      },
    },),
    it({
      name: 'passes stash inside real worktree subdirectory',
      fn: async function testRealWorktreeSubdirectory(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        await initializeRepository({ repoPath: tempDirectory.path, },);
        /** Subdirectory below real worktree root. */
        const subdirectory = join(
          tempDirectory.path,
          'subdir',
        );
        await mkdir(subdirectory,);

        /** Stash argv rooted below real worktree root. */
        const args = [
          '-C',
          subdirectory,
          'stash',
          'list',
        ] as const;

        expect(await stashRequiresWorktree(args,),).toBe(args,);
      },
    },),
    it({
      name: 'rejects explicit git-dir and work-tree stash from unrelated cwd',
      fn: async function testExplicitWorkTreeOutsideWorktree(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        /** Repository referenced by explicit git global options. */
        const repoPath = join(
          tempDirectory.path,
          'repo',
        );
        /** Unrelated launch directory that is not inside any worktree. */
        const launchPath = join(
          tempDirectory.path,
          'launch',
        );
        await initializeRepository({ repoPath, },);
        await mkdir(launchPath,);

        /** Error thrown because `-C` leaves effective cwd outside worktree. */
        const caught = await catchStashRequiresWorktreeError([
          '-C',
          launchPath,
          '--git-dir',
          join(
            repoPath,
            '.git',
          ),
          '--work-tree',
          repoPath,
          'stash',
          'push',
        ],);

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain(
          'Refusing to run from outside a worktree because git stash can revert filesystem state outside what the caller expected',
        );
      },
    },),
  ],
},);
