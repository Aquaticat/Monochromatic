import {
  chmod,
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import {
  delimiter,
  join,
} from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { resolveGit, } from './resolve-git.ts';

//region Test fixtures: executable shims and disposable temp directories

/** File mode that makes fixture scripts executable by their owner. */
const EXECUTABLE_MODE = 0o755;

/** Shell script marker used by package-name based shims. */
const PACKAGE_NAME_SHIM_CONTENT = `#!/bin/sh
# @monochromatic-dev/cli-git
`;

/** Shell script marker emitted by pnpm command shims for this monorepo package. */
const BUNDLED_ENTRY_SHIM_CONTENT = `#!/bin/sh
exec node "$basedir/../../packages/git-policies/cli/dist/final/node/index.mjs" "$@"
# cmd-shim-target=/var/home/user/Monochromatic/packages/git-policies/cli/dist/final/node/index.mjs
`;

/** Shell script that stands in for the real system git binary. */
const REAL_GIT_CONTENT = `#!/bin/sh
echo real git "$@"
`;

/** Cases proving every known self-shim marker is skipped during PATH scanning. */
const SELF_SHIM_CASES: readonly {
  /** Human-readable case name shown in test output. */
  readonly name: string;
  /** Executable script contents for the self-shim candidate. */
  readonly content: string;
}[] = [
  {
    name: 'package name marker',
    content: PACKAGE_NAME_SHIM_CONTENT,
  },
  {
    name: 'bundled entry marker',
    content: BUNDLED_ENTRY_SHIM_CONTENT,
  },
];

/** Disposable temporary directory used by resolver tests. */
type TempDirectory = {
  /** Absolute path to the temporary directory. */
  readonly path: string;
  /** Deletes the temporary directory after the test exits. */
  readonly [Symbol.asyncDispose]: () => Promise<void>;
};

/**
 * Creates disposable temporary directory for test fixtures.
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
    'cli-git-resolve-',
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
 * Writes executable fixture script.
 *
 * @param options - Script path and content to write.
 *
 * @returns Nothing after fixture is executable.
 *
 * @example
 * ```ts
 * await writeExecutable({ path: '/tmp/git', content: '#!/bin/sh\n' });
 * ```
 */
async function writeExecutable({
  path,
  content,
}: {
  /** Absolute file path to create. */
  readonly path: string;
  /** Script contents to write. */
  readonly content: string;
},): Promise<void> {
  await writeFile(
    path,
    content,
    {
      mode: EXECUTABLE_MODE,
    },
  );
  await chmod(
    path,
    EXECUTABLE_MODE,
  );
}

//endregion Test fixtures

await describe({
  name: resolveGit.name,
  children: [
    ...SELF_SHIM_CASES.map(function mapSelfShimCase(selfShimCase,) {
      return it({
        name: `skips ${selfShimCase.name} and resolves later PATH entry`,
        fn: async function testSelfShimSkip(): Promise<void> {
          await using tempDirectory = await createTempDirectory();

          /** PATH directory containing self-referential git shim. */
          const selfBinDir = join(
            tempDirectory.path,
            'self-bin',
          );
          /** PATH directory containing fake real git binary. */
          const realBinDir = join(
            tempDirectory.path,
            'real-bin',
          );
          await mkdir(selfBinDir,);
          await mkdir(realBinDir,);

          /** Self-referential git executable that must be skipped. */
          const selfGitPath = join(
            selfBinDir,
            'git',
          );
          /** Later executable that should be selected as real git. */
          const realGitPath = join(
            realBinDir,
            'git',
          );
          await writeExecutable({
            path: selfGitPath,
            content: selfShimCase.content,
          },);
          await writeExecutable({
            path: realGitPath,
            content: REAL_GIT_CONTENT,
          },);

          /** PATH value under test, with self shim before real git. */
          const pathEnv = [
            selfBinDir,
            realBinDir,
          ]
            .join(delimiter,);
          /** Resolved executable path returned by cli-git. */
          const resolvedGit = await resolveGit({ pathEnv, },);

          expect(resolvedGit,).toBe(realGitPath,);
        },
      },);
    },),
    it({
      name: 'resolves Windows executable through PATHEXT order',
      fn: async function testWindowsExecutableExtension(): Promise<void> {
        await using tempDirectory = await createTempDirectory();
        /** PATH directory containing executable-suffixed Git. */
        const realBinDir = join(tempDirectory.path, 'real-bin',);
        await mkdir(realBinDir,);
        /** Windows-style executable fixture selected after absent COM candidate. */
        const realGitPath = join(realBinDir, 'git.EXE',);
        await writeExecutable({
          path: realGitPath,
          content: REAL_GIT_CONTENT,
        },);
        expect(await resolveGit({
          pathEnv: realBinDir,
          platform: 'win32',
          pathExtensions: '.COM;.EXE;.BAT;.CMD',
        },),).toBe(realGitPath,);
      },
    },),
    it({
      name: 'throws when PATH has only self shims',
      fn: async function testOnlySelfShims(): Promise<void> {
        await using tempDirectory = await createTempDirectory();

        /** PATH directory containing only self-referential git shim. */
        const selfBinDir = join(
          tempDirectory.path,
          'self-bin',
        );
        await mkdir(selfBinDir,);

        /** Self-referential git executable that must not be selected. */
        const selfGitPath = join(
          selfBinDir,
          'git',
        );
        await writeExecutable({
          path: selfGitPath,
          content: BUNDLED_ENTRY_SHIM_CONTENT,
        },);

        /** Error captured from resolving a PATH with no real git candidate. */
        const caught = await (async function catchResolveError(): Promise<unknown> {
          try {
            await resolveGit({ pathEnv: selfBinDir, },);
          }
          catch (error) {
            return error;
          }
          return undefined;
        })();

        expect(caught,).toBeInstanceOf(Error,);
        expect((caught as Error).message,).toContain('could not find real git binary',);
      },
    },),
  ],
},);
