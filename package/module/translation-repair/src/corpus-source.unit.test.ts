/**
 * Tests for pinned-commit corpus reads.
 * Exercised against a throwaway git repository built in a temp directory;
 * fixture content is cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  mkdir,
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import {
  devNull,
  tmpdir,
} from 'node:os';
import { join, } from 'node:path';

import { resolveGit, } from '@monochromatic-dev/git-policy-cli/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import spawn from 'nano-spawn';

import {
  CorpusReadError,
  listCorpusPeople,
  readCorpusFile,
} from './corpus-source.ts';

/**
 * Real git binary for fixture setup and pinned reads;
 * the repo PATH exposes a policy shim whose staging guards reject fixture
 * staging patterns.
 */
const REAL_GIT = await resolveGit();

/**
 * Invented zh page content committed into the throwaway clone.
 */
const WHISKERS_PAGE = '---\nname: 小猫-whiskers\n---\n\n## 简介\n\n猫猫喜欢晒太阳。[^1]\n\n[^1]:[猫猫习性说明。](https://example.org/cat)\n';

/**
 * Runs one git command inside the throwaway clone,
 * hermetic against user and system git configuration.
 *
 * @param cloneDir - throwaway repository directory
 *
 * @param args - git argument vector
 *
 * @returns Captured stdout
 *
 * @example
 * ```ts
 * const sha = await fixtureGit({ cloneDir, args: ['rev-parse', 'HEAD',], },);
 * ```
 */
async function fixtureGit(
  {
    cloneDir,
    args,
  }: {
    readonly cloneDir: string;
    readonly args: readonly string[];
  },
): Promise<string> {
  /**
   * Subprocess result; only stdout is consumed.
   */
  const { stdout, } = await spawn(
    REAL_GIT,
    [
      '-C',
      cloneDir,
      ...args,
    ],
    {
      env: {
        GIT_CONFIG_GLOBAL: devNull,
        GIT_CONFIG_SYSTEM: devNull,
      },
    },
  );
  return stdout;
}

/**
 * Builds a throwaway corpus-shaped git repository with one committed entry,
 * removed on dispose.
 *
 * @returns Clone directory, pinned commit, and async disposer
 *
 * @example
 * ```ts
 * await using fixture = await makeThrowawayClone();
 * ```
 */
async function makeThrowawayClone(): Promise<
  AsyncDisposable & {
    readonly cloneDir: string;
    readonly commitSha: string;
  }
> {
  /**
   * Fresh temp directory holding the throwaway repository.
   */
  const cloneDir = await mkdtemp(join(
    tmpdir(),
    'translation-repair-corpus-',
  ),);

  await spawn(
    REAL_GIT,
    [
      'init',
      cloneDir,
    ],
    {
      env: {
        GIT_CONFIG_GLOBAL: devNull,
        GIT_CONFIG_SYSTEM: devNull,
      },
    },
  );
  await mkdir(
    join(
      cloneDir,
      'people',
      'whiskers',
    ),
    { recursive: true, },
  );
  await writeFile(
    join(
      cloneDir,
      'people',
      'whiskers',
      'page.md',
    ),
    WHISKERS_PAGE,
    'utf8',
  );
  await fixtureGit({
    cloneDir,
    args: [
      'add',
      'people/whiskers/page.md',
    ],
  },);
  await fixtureGit({
    cloneDir,
    args: [
      '-c',
      'user.name=cat',
      '-c',
      'user.email=cat@example.org',
      'commit',
      '--message',
      'add whiskers',
      '--no-gpg-sign',
    ],
  },);

  /**
   * Commit every test read pins to.
   */
  const commitSha = (await fixtureGit({
    cloneDir,
    args: [
      'rev-parse',
      'HEAD',
    ],
  },))
    .trim();

  return {
    cloneDir,
    commitSha,
    [Symbol.asyncDispose]: async function removeClone() {
      await rm(
        cloneDir,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

await describe({
  name: readCorpusFile.name,
  children: [
    it({
      name: 'reads committed content byte-for-byte at the pinned commit',
      fn: async () => {
        await using fixture = await makeThrowawayClone();
        // Explicit gitPath covers the pin-supplied-binary branch;
        // the other tests exercise default resolution.
        expect(
          await readCorpusFile({
            pin: {
              cloneDir: fixture.cloneDir,
              commitSha: fixture.commitSha,
              gitPath: REAL_GIT,
            },
            relPath: 'people/whiskers/page.md',
          },),
        ).toBe(WHISKERS_PAGE,);
      },
    },),

    it({
      name: 'lists person entry ids at the pinned commit',
      fn: async () => {
        await using fixture = await makeThrowawayClone();
        expect(
          await listCorpusPeople({
            pin: {
              cloneDir: fixture.cloneDir,
              commitSha: fixture.commitSha,
            },
          },),
        ).toEqual(['whiskers',],);
      },
    },),

    it({
      name: 'throws CorpusReadError for paths absent at the pinned commit',
      fn: async () => {
        await using fixture = await makeThrowawayClone();
        /** Value caught from read of a path that never existed. */
        let caught: unknown;
        try {
          await readCorpusFile({
            pin: {
              cloneDir: fixture.cloneDir,
              commitSha: fixture.commitSha,
            },
            relPath: 'people/mittens/page.md',
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught instanceof CorpusReadError,).toBe(true,);
      },
    },),

    it({
      name: 'throws CorpusReadError when the clone directory does not exist',
      fn: async () => {
        /** Value caught from read against a nonexistent clone. */
        let caught: unknown;
        try {
          await readCorpusFile({
            pin: {
              cloneDir: join(
                tmpdir(),
                'translation-repair-no-such-clone',
              ),
              commitSha: 'deadbeef',
            },
            relPath: 'people/whiskers/page.md',
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught instanceof CorpusReadError,).toBe(true,);
      },
    },),
  ],
},);
