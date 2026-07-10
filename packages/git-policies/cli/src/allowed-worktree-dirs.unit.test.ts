import {
  mkdir,
  mkdtemp,
  realpath,
  rm,
  symlink,
} from 'node:fs/promises';
import {
  homedir,
  tmpdir,
} from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  isAllowedWorktreeDir,
  isPathUnder,
  resolveUvCacheDir,
} from './allowed-worktree-dirs.ts';

//region Test fixtures

/** Disposable temporary directory used by allowed-worktree-dirs tests. */
type TempDirectory = {
  /** Absolute path to temporary directory. */
  readonly path: string;
  /** Deletes temporary directory after test exits. */
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};

/**
 * Creates disposable temporary directory for allowlist fixtures.
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
    'cli-git-allowed-worktree-dirs-',
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

//endregion Test fixtures

await describe({
  name: resolveUvCacheDir.name,
  children: [
    it({
      name: 'returns UV_CACHE_DIR when set to a non-empty value',
      fn: async function testUvCacheDirOverride(): Promise<void> {
        expect(
          resolveUvCacheDir({
            env: {
              UV_CACHE_DIR: '/custom/uv-cache',
              XDG_CACHE_HOME: '/ignored',
            },
          },),
        ).toBe('/custom/uv-cache',);
      },
    },),
    it({
      name: 'derives the cache from XDG_CACHE_HOME when UV_CACHE_DIR is unset',
      fn: async function testXdgCacheHome(): Promise<void> {
        expect(
          resolveUvCacheDir({ env: { XDG_CACHE_HOME: '/custom/xdg', }, },),
        ).toBe(join(
          '/custom/xdg',
          'uv',
        ),);
      },
    },),
    it({
      name: 'falls back to ~/.cache/uv when no cache env is set',
      fn: async function testHomeFallback(): Promise<void> {
        expect(
          resolveUvCacheDir({ env: {}, },),
        ).toBe(join(
          homedir(),
          '.cache',
          'uv',
        ),);
      },
    },),
    it({
      name: 'treats an empty UV_CACHE_DIR as unset',
      fn: async function testEmptyUvCacheDir(): Promise<void> {
        expect(
          resolveUvCacheDir({ env: { UV_CACHE_DIR: '', }, },),
        ).toBe(join(
          homedir(),
          '.cache',
          'uv',
        ),);
      },
    },),
  ],
},);

await describe({
  name: isPathUnder.name,
  children: [
    it({
      name: 'reports a direct child as under the parent',
      fn: async function testDirectChild(): Promise<void> {
        expect(isPathUnder({
          parent: '/a/b',
          child: '/a/b/c',
        },),).toBe(true,);
      },
    },),
    it({
      name: 'reports a deep descendant as under the parent',
      fn: async function testDeepDescendant(): Promise<void> {
        expect(isPathUnder({
          parent: '/a/b',
          child: '/a/b/c/d/e',
        },),).toBe(true,);
      },
    },),
    it({
      name: 'reports an identical path as under the parent',
      fn: async function testIdenticalPath(): Promise<void> {
        expect(isPathUnder({
          parent: '/a/b',
          child: '/a/b',
        },),).toBe(true,);
      },
    },),
    it({
      name: 'rejects a sibling that shares a name prefix',
      fn: async function testSiblingPrefix(): Promise<void> {
        expect(isPathUnder({
          parent: '/a/b',
          child: '/a/bc',
        },),).toBe(false,);
      },
    },),
    it({
      name: 'rejects an ancestor of the parent',
      fn: async function testAncestor(): Promise<void> {
        expect(isPathUnder({
          parent: '/a/b',
          child: '/a',
        },),).toBe(false,);
      },
    },),
    it({
      name: 'rejects an unrelated path',
      fn: async function testUnrelated(): Promise<void> {
        expect(isPathUnder({
          parent: '/a/b',
          child: '/x/y',
        },),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: isAllowedWorktreeDir.name,
  children: [
    it({
      name: 'reports a git-dir under an allowed directory',
      fn: async function testUnderAllowed(): Promise<void> {
        await using tempDirectory = await createTempDirectory();
        /** Canonical temp root; allowed entry and candidate share it. */
        const root = await realpath(tempDirectory.path,);

        expect(
          await isAllowedWorktreeDir({
            candidatePath: join(
              root,
              'repo',
              '.git',
            ),
            allowedDirs: [root,],
          },),
        ).toBe(true,);
      },
    },),
    it({
      name: 'rejects a git-dir that exists outside every allowed directory',
      fn: async function testOutsideAllowed(): Promise<void> {
        await using tempDirectory = await createTempDirectory();
        /** Canonical temp root holding both the allowed dir and the candidate. */
        const root = await realpath(tempDirectory.path,);
        /** Existing allowed directory that does not contain the candidate. */
        const allowed = join(
          root,
          'allowed',
        );
        await mkdir(allowed,);

        expect(
          await isAllowedWorktreeDir({
            candidatePath: join(
              root,
              'elsewhere',
              '.git',
            ),
            allowedDirs: [allowed,],
          },),
        ).toBe(false,);
      },
    },),
    it({
      name: 'skips allowed entries that do not exist and matches a later real one',
      fn: async function testNonExistentEntrySkipped(): Promise<void> {
        await using tempDirectory = await createTempDirectory();
        /** Canonical temp root used as the real allowed entry. */
        const root = await realpath(tempDirectory.path,);

        expect(
          await isAllowedWorktreeDir({
            candidatePath: join(
              root,
              'repo',
              '.git',
            ),
            allowedDirs: [
              join(
                root,
                'does-not-exist',
              ),
              root,
            ],
          },),
        ).toBe(true,);
      },
    },),
    it({
      name: 'returns false when the only allowed entry does not exist',
      fn: async function testOnlyNonExistentEntry(): Promise<void> {
        await using tempDirectory = await createTempDirectory();
        /** Canonical temp root used to build a non-existent allowed entry. */
        const root = await realpath(tempDirectory.path,);

        expect(
          await isAllowedWorktreeDir({
            candidatePath: join(
              root,
              'repo',
              '.git',
            ),
            allowedDirs: [join(
              root,
              'does-not-exist',
            ),],
          },),
        ).toBe(false,);
      },
    },),
    it({
      name: 'resolves a symlinked allowed entry before matching',
      fn: async function testSymlinkedAllowedEntry(): Promise<void> {
        await using tempDirectory = await createTempDirectory();
        /** Canonical temp root holding the real cache and its symlink. */
        const root = await realpath(tempDirectory.path,);
        /** Real cache directory the candidate lives under. */
        const realCache = join(
          root,
          'real-cache',
        );
        await mkdir(realCache,);
        /** Symlink pointing at the real cache; passed as the allowed entry. */
        const linkedCache = join(
          root,
          'linked-cache',
        );
        await symlink(
          realCache,
          linkedCache,
        );

        // Caller contract: candidatePath is already realpath-resolved, so it
        // points through the real target rather than the symlink. A literal
        // string compare against the symlink would miss; realpath must align them.
        expect(
          await isAllowedWorktreeDir({
            candidatePath: join(
              realCache,
              'repo',
              '.git',
            ),
            allowedDirs: [linkedCache,],
          },),
        ).toBe(true,);
      },
    },),
  ],
},);
