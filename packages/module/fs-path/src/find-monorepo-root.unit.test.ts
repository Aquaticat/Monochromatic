/**
 * Tests for repository and workspace root discovery.
 *
 * Runs from inside this monorepo checkout. Real-checkout tests assert the three
 * finders converge on one directory rather than pinning its name, so they pass
 * in worktrees whose directory is not named after the repository. Temp fixture
 * tests verify marker semantics without depending on this checkout layout.
 *
 * @module
 */

import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join as nodeJoin, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  findGitRepoRoot,
  findGitRepoRootCached,
  findMiseMonorepoRoot,
  findMiseMonorepoRootCached,
  findPnpmWorkspaceRoot,
  findPnpmWorkspaceRootCached,
} from './find-monorepo-root.ts';
import { isAbsolute, } from './index.ts';

//region Fixture helpers

/** Git marker kinds accepted by {@link findGitRepoRoot}. */
type GitMarkerKind = 'directory' | 'file';

/** Disposable root fixture with a nested starting directory. */
type RootFixture = {
  /** Fixture root containing any marker file or directory. */
  readonly root: string;

  /** Nested child directory used as root finder `cwd`. */
  readonly nested: string;

  /** Removes fixture tree after test completion. */
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};

/**
 * Creates a temporary root fixture with nested child directory.
 *
 * @param prefix - temporary directory prefix passed to `mkdtemp`
 *
 * @returns disposable fixture paths
 *
 * @example
 * ```ts
 * await using fixture = await createRootFixture({ prefix: 'fs-path-' });
 * ```
 */
async function createRootFixture({
  prefix,
}: {
  readonly prefix: string;
},): Promise<RootFixture> {
  /** Absolute fixture root under system temporary directory. */
  const root = await mkdtemp(nodeJoin(
    tmpdir(),
    prefix,
  ),);
  /** Nested directory that forces upward walking before marker discovery. */
  const nested = nodeJoin(
    root,
    'child',
    'grandchild',
  );
  await mkdir(
    nested,
    { recursive: true, },
  );

  return {
    root,
    nested,
    [Symbol.asyncDispose](): Promise<void> {
      return rm(
        root,
        {
          force: true,
          recursive: true,
        },
      );
    },
  };
}

/**
 * Creates a mise monorepo root fixture.
 *
 * @returns disposable mise monorepo fixture
 *
 * @example
 * ```ts
 * await using fixture = await createMiseMonorepoFixture();
 * ```
 */
async function createMiseMonorepoFixture(): Promise<RootFixture> {
  /** Fixture root that receives monorepo `mise.toml`. */
  const fixture = await createRootFixture({ prefix: 'fs-path-mise-', },);
  await writeFile(
    nodeJoin(
      fixture.root,
      'mise.toml',
    ),
    '# test fixture\n\n[monorepo]\n',
  );
  return fixture;
}

/**
 * Creates a mise config fixture without monorepo marker.
 *
 * @returns disposable non-monorepo mise fixture
 *
 * @example
 * ```ts
 * await using fixture = await createNonMonorepoMiseFixture();
 * ```
 */
async function createNonMonorepoMiseFixture(): Promise<RootFixture> {
  /** Fixture root that receives non-monorepo `mise.toml`. */
  const fixture = await createRootFixture({ prefix: 'fs-path-non-monorepo-mise-', },);
  await writeFile(
    nodeJoin(
      fixture.root,
      'mise.toml',
    ),
    '[tools]\nnode = "latest"\n',
  );
  return fixture;
}

/**
 * Creates a Git root fixture with directory or gitfile marker.
 *
 * @param markerKind - marker shape to create at fixture root
 *
 * @returns disposable Git root fixture
 *
 * @throws when marker kind is unsupported
 *
 * @example
 * ```ts
 * await using fixture = await createGitFixture({ markerKind: 'directory' });
 * ```
 */
