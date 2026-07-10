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
} from '@monochromatic-dev/module-test/ts';

import { requireRoot, } from './require-root.ts';

/** Disposable temporary directory used by require-root tests. */
type TempDirectory = {
  /** Absolute path to temporary directory. */
  readonly path: string;
  /** Deletes temporary directory after test exits. */
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};

/**
 * Creates disposable temporary directory for repository-shape fixtures.
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
    'cli-git-require-root-',
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
 * Creates minimum valid Git administrative directory structure.
 *
 * @param gitDirectory - administrative directory path
 *
 * @example
 * ```ts
 * await createValidGitDirectory({ gitDirectory: '/repo/.git' });
 * ```
 */
async function createValidGitDirectory({
  gitDirectory,
}: {
  readonly gitDirectory: string;
},): Promise<void> {
  await Promise.all([
    mkdir(
      join(
        gitDirectory,
        'objects',
      ),
      { recursive: true, },
    ),
    mkdir(
      join(
        gitDirectory,
        'refs',
      ),
      { recursive: true, },
    ),
  ],);
  await writeFile(
    join(
      gitDirectory,
      'HEAD',
    ),
    'ref: refs/heads/main\n',
  );
}

/**
 * Creates a valid relative gitfile marker and target.
 *
 * @param repositoryRoot - worktree root receiving marker
 *
 * @example
 * ```ts
 * await createValidGitFile({ repositoryRoot: '/repo' });
 * ```
 */
async function createValidGitFile({
  repositoryRoot,
}: {
  readonly repositoryRoot: string;
},): Promise<void> {
  /** Administrative directory targeted by gitfile. */
  const gitDirectory = join(
    repositoryRoot,
    '.git-target',
  );
  await createValidGitDirectory({ gitDirectory, },);
  await writeFile(
    join(
      repositoryRoot,
      '.git',
    ),
    'gitdir: .git-target\n',
  );
}

/**
 * Captures asynchronous error from require-root invocation.
 *
 * @param args - Git argv to pass through require-root rule.
 *
 * @returns Error thrown by rule, or `undefined` when rule passes.
 *
 * @example
 * ```ts
 * const caught = await catchRequireRootError(['-C', '/repo/sub', 'status']);
 * expect(caught).toBeInstanceOf(Error);
 * ```
 */
async function catchRequireRootError(args: readonly string[],): Promise<unknown> {
  try {
    await requireRoot(args,);
  }
  catch (error) {
    return error;
  }
  return undefined;
}

await describe({
  name: requireRoot.name,
  children: [
    it({
      name: 'passes through when effective cwd is outside a repository',
      fn: async function testOutsideRepository(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        /** Status argv rooted at directory with no `.git` ancestor. */
        const args = [
          '-C',
          tempDirectory.path,
          'status',
        ] as const;

        expect(await requireRoot(args,),).toBe(args,);
      },
    },),
    it({
      name: 'passes at repository root when .git is a directory',
      fn: async function testGitDirectoryAtRoot(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        await createValidGitDirectory({
          gitDirectory: join(
            tempDirectory.path,
            '.git',
          ),
        },);

        /** Status argv rooted at normal repository root. */
        const args = [
          '-C',
          tempDirectory.path,
          'status',
        ] as const;

        expect(await requireRoot(args,),).toBe(args,);
      },
    },),
    it({
      name: 'rejects subdirectory below repository root when .git is a directory',
      fn: async function testGitDirectorySubdirectory(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        await createValidGitDirectory({
          gitDirectory: join(
            tempDirectory.path,
            '.git',
          ),
        },);
        /** Subdirectory below normal repository root. */
        const subdirectory = join(
          tempDirectory.path,
          'subdir',
        );
        await mkdir(subdirectory,);

        /** Error thrown for non-root effective cwd. */
        const caught = await catchRequireRootError([
          '-C',
          subdirectory,
          'status',
        ],);

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain(
          `Repo root is ${tempDirectory.path}`,
        );
      },
    },),
    it({
      name: 'passes at repository root when .git is a file',
      fn: async function testGitFileAtRoot(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        await createValidGitFile({ repositoryRoot: tempDirectory.path, },);

        /** Status argv rooted at linked-worktree-style repository root. */
        const args = [
          '-C',
          tempDirectory.path,
          'status',
        ] as const;

        expect(await requireRoot(args,),).toBe(args,);
      },
    },),
    it({
      name: 'rejects subdirectory below repository root when .git is a file',
      fn: async function testGitFileSubdirectory(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        await createValidGitFile({ repositoryRoot: tempDirectory.path, },);
        /** Subdirectory below linked-worktree-style repository root. */
        const subdirectory = join(
          tempDirectory.path,
          'subdir',
        );
        await mkdir(subdirectory,);

        /** Error thrown for non-root effective cwd. */
        const caught = await catchRequireRootError([
          '-C',
          subdirectory,
          'status',
        ],);

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain(
          `Repo root is ${tempDirectory.path}`,
        );
      },
    },),
    it({
      name: 'passes through below an invalid empty .git ancestor',
      fn: async function testInvalidGitDirectoryAncestor(): Promise<void> {
        await using tempDirectory = await createTempDirectory();
        await mkdir(join(
          tempDirectory.path,
          '.git',
        ),);
        /** Nested directory below invalid marker. */
        const subdirectory = join(
          tempDirectory.path,
          'subdir',
        );
        await mkdir(subdirectory,);
        /** Status argv that invalid ancestor must not affect. */
        const args = [
          '-C',
          subdirectory,
          'status',
        ] as const;
        expect(await requireRoot(args,),).toBe(args,);
      },
    },),
    it({
      name: 'passes through below a malformed gitfile ancestor',
      fn: async function testMalformedGitFileAncestor(): Promise<void> {
        await using tempDirectory = await createTempDirectory();
        await writeFile(
          join(
            tempDirectory.path,
            '.git',
          ),
          'git-dir: missing\n',
        );
        /** Nested directory below malformed marker. */
        const subdirectory = join(
          tempDirectory.path,
          'subdir',
        );
        await mkdir(subdirectory,);
        /** Status argv that malformed ancestor must not affect. */
        const args = [
          '-C',
          subdirectory,
          'status',
        ] as const;
        expect(await requireRoot(args,),).toBe(args,);
      },
    },),
    it({
      name: 'exempts clone even inside repository subdirectory',
      fn: async function testCloneExemption(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        await createValidGitDirectory({
          gitDirectory: join(
            tempDirectory.path,
            '.git',
          ),
        },);
        /** Subdirectory below repository root. */
        const subdirectory = join(
          tempDirectory.path,
          'subdir',
        );
        await mkdir(subdirectory,);

        /** Clone argv that is exempt from root check. */
        const args = [
          '-C',
          subdirectory,
          'clone',
          'https://example.invalid/repo.git',
        ] as const;

        expect(await requireRoot(args,),).toBe(args,);
      },
    },),
    it({
      name: 'exempts config --global inside repository subdirectory',
      fn: async function testGlobalConfigExemption(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        await createValidGitDirectory({
          gitDirectory: join(
            tempDirectory.path,
            '.git',
          ),
        },);
        /** Subdirectory below repository root. */
        const subdirectory = join(
          tempDirectory.path,
          'subdir',
        );
        await mkdir(subdirectory,);

        /** Global config argv that is exempt from root check. */
        const args = [
          '-C',
          subdirectory,
          'config',
          '--global',
          'user.name',
        ] as const;

        expect(await requireRoot(args,),).toBe(args,);
      },
    },),
  ],
},);
