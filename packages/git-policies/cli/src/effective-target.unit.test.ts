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
} from '@monochromatic-dev/module-test/ts';
import nanoSpawn from 'nano-spawn';

import { classifyEffectiveTarget, } from './effective-target.ts';
import { resolveGit, } from './resolve-git.ts';

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

/** Disposable temporary directory used by effective-target tests. */
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
    'cli-git-effective-target-',
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

//endregion Test fixtures

await describe({
  name: classifyEffectiveTarget.name,
  children: [
    it({
      name: 'classifies a main worktree under an allowed directory as allowlisted',
      fn: async function testMainWorktreeAllowlisted(): Promise<void> {
        await using tempDirectory = await createTempDirectory();
        await initializeRepository({ repoPath: tempDirectory.path, },);

        expect(
          await classifyEffectiveTarget({
            preSubcommandArgs: [],
            effectiveCwd: tempDirectory.path,
            allowedWorktreeDirs: [tempDirectory.path,],
          },),
        ).toBe('allowlisted',);
      },
    },),
    it({
      name: 'classifies a main worktree outside allowed directories as main-worktree',
      fn: async function testMainWorktreeNotAllowlisted(): Promise<void> {
        await using tempDirectory = await createTempDirectory();
        await initializeRepository({ repoPath: tempDirectory.path, },);
        /** Existing allowed directory that does not contain the repo's git-dir. */
        const unrelated = join(
          tempDirectory.path,
          'unrelated',
        );
        await runRealGit({
          cwd: tempDirectory.path,
          args: [
            'init',
            '--quiet',
            unrelated,
          ],
        },);

        expect(
          await classifyEffectiveTarget({
            preSubcommandArgs: [],
            effectiveCwd: tempDirectory.path,
            allowedWorktreeDirs: [unrelated,],
          },),
        ).toBe('main-worktree',);
      },
    },),
    it({
      name: 'does not allowlist an arbitrary repo under the baked-in default list',
      fn: async function testDefaultListDoesNotOvermatch(): Promise<void> {
        await using tempDirectory = await createTempDirectory();
        await initializeRepository({ repoPath: tempDirectory.path, },);

        // No allowedWorktreeDirs override: exercises DEFAULT_ALLOWED_WORKTREE_DIRS
        // and confirms a temp repo outside any tool cache is still main-worktree.
        expect(
          await classifyEffectiveTarget({
            preSubcommandArgs: [],
            effectiveCwd: tempDirectory.path,
          },),
        ).toBe('main-worktree',);
      },
    },),
    it({
      name: 'classifies a linked worktree under an allowed directory as allowlisted',
      fn: async function testLinkedWorktreeAllowlisted(): Promise<void> {
        await using tempDirectory = await createTempDirectory();
        /** Main repository path that owns linked worktree metadata. */
        const repoPath = join(
          tempDirectory.path,
          'repo',
        );
        /** Linked worktree path nested under the allowed temp root. */
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

        expect(
          await classifyEffectiveTarget({
            preSubcommandArgs: [],
            effectiveCwd: linkedWorktreePath,
            allowedWorktreeDirs: [tempDirectory.path,],
          },),
        ).toBe('allowlisted',);
      },
    },),
    it({
      name: 'leaves an outside-worktree directory unrescued even when allowlisted',
      fn: async function testOutsideWorktreeNotRescued(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        // No repository initialized: the effective cwd is outside any worktree,
        // so there is no git-dir to match and the allowlist does not apply.
        expect(
          await classifyEffectiveTarget({
            preSubcommandArgs: [],
            effectiveCwd: tempDirectory.path,
            allowedWorktreeDirs: [tempDirectory.path,],
          },),
        ).toBe('outside-worktree',);
      },
    },),
  ],
},);
