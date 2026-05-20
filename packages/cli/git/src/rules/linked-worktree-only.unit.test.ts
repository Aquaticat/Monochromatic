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
import { linkedWorktreeOnly, } from './linked-worktree-only.ts';

//region Test fixtures

/** Absolute path to real git binary used for fixture setup. */
const realGitPath = await resolveGit();

/** Git author email used in disposable repositories. */
const TEST_USER_EMAIL = 'cli-git@example.invalid';

/** Git author name used in disposable repositories. */
const TEST_USER_NAME = 'cli-git test';

/** Options for running real git commands in tests. */
type RunGitOptions = {
  /** Working directory for subprocess. */
  readonly cwd: string;
  /** Arguments passed after executable name. */
  readonly args: readonly string[];
};

/** Disposable temporary directory used by linked-worktree-only tests. */
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
    'cli-git-linked-worktree-only-',
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
  await runRealGit({
    cwd: repoPath,
    args: [
      'config',
      'user.email',
      TEST_USER_EMAIL,
    ],
  },);
  await runRealGit({
    cwd: repoPath,
    args: [
      'config',
      'user.name',
      TEST_USER_NAME,
    ],
  },);
}

/**
 * Creates initial empty commit in repository.
 *
 * @param repoPath - Repository path to seed.
 *
 * @returns Nothing after initial commit exists.
 *
 * @example
 * ```ts
 * await createInitialCommit({ repoPath: '/tmp/repo' });
 * ```
 */
async function createInitialCommit({
  repoPath,
}: {
  /** Absolute repository root. */
  readonly repoPath: string;
},): Promise<void> {
  await runRealGit({
    cwd: repoPath,
    args: [
      'commit',
      '--allow-empty',
      '--quiet',
      '-m',
      'initial',
    ],
  },);
}

/**
 * Captures asynchronous error from linked-worktree-only invocation.
 *
 * @param args - Git argv to pass through linked-worktree-only rule.
 *
 * @returns Error thrown by rule, or `undefined` when rule passes.
 *
 * @example
 * ```ts
 * const caught = await catchLinkedWorktreeOnlyError(['-C', '/tmp', 'stash']);
 * expect(caught).toBeInstanceOf(Error);
 * ```
 */
async function catchLinkedWorktreeOnlyError(
  args: readonly string[],
): Promise<unknown> {
  try {
    await linkedWorktreeOnly(args,);
  }
  catch (error) {
    return error;
  }
  return undefined;
}

//endregion Test fixtures