async function createGitFixture({
  markerKind,
}: {
  readonly markerKind: GitMarkerKind;
},): Promise<RootFixture> {
  /** Fixture root that receives `.git` marker. */
  const fixture = await createRootFixture({
    prefix: `fs-path-git-${markerKind}-`,
  },);
  /** `.git` marker path at fixture root. */
  const markerPath = nodeJoin(
    fixture.root,
    '.git',
  );

  if (markerKind === 'directory') {
    await mkdir(markerPath,);
    return fixture;
  }

  await writeFile(
    markerPath,
    'gitdir: /tmp/example-gitdir\n',
  );
  return fixture;
}

/**
 * Creates a pnpm workspace root fixture.
 *
 * @returns disposable pnpm workspace fixture
 *
 * @example
 * ```ts
 * await using fixture = await createPnpmWorkspaceFixture();
 * ```
 */
async function createPnpmWorkspaceFixture(): Promise<RootFixture> {
  /** Fixture root that receives `pnpm-workspace.yaml`. */
  const fixture = await createRootFixture({ prefix: 'fs-path-pnpm-', },);
  await writeFile(
    nodeJoin(
      fixture.root,
      'pnpm-workspace.yaml',
    ),
    "packages:\n  - 'packages/*'\n",
  );
  return fixture;
}

/**
 * Creates a fixture with no root markers.
 *
 * @param prefix - temporary directory prefix passed to `mkdtemp`
 *
 * @returns disposable markerless fixture
 *
 * @example
 * ```ts
 * await using fixture = await createMarkerlessFixture({ prefix: 'missing-' });
 * ```
 */
function createMarkerlessFixture({
  prefix,
}: {
  readonly prefix: string;
},): Promise<RootFixture> {
  return createRootFixture({ prefix, },);
}

//endregion Fixture helpers

