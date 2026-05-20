import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';
import nanoSpawn, {
  type Result,
  SubprocessError,
} from 'nano-spawn';

import { resolveGit, } from './resolve-git.ts';

/** Absolute path to real git binary used for fixture setup and assertions. */
const realGitPath = await resolveGit();

/** Absolute path to cli-git entry point under test. */
const WRAPPER_PATH = join(
  import.meta.dirname,
  'index.ts',
);

/** Git author email used in disposable repositories. */
const TEST_USER_EMAIL = 'cli-git@example.invalid';

/** Git author name used in disposable repositories. */
const TEST_USER_NAME = 'cli-git test';

/** Options for running git-like commands in tests. */
type RunGitOptions = {
  /** Working directory for subprocess. */
  readonly cwd: string;
  /** Arguments passed after executable name. */
  readonly args: readonly string[];
};

/** Disposable temporary directory used by CLI integration tests. */
type TempDirectory = {
  /** Absolute path to temporary directory. */
  readonly path: string;
  /** Deletes temporary directory after test exits. */
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};

/**
 * Creates disposable temporary directory for git repositories.
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
    'cli-git-index-',
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
 * Runs real git binary, bypassing wrapper under test.
 *
 * @param options - Working directory and git argv.
 *
 * @returns Captured subprocess result.
 *
 * @example
 * ```ts
 * await runRealGit({ cwd: '/repo', args: ['status', '--short'] });
 * ```
 */
async function runRealGit(options: RunGitOptions,): Promise<Result> {
  return nanoSpawn(
    realGitPath,
    options.args,
    { cwd: options.cwd, },
  );
}

/**
 * Runs cli-git entry point through Bun.
 *
 * @param options - Working directory and git argv.
 *
 * @returns Captured subprocess result.
 *
 * @example
 * ```ts
 * await runWrapper({ cwd: '/repo', args: ['status', '--short'] });
 * ```
 */
async function runWrapper(options: RunGitOptions,): Promise<Result> {
  return nanoSpawn(
    'bun',
    [
      WRAPPER_PATH,
      ...options.args,
    ],
    { cwd: options.cwd, },
  );
}

/**
 * Captures cli-git subprocess failure.
 *
 * @param options - Working directory and git argv.
 *
 * @returns Subprocess failure, or `undefined` when invocation succeeds.
 *
 * @example
 * ```ts
 * const error = await catchWrapperError({ cwd: '/repo', args: ['status'] });
 * expect(error).toBeInstanceOf(SubprocessError);
 * ```
 */
async function catchWrapperError(
  options: RunGitOptions,
): Promise<SubprocessError | undefined> {
  try {
    await runWrapper(options,);
  }
  catch (error) {
    if (error instanceof SubprocessError)
      return error;
    throw error;
  }
  return undefined;
}

/**
 * Narrows optional subprocess error after expectation assertion.
 *
 * @param error - Optional subprocess error returned by catch helper.
 *
 * @returns Subprocess error when present.
 *
 * @throws When subprocess unexpectedly succeeded.
 *
 * @example
 * ```ts
 * const error = requireSubprocessError(await catchWrapperError(options));
 * console.log(error.stderr);
 * ```
 */
function requireSubprocessError(error: SubprocessError | undefined,): SubprocessError {
  expect(error,).toBeInstanceOf(SubprocessError,);

  if (error === undefined)
    throw new Error('Expected cli-git subprocess to fail.',);

  return error;
}

/**
 * Initializes disposable git repository and configures commit identity.
 *
 * @param options - Repository path to create and initialize.
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
  /** Absolute path to repository root. */
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
 * Writes file and stages it with real git.
 *
 * @param options - Repository path, relative file name, and file content.
 *
 * @returns Nothing after file is staged.
 *
 * @example
 * ```ts
 * await writeAndStageFile({ repoPath: '/repo', fileName: 'file.txt', content: 'x\n' });
 * ```
 */
async function writeAndStageFile({
  repoPath,
  fileName,
  content,
}: {
  /** Absolute repository root. */
  readonly repoPath: string;
  /** Repository-relative file name. */
  readonly fileName: string;
  /** File content to write. */
  readonly content: string;
},): Promise<void> {
  await writeFile(
    join(
      repoPath,
      fileName,
    ),
    content,
  );
  await runRealGit({
    cwd: repoPath,
    args: [
      'add',
      fileName,
    ],
  },);
}

/**
 * Creates initial commit in repository.
 *
 * @param options - Repository path to seed.
 *
 * @returns Nothing after initial commit exists.
 *
 * @example
 * ```ts
 * await createInitialCommit({ repoPath: '/repo' });
 * ```
 */
async function createInitialCommit({
  repoPath,
}: {
  /** Absolute repository root. */
  readonly repoPath: string;
},): Promise<void> {
  await writeAndStageFile({
    repoPath,
    fileName: 'tracked.txt',
    content: 'initial\n',
  },);
  await runRealGit({
    cwd: repoPath,
    args: [
      'commit',
      '--quiet',
      '-m',
      'initial',
    ],
  },);
}