await describe({
  name: linkedWorktreeOnly.name,
  children: [
    it({
      name: 'passes through unguarded commands outside a worktree',
      fn: async function testUnguardedOutsideWorktree(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        /** Status argv rooted at directory outside any real worktree. */
        const args = [
          '-C',
          tempDirectory.path,
          'status',
        ] as const;

        expect(await linkedWorktreeOnly(args,),).toBe(args,);
      },
    },),
    it({
      name: 'rejects stash when effective cwd is outside a worktree',
      fn: async function testStashOutsideWorktree(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        /** Error thrown for stash argv rooted at directory outside any real worktree. */
        const caught = await catchLinkedWorktreeOnlyError([
          '-C',
          tempDirectory.path,
          'stash',
          'list',
        ],);

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain(
          'cli-git: git stash requires the effective working directory to be inside a linked git worktree',
        );
      },
    },),
    it({
      name: 'strips escape hatch and skips worktree validation',
      fn: async function testWorktreeEscapeHatch(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        /** Escaped stash argv rooted at directory outside any real worktree. */
        const args = [
          '-C',
          tempDirectory.path,
          'stash',
          '--no-enforce-worktree',
          'list',
        ] as const;

        expect(await linkedWorktreeOnly(args,),).toEqual([
          '-C',
          tempDirectory.path,
          'stash',
          'list',
        ],);
      },
    },),
    it({
      name: 'rejects stash at main worktree root',
      fn: async function testMainWorktreeRoot(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        await initializeRepository({ repoPath: tempDirectory.path, },);

        /** Error thrown for stash argv rooted at main worktree root. */
        const caught = await catchLinkedWorktreeOnlyError([
          '-C',
          tempDirectory.path,
          'stash',
          'list',
        ],);

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain(
          'cli-git: git stash is rejected in the main git worktree',
        );
      },
    },),
    it({
      name: 'rejects stash inside main worktree subdirectory',
      fn: async function testMainWorktreeSubdirectory(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        await initializeRepository({ repoPath: tempDirectory.path, },);
        /** Subdirectory below main worktree root. */
        const subdirectory = join(
          tempDirectory.path,
          'subdir',
        );
        await mkdir(subdirectory,);

        /** Error thrown for stash argv rooted below main worktree root. */
        const caught = await catchLinkedWorktreeOnlyError([
          '-C',
          subdirectory,
          'stash',
          'list',
        ],);

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain(
          'cli-git: git stash is rejected in the main git worktree',
        );
      },
    },),
    it({
      name: 'passes stash at linked worktree root',
      fn: async function testLinkedWorktreeRoot(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        /** Main repository path that owns linked worktree metadata. */
        const repoPath = join(
          tempDirectory.path,
          'repo',
        );
        /** Linked worktree path where stash is allowed. */
        const linkedWorktreePath = join(
          tempDirectory.path,
          'linked',
        );

        await initializeRepository({ repoPath, },);
        await createInitialCommit({ repoPath, },);
        await runRealGit({
          cwd: repoPath,
          args: [
            'worktree',
            'add',
            '--detach',
            '--quiet',
            linkedWorktreePath,
            'HEAD',
          ],
        },);

        /** Stash argv rooted at linked worktree root. */
        const args = [
          '-C',
          linkedWorktreePath,
          'stash',
          'list',
        ] as const;

        expect(await linkedWorktreeOnly(args,),).toBe(args,);
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
        const caught = await catchLinkedWorktreeOnlyError([
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
    it({
      name: 'passes clean dry-run at main worktree root',
      fn: async function testCleanDryRunAtMainWorktreeRoot(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        await initializeRepository({ repoPath: tempDirectory.path, },);

        /** Dry-run clean argv rooted at main worktree root. */
        const args = [
          '-C',
          tempDirectory.path,
          'clean',
          '-ndX',
        ] as const;

        expect(await linkedWorktreeOnly(args,),).toBe(args,);
      },
    },),
    it({
      name: 'rejects state-changing clean at main worktree root',
      fn: async function testStateChangingCleanAtMainWorktreeRoot(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        await initializeRepository({ repoPath: tempDirectory.path, },);

        /** Error thrown for non-dry-run clean argv rooted at main worktree root. */
        const caught = await catchLinkedWorktreeOnlyError([
          '-C',
          tempDirectory.path,
          'clean',
          '-fd',
        ],);

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain(
          'cli-git: state-changing git clean is rejected in the main git worktree',
        );
      },
    },),
    it({
      name: 'strips clean escape hatch and skips worktree validation',
      fn: async function testCleanEscapeHatch(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        /** Escaped clean argv rooted at directory outside any real worktree. */
        const args = [
          '-C',
          tempDirectory.path,
          'clean',
          '--no-enforce-worktree',
          '-fd',
        ] as const;

        expect(await linkedWorktreeOnly(args,),).toEqual([
          '-C',
          tempDirectory.path,
          'clean',
          '-fd',
        ],);
      },
    },),
    it({
      name: 'rejects destructive reset modes at main worktree root',
      fn: async function testDestructiveResetModesAtMainWorktreeRoot(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        await initializeRepository({ repoPath: tempDirectory.path, },);
        await createInitialCommit({ repoPath: tempDirectory.path, },);

        /** Reset modes that update worktree files. */
        const resetModes = [
          '--hard',
          '--merge',
          '--keep',
        ] as const;
        /** Errors thrown for destructive reset modes rooted at main worktree root. */
        const caughtErrors = await Promise.all(
          resetModes.map(async function catchResetModeError(mode,): Promise<unknown> {
            return catchLinkedWorktreeOnlyError([
              '-C',
              tempDirectory.path,
              'reset',
              mode,
            ],);
          },),
        );

        caughtErrors.forEach(function expectResetError(caught,): void {
          expect(caught,).toBeInstanceOf(Error,);
          expect((caught as Error).message,).toContain(
            'cli-git: destructive git reset modes are rejected in the main git worktree',
          );
        },);
      },
    },),
    it({
      name: 'passes non-destructive reset forms at main worktree root',
      fn: async function testNonDestructiveResetFormsAtMainWorktreeRoot(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        await initializeRepository({ repoPath: tempDirectory.path, },);
        await createInitialCommit({ repoPath: tempDirectory.path, },);

        /** Mixed reset changes index but not worktree files. */
        const mixedArgs = [
          '-C',
          tempDirectory.path,
          'reset',
          '--mixed',
        ] as const;
        /** Pathspec separator makes `--hard` path text instead of reset mode. */
        const pathspecArgs = [
          '-C',
          tempDirectory.path,
          'reset',
          '--',
          '--hard',
        ] as const;

        expect(await linkedWorktreeOnly(mixedArgs,),).toBe(mixedArgs,);
        expect(await linkedWorktreeOnly(pathspecArgs,),).toBe(pathspecArgs,);
      },
    },),
    it({
      name: 'strips destructive reset escape hatch and skips worktree validation',
      fn: async function testResetEscapeHatch(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        /** Escaped reset argv rooted at directory outside any real worktree. */
        const args = [
          '-C',
          tempDirectory.path,
          'reset',
          '--no-enforce-worktree',
          '--hard',
        ] as const;

        expect(await linkedWorktreeOnly(args,),).toEqual([
          '-C',
          tempDirectory.path,
          'reset',
          '--hard',
        ],);
      },
    },),
    it({
      name: 'passes clean and destructive reset at linked worktree root',
      fn: async function testCleanAndResetAtLinkedWorktreeRoot(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        /** Main repository path that owns linked worktree metadata. */
        const repoPath = join(
          tempDirectory.path,
          'repo',
        );
        /** Linked worktree path where guarded worktree commands are allowed. */
        const linkedWorktreePath = join(
          tempDirectory.path,
          'linked',
        );

        await initializeRepository({ repoPath, },);
        await createInitialCommit({ repoPath, },);
        await runRealGit({
          cwd: repoPath,
          args: [
            'worktree',
            'add',
            '--detach',
            '--quiet',
            linkedWorktreePath,
            'HEAD',
          ],
        },);

        /** State-changing clean argv rooted at linked worktree root. */
        const cleanArgs = [
          '-C',
          linkedWorktreePath,
          'clean',
          '-fd',
        ] as const;
        /** Destructive reset argv rooted at linked worktree root. */
        const resetArgs = [
          '-C',
          linkedWorktreePath,
          'reset',
          '--hard',
        ] as const;

        expect(await linkedWorktreeOnly(cleanArgs,),).toBe(cleanArgs,);
        expect(await linkedWorktreeOnly(resetArgs,),).toBe(resetArgs,);
      },
    },),
  ],
},);