await describe({
  name: findMiseMonorepoRoot.name,
  children: [
    it({
      name: 'returns an absolute path when called from inside the monorepo',
      fn: async () => {
        /** Root discovered from current process directory. */
        const root = await findMiseMonorepoRoot();
        expect(isAbsolute(root,),).toBe(true,);
      },
    },),
    it({
      name: 'finds a temp mise monorepo root with [monorepo] marker',
      fn: async () => {
        /** Temporary mise monorepo fixture. */
        await using fixture = await createMiseMonorepoFixture();
        /** Mise monorepo root discovered from nested fixture child. */
        const root = await findMiseMonorepoRoot({ cwd: fixture.nested, },);
        expect(root,).toBe(fixture.root,);
      },
    },),
    it({
      name: 'throws when mise.toml lacks [monorepo] marker',
      fails: true,
      fn: async () => {
        /** Temporary mise config fixture without monorepo marker. */
        await using fixture = await createNonMonorepoMiseFixture();
        await findMiseMonorepoRoot({ cwd: fixture.nested, },);
      },
    },),
    it({
      name: 'throws when no mise.toml is found walking up',
      fails: true,
      fn: async () => {
        /** Temporary fixture without mise marker. */
        await using fixture = await createMarkerlessFixture({
          prefix: 'fs-path-missing-mise-',
        },);
        await findMiseMonorepoRoot({ cwd: fixture.nested, },);
      },
    },),
    it({
      name: 'normalizes /home/ to /var/home/ on Fedora ostree systems',
      fn: async () => {
        /** Root discovered from current process directory. */
        const root = await findMiseMonorepoRoot();
        expect(root.startsWith('/home/',),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: findMiseMonorepoRootCached.name,
  children: [
    it({
      name: 'resolves to the same root that findMiseMonorepoRoot returns from process.cwd()',
      fn: async () => {
        /** Cached mise root from process cwd. */
        const cached = await findMiseMonorepoRootCached();
        /** Fresh mise root from process cwd. */
        const fresh = await findMiseMonorepoRoot();
        expect(cached,).toBe(fresh,);
      },
    },),
    it({
      name: 'returns the same value across sequential calls',
      fn: async () => {
        /** First cached mise root call. */
        const first = await findMiseMonorepoRootCached();
        /** Second cached mise root call. */
        const second = await findMiseMonorepoRootCached();
        /** Third cached mise root call. */
        const third = await findMiseMonorepoRootCached();
        expect([first, second, third,],).toAllBe();
      },
    },),
    it({
      name: 'resolves concurrent callers to the same value (one walk shared)',
      fn: async () => {
        /** Concurrent cached mise root results. */
        const [rootOne, rootTwo, rootThree, rootFour,] = await Promise.all([
          findMiseMonorepoRootCached(),
          findMiseMonorepoRootCached(),
          findMiseMonorepoRootCached(),
          findMiseMonorepoRootCached(),
        ],);
        expect([rootOne, rootTwo, rootThree, rootFour,],).toAllBe();
      },
    },),
    it({
      name: 'returns an absolute path',
      fn: async () => {
        /** Cached mise root from process cwd. */
        const root = await findMiseMonorepoRootCached();
        expect(isAbsolute(root,),).toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: findGitRepoRoot.name,
  children: [
    it({
      name: 'returns an absolute path when called from inside the repository',
      fn: async () => {
        /** Git root discovered from current process directory. */
        const root = await findGitRepoRoot();
        expect(isAbsolute(root,),).toBe(true,);
      },
    },),
    it({
      name: 'finds a temp Git root with .git directory marker',
      fn: async () => {
        /** Temporary Git fixture using normal `.git` directory. */
        await using fixture = await createGitFixture({ markerKind: 'directory', },);
        /** Git root discovered from nested fixture child. */
        const root = await findGitRepoRoot({ cwd: fixture.nested, },);
        expect(root,).toBe(fixture.root,);
      },
    },),
    it({
      name: 'finds a temp Git root with .git file marker',
      fn: async () => {
        /** Temporary Git fixture using gitfile marker. */
        await using fixture = await createGitFixture({ markerKind: 'file', },);
        /** Git root discovered from nested fixture child. */
        const root = await findGitRepoRoot({ cwd: fixture.nested, },);
        expect(root,).toBe(fixture.root,);
      },
    },),
    it({
      name: 'throws when no .git marker is found walking up',
      fails: true,
      fn: async () => {
        /** Temporary fixture without Git marker. */
        await using fixture = await createMarkerlessFixture({
          prefix: 'fs-path-missing-git-',
        },);
        await findGitRepoRoot({ cwd: fixture.nested, },);
      },
    },),
    it({
      name: 'normalizes /home/ to /var/home/ on Fedora ostree systems',
      fn: async () => {
        /** Git root discovered from current process directory. */
        const root = await findGitRepoRoot();
        expect(root.startsWith('/home/',),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: findGitRepoRootCached.name,
  children: [
    it({
      name: 'resolves to the same root that findGitRepoRoot returns from process.cwd()',
      fn: async () => {
        /** Cached Git root from process cwd. */
        const cached = await findGitRepoRootCached();
        /** Fresh Git root from process cwd. */
        const fresh = await findGitRepoRoot();
        expect(cached,).toBe(fresh,);
      },
    },),
    it({
      name: 'returns the same value across sequential calls',
      fn: async () => {
        /** First cached Git root call. */
        const first = await findGitRepoRootCached();
        /** Second cached Git root call. */
        const second = await findGitRepoRootCached();
        /** Third cached Git root call. */
        const third = await findGitRepoRootCached();
        expect([first, second, third,],).toAllBe();
      },
    },),
    it({
      name: 'resolves concurrent callers to the same value (one walk shared)',
      fn: async () => {
        /** Concurrent cached Git root results. */
        const [rootOne, rootTwo, rootThree, rootFour,] = await Promise.all([
          findGitRepoRootCached(),
          findGitRepoRootCached(),
          findGitRepoRootCached(),
          findGitRepoRootCached(),
        ],);
        expect([rootOne, rootTwo, rootThree, rootFour,],).toAllBe();
      },
    },),
    it({
      name: 'returns an absolute path',
      fn: async () => {
        /** Cached Git root from process cwd. */
        const root = await findGitRepoRootCached();
        expect(isAbsolute(root,),).toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: findPnpmWorkspaceRoot.name,
  children: [
    it({
      name: 'returns an absolute path when called from inside the workspace',
      fn: async () => {
        /** pnpm workspace root discovered from current process directory. */
        const root = await findPnpmWorkspaceRoot();
        expect(isAbsolute(root,),).toBe(true,);
      },
    },),
    it({
      name: 'finds a temp pnpm workspace root with pnpm-workspace.yaml',
      fn: async () => {
        /** Temporary pnpm workspace fixture. */
        await using fixture = await createPnpmWorkspaceFixture();
        /** pnpm workspace root discovered from nested fixture child. */
        const root = await findPnpmWorkspaceRoot({ cwd: fixture.nested, },);
        expect(root,).toBe(fixture.root,);
      },
    },),
    it({
      name: 'throws when no pnpm-workspace.yaml is found walking up',
      fails: true,
      fn: async () => {
        /** Temporary fixture without pnpm workspace marker. */
        await using fixture = await createMarkerlessFixture({
          prefix: 'fs-path-missing-pnpm-',
        },);
        await findPnpmWorkspaceRoot({ cwd: fixture.nested, },);
      },
    },),
    it({
      name: 'normalizes /home/ to /var/home/ on Fedora ostree systems',
      fn: async () => {
        /** pnpm workspace root discovered from current process directory. */
        const root = await findPnpmWorkspaceRoot();
        expect(root.startsWith('/home/',),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: findPnpmWorkspaceRootCached.name,
  children: [
    it({
      name: 'resolves to the same root that findPnpmWorkspaceRoot returns from process.cwd()',
      fn: async () => {
        /** Cached pnpm workspace root from process cwd. */
        const cached = await findPnpmWorkspaceRootCached();
        /** Fresh pnpm workspace root from process cwd. */
        const fresh = await findPnpmWorkspaceRoot();
        expect(cached,).toBe(fresh,);
      },
    },),
    it({
      name: 'returns the same value across sequential calls',
      fn: async () => {
        /** First cached pnpm workspace root call. */
        const first = await findPnpmWorkspaceRootCached();
        /** Second cached pnpm workspace root call. */
        const second = await findPnpmWorkspaceRootCached();
        /** Third cached pnpm workspace root call. */
        const third = await findPnpmWorkspaceRootCached();
        expect([first, second, third,],).toAllBe();
      },
    },),
    it({
      name: 'resolves concurrent callers to the same value (one walk shared)',
      fn: async () => {
        /** Concurrent cached pnpm workspace root results. */
        const [rootOne, rootTwo, rootThree, rootFour,] = await Promise.all([
          findPnpmWorkspaceRootCached(),
          findPnpmWorkspaceRootCached(),
          findPnpmWorkspaceRootCached(),
          findPnpmWorkspaceRootCached(),
        ],);
        expect([rootOne, rootTwo, rootThree, rootFour,],).toAllBe();
      },
    },),
    it({
      name: 'returns an absolute path',
      fn: async () => {
        /** Cached pnpm workspace root from process cwd. */
        const root = await findPnpmWorkspaceRootCached();
        expect(isAbsolute(root,),).toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: 'monorepo root finder agreement',
  children: [
    it({
      name:
        'mise, git, and pnpm roots all resolve to the same directory from this package',
      fn: async () => {
        /** Mise monorepo root walked up from this test file directory. */
        const miseRoot = await findMiseMonorepoRoot({
          cwd: import.meta.dirname,
        },);
        /** Git repository root walked up from this test file directory. */
        const gitRoot = await findGitRepoRoot({ cwd: import.meta.dirname, },);
        /** pnpm workspace root walked up from this test file directory. */
        const pnpmRoot = await findPnpmWorkspaceRoot({
          cwd: import.meta.dirname,
        },);
        expect([miseRoot, gitRoot, pnpmRoot,],).toAllBe();
      },
    },),
  ],
},);