/**
 * Reads latest commit subject from repository.
 *
 * @param options - Repository path to inspect.
 *
 * @returns Latest commit subject.
 *
 * @example
 * ```ts
 * const subject = await readLatestSubject({ repoPath: '/repo' });
 * ```
 */
async function readLatestSubject({
  repoPath,
}: {
  /** Absolute repository root. */
  readonly repoPath: string;
},): Promise<string> {
  /** Git log result containing latest subject on stdout. */
  const result = await runRealGit({
    cwd: repoPath,
    args: [
      'log',
      '-1',
      '--format=%s',
    ],
  },);

  return result.stdout;
}

await describe({
  name: 'cli-git entry point',
  children: [
    it({
      name: 'prints wrapper diagnostic for pathless commit before git fatal',
      fn: async function testPathlessCommitDiagnostic(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        await initializeRepository({ repoPath: tempDirectory.path, },);
        await writeAndStageFile({
          repoPath: tempDirectory.path,
          fileName: 'file.txt',
          content: 'content\n',
        },);

        /** cli-git failure for commit without pathspec. */
        const error = requireSubprocessError(await catchWrapperError({
          cwd: tempDirectory.path,
          args: [
            'commit',
            '-m',
            'pathless',
          ],
        },),);

        expect(error.stderr,).toContain(
          'cli-git: git commit requires an explicit pathspec',
        );
        expect(error.stderr,).not.toContain('No paths with --include/--only',);
      },
    },),
    it({
      name: 'commits named path through wrapper-injected only mode',
      fn: async function testNamedPathCommit(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        await initializeRepository({ repoPath: tempDirectory.path, },);
        await writeAndStageFile({
          repoPath: tempDirectory.path,
          fileName: 'file.txt',
          content: 'content\n',
        },);

        await runWrapper({
          cwd: tempDirectory.path,
          args: [
            'commit',
            '-m',
            'named path',
            'file.txt',
          ],
        },);

        expect(await readLatestSubject({ repoPath: tempDirectory.path, },),).toBe(
          'named path',
        );
      },
    },),
    it({
      name: 'rejects stash list at main worktree root',
      fn: async function testStashListAtMainWorktreeRoot(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        await initializeRepository({ repoPath: tempDirectory.path, },);

        /** cli-git failure for read-only stash list inside main worktree. */
        const error = requireSubprocessError(await catchWrapperError({
          cwd: tempDirectory.path,
          args: [
            'stash',
            'list',
          ],
        },),);

        expect(error.stderr,).toContain(
          'cli-git: git stash is rejected in the main git worktree',
        );
      },
    },),
    it({
      name: 'allows stash list at main worktree root with worktree escape hatch',
      fn: async function testStashListAtMainWorktreeRootWithEscapeHatch(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        await initializeRepository({ repoPath: tempDirectory.path, },);

        /** cli-git success proves wrapper stripped the unknown-to-git escape hatch. */
        const result = await runWrapper({
          cwd: tempDirectory.path,
          args: [
            'stash',
            '--no-enforce-worktree',
            'list',
          ],
        },);

        expect(result.stdout,).toBe('',);
      },
    },),
    it({
      name: 'allows stash list at linked worktree root',
      fn: async function testStashListAtLinkedWorktreeRoot(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        /** Main repository path that owns linked worktree metadata. */
        const repoPath = join(
          tempDirectory.path,
          'repo',
        );
        /** Linked worktree path where stash remains allowed. */
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

        /** cli-git success for read-only stash list inside linked worktree. */
        const result = await runWrapper({
          cwd: linkedWorktreePath,
          args: [
            'stash',
            'list',
          ],
        },);

        expect(result.stdout,).toBe('',);
      },
    },),
    it({
      name: 'rejects stash with explicit work-tree from unrelated cwd',
      fn: async function testStashWithExplicitWorkTreeOutsideWorktree(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        /** Repository whose worktree would be reverted if stash reached real git. */
        const repoPath = join(
          tempDirectory.path,
          'repo',
        );
        /** Launch directory outside any worktree. */
        const launchPath = join(
          tempDirectory.path,
          'launch',
        );

        await initializeRepository({ repoPath, },);
        await createInitialCommit({ repoPath, },);
        await mkdir(launchPath,);
        await writeFile(
          join(
            repoPath,
            'tracked.txt',
          ),
          'modified\n',
        );

        /** cli-git failure before explicit --work-tree stash can run. */
        const error = requireSubprocessError(await catchWrapperError({
          cwd: launchPath,
          args: [
            '--git-dir',
            join(
              repoPath,
              '.git',
            ),
            '--work-tree',
            repoPath,
            'stash',
            'push',
            '--',
            'tracked.txt',
          ],
        },),);

        expect(error.stderr,).toContain(
          'cli-git: git stash requires the effective working directory to be inside a linked git worktree',
        );

        /** Repository status after rejected stash, proving file contents stayed modified. */
        const status = await runRealGit({
          cwd: repoPath,
          args: [
            'status',
            '--short',
          ],
        },);

        expect(status.stdout,).toContain(' M tracked.txt',);
      },
    },),
    it({
      name: 'allows clean dry-run at main worktree root',
      fn: async function testCleanDryRunAtMainWorktreeRoot(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        await initializeRepository({ repoPath: tempDirectory.path, },);
        await writeFile(
          join(
            tempDirectory.path,
            'untracked.txt',
          ),
          'temporary\n',
        );

        /** cli-git success for dry-run clean inside main worktree. */
        const result = await runWrapper({
          cwd: tempDirectory.path,
          args: [
            'clean',
            '-nd',
          ],
        },);

        expect(result.stdout,).toContain('Would remove untracked.txt',);
      },
    },),
    it({
      name: 'rejects state-changing clean at main worktree root',
      fn: async function testStateChangingCleanAtMainWorktreeRoot(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        await initializeRepository({ repoPath: tempDirectory.path, },);
        await writeFile(
          join(
            tempDirectory.path,
            'untracked.txt',
          ),
          'temporary\n',
        );

        /** cli-git failure for non-dry-run clean inside main worktree. */
        const error = requireSubprocessError(await catchWrapperError({
          cwd: tempDirectory.path,
          args: [
            'clean',
            '-fd',
          ],
        },),);

        expect(error.stderr,).toContain(
          'cli-git: state-changing git clean is rejected in the main git worktree',
        );

        /** Repository status after rejected clean, proving untracked file remains. */
        const status = await runRealGit({
          cwd: tempDirectory.path,
          args: [
            'status',
            '--short',
          ],
        },);

        expect(status.stdout,).toContain('?? untracked.txt',);
      },
    },),
    it({
      name:
        'allows state-changing clean at main worktree root with worktree escape hatch',
      fn: async function testCleanAtMainWorktreeRootWithEscapeHatch(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        await initializeRepository({ repoPath: tempDirectory.path, },);
        await writeFile(
          join(
            tempDirectory.path,
            'untracked.txt',
          ),
          'temporary\n',
        );

        await runWrapper({
          cwd: tempDirectory.path,
          args: [
            'clean',
            '--no-enforce-worktree',
            '-fd',
          ],
        },);

        /** Repository status after escaped clean, proving real git received clean. */
        const status = await runRealGit({
          cwd: tempDirectory.path,
          args: [
            'status',
            '--short',
          ],
        },);

        expect(status.stdout,).toBe('',);
      },
    },),
    it({
      name: 'rejects reset hard at main worktree root',
      fn: async function testResetHardAtMainWorktreeRoot(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        await initializeRepository({ repoPath: tempDirectory.path, },);
        await createInitialCommit({ repoPath: tempDirectory.path, },);
        await writeFile(
          join(
            tempDirectory.path,
            'tracked.txt',
          ),
          'modified\n',
        );

        /** cli-git failure for reset hard inside main worktree. */
        const error = requireSubprocessError(await catchWrapperError({
          cwd: tempDirectory.path,
          args: [
            'reset',
            '--hard',
          ],
        },),);

        expect(error.stderr,).toContain(
          'cli-git: destructive git reset modes are rejected in the main git worktree',
        );

        /** Repository status after rejected reset, proving tracked modification remains. */
        const status = await runRealGit({
          cwd: tempDirectory.path,
          args: [
            'status',
            '--short',
          ],
        },);

        expect(status.stdout,).toContain(' M tracked.txt',);
      },
    },),
    it({
      name: 'allows reset hard at main worktree root with worktree escape hatch',
      fn: async function testResetHardAtMainWorktreeRootWithEscapeHatch(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        await initializeRepository({ repoPath: tempDirectory.path, },);
        await createInitialCommit({ repoPath: tempDirectory.path, },);
        await writeFile(
          join(
            tempDirectory.path,
            'tracked.txt',
          ),
          'modified\n',
        );

        await runWrapper({
          cwd: tempDirectory.path,
          args: [
            'reset',
            '--no-enforce-worktree',
            '--hard',
          ],
        },);

        /** Repository status after escaped reset, proving real git received reset hard. */
        const status = await runRealGit({
          cwd: tempDirectory.path,
          args: [
            'status',
            '--short',
          ],
        },);

        expect(status.stdout,).toBe('',);
      },
    },),
    it({
      name: 'rejects linked worktree subdirectory because .git is a file',
      fn: async function testLinkedWorktreeSubdirectory(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        /** Main repository path inside disposable parent directory. */
        const repoPath = join(
          tempDirectory.path,
          'repo',
        );
        /** Linked worktree path with `.git` file instead of directory. */
        const worktreePath = join(
          tempDirectory.path,
          'worktree',
        );
        /** Subdirectory below linked worktree root. */
        const subdirectory = join(
          worktreePath,
          'subdir',
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
            worktreePath,
            'HEAD',
          ],
        },);
        await mkdir(subdirectory,);

        /** cli-git failure for worktree subdirectory. */
        const error = requireSubprocessError(await catchWrapperError({
          cwd: subdirectory,
          args: [
            'status',
            '--short',
          ],
        },),);

        expect(error.stderr,).toContain(
          'cli-git: not at the root of the git repository',
        );
        expect(error.stderr,).toContain(`Repo root is ${worktreePath}`,);
      },
    },),
  ],
},);
