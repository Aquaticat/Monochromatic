/**
 Tests for pinned-commit corpus reads.
 Exercised against a throwaway git repository built in a temp directory;
 fixture content is cat-themed invention mirroring corpus structure only.

 @module
 */

import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import {
  devNull,
  tmpdir,
} from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  CorpusReadError,
  isMissingCorpusObject,
  listCorpusPeople,
  readCorpusBytes,
  readCorpusFile,
} from '../dist/final/node/index.mjs';
import { spawnKeyless, } from './child-environment.test-fixture.ts';
import { fixtureGit, REAL_GIT, } from './hermetic-git-run.test-fixture.ts';
import { rejectionOf, } from './rejecting-call.test-fixture.ts';
import { scratchDirWith, } from './scratch-dir.test-fixture.ts';

/**
 Invented zh page content committed into the throwaway clone.
 */
const WHISKERS_PAGE = '---\nname: 小猫-whiskers\n---\n\n## 简介\n\n猫猫喜欢晒太阳。[^1]\n\n[^1]:[猫猫习性说明。](https://example.org/cat)\n';

/**
 Invented zh page written with CRLF endings, as the one such page in the
 pinned corpus is.
 */
const TABBY_CRLF_PAGE = '---\r\nname: 小猫-tabby\r\n---\r\n\r\n## 简介\r\n\r\n猫猫在窗台上睡觉。\r\n';

/**
 Builds a throwaway corpus-shaped git repository with one committed entry,
 removed on dispose.

 @returns Clone directory, pinned commit, and async disposer

 @example
 ```ts
 await using fixture = await makeThrowawayClone();
 ```
 */
async function makeThrowawayClone(): Promise<
  AsyncDisposable & {
    readonly cloneDir: string;
    readonly commitSha: string;
  }
> {
  // Fresh temp directory holding the throwaway repository.
  return await scratchDirWith({
    prefix: 'translation-repair-corpus-',
    setup: async function seeded({ path: cloneDir, },): Promise<{
      readonly cloneDir: string;
      readonly commitSha: string;
    }> {
      await spawnKeyless({
        file: REAL_GIT,
        args: [
          'init',
          cloneDir,
        ],
        extra: {
          GIT_CONFIG_GLOBAL: devNull,
          GIT_CONFIG_SYSTEM: devNull,
        },
      },);
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
      await mkdir(
        join(
          cloneDir,
          'people',
          'tabby',
        ),
        { recursive: true, },
      );
      await writeFile(
        join(
          cloneDir,
          'people',
          'tabby',
          'page.md',
        ),
        TABBY_CRLF_PAGE,
        'utf8',
      );
      await fixtureGit({
        cloneDir,
        args: [
          'add',
          'people/whiskers/page.md',
          'people/tabby/page.md',
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
       Commit every test read pins to.
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
      };
    },
  },);
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
      name: 'FOLDS CRLF TO LF on the way in, since every splitter downstream looks for a line feed and the '
        + 'one CRLF page in the pinned corpus defeated the line-structure predicate, the invisible-line '
        + 'mask and the quote normalizer at once; the bytes are otherwise untouched',
      fn: async () => {
        await using fixture = await makeThrowawayClone();

        /**
         The CRLF page as the package reads it.
         */
        const read = await readCorpusFile({
          pin: {
            cloneDir: fixture.cloneDir,
            commitSha: fixture.commitSha,
          },
          relPath: 'people/tabby/page.md',
        },);
        expect(read.includes('\r',),).toBe(false,);
        expect(read,).toBe(TABBY_CRLF_PAGE.replaceAll('\r\n', '\n',),);
      },
    },),
    it({
      name: 'READS one file\'s bytes at the pinned commit untouched, the CRLF page still carrying its '
        + 'carriage returns where the text reader folds them',
      fn: async () => {
        await using fixture = await makeThrowawayClone();
        expect(new TextDecoder()
          .decode(await readCorpusBytes({
            pin: {
              cloneDir: fixture.cloneDir,
              commitSha: fixture.commitSha,
            },
            relPath: 'people/tabby/page.md',
          },),),).toBe(TABBY_CRLF_PAGE,);
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
        ).toEqual([
          'tabby',
          'whiskers',
        ],);
      },
    },),

    it({
      name: 'throws CorpusReadError for paths absent at the pinned commit, and NAMES THE FAILURE a missing '
        + 'object, which is the one failure a walk over the corpus may step past',
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
        expect((caught as CorpusReadError).kind,).toBe('missing-object',);
        expect((caught as Error).message,).toContain('(missing-object)',);
        expect(isMissingCorpusObject(caught,),).toBe(true,);
      },
    },),

    it({
      name: 'REFUSES a byte path absent at the pinned commit as a missing object, naming the object '
        + 'asked for the way the text reader names it',
      fn: async () => {
        await using fixture = await makeThrowawayClone();
        /**
         What the byte read of a path that never existed threw.
         */
        const refusal = await rejectionOf(async function readsAbsentBytes(): Promise<unknown> {
          return await readCorpusBytes({
            pin: {
              cloneDir: fixture.cloneDir,
              commitSha: fixture.commitSha,
            },
            relPath: 'people/mittens/photos/intro.webp',
          },);
        },);
        expect(isMissingCorpusObject(refusal,),).toBe(true,);
        expect(String(refusal,),).toBe(
          `CorpusReadError: corpus read failed for ${fixture.commitSha}:people/mittens/photos/intro.webp `
            + '(missing-object); check that the clone exists and the pinned commit is present.',
        );
      },
    },),

    it({
      name: 'throws CorpusReadError when the clone directory does not exist, and NAMES THE FAILURE other: an '
        + 'unreadable clone is a fault in the run, not a fact about the corpus, and no walk may step past it',
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
        expect((caught as CorpusReadError).kind,).toBe('other',);
        expect(isMissingCorpusObject(caught,),).toBe(false,);
      },
    },),

    it({
      name: 'NAMES A LISTING FAILURE other too, since the listing goes through the other subprocess layer and '
        + 'a clone that cannot be listed is the same fault in the run',
      fn: async () => {
        /** Value caught from a listing against a nonexistent clone. */
        let caught: unknown;
        try {
          await listCorpusPeople({
            pin: {
              cloneDir: join(
                tmpdir(),
                'translation-repair-no-such-clone',
              ),
              commitSha: 'deadbeef',
            },
          },);
        }
        catch (error) {
          caught = error;
        }
        expect(caught instanceof CorpusReadError,).toBe(true,);
        expect((caught as CorpusReadError).kind,).toBe('other',);
      },
    },),

    it({
      name: 'LETS a listing failure that is no subprocess failure propagate as itself: a working directory '
        + 'removed under the process names its own fault rather than reading as a corpus refusal',
      fn: async () => {
        await using fixture = await makeThrowawayClone();
        /**
         Child program that removes the directory it stands in and lists the
         clone, printing what the listing threw. Every value it carries is
         written as a JSON literal, which is a JavaScript literal too.
         */
        const program = [
          "import { mkdtempSync, rmdirSync, } from 'node:fs';",
          "import { tmpdir, } from 'node:os';",
          "import { join, } from 'node:path';",
          `const { CorpusReadError, listCorpusPeople, } = await import(${
            JSON.stringify(new URL('../dist/final/node/index.mjs', import.meta.url,).href,)
          });`,
          "const gone = mkdtempSync(join(tmpdir(), 'translation-repair-gone-cwd-'));",
          'process.chdir(gone);',
          'rmdirSync(gone);',
          'try {',
          `  await listCorpusPeople({ pin: { cloneDir: ${JSON.stringify(fixture.cloneDir,)}, commitSha: ${
            JSON.stringify(fixture.commitSha,)
          }, gitPath: ${JSON.stringify(REAL_GIT,)} } });`,
          "  console.log(JSON.stringify({ listed: true }));",
          '} catch (error) {',
          '  console.log(JSON.stringify({ isCorpusReadError: error instanceof CorpusReadError, name: error.name, code: error.code }));',
          '}',
        ].join('\n',);
        /**
         What the child printed.
         */
        const { stdout, } = await spawnKeyless({
          file: process.execPath,
          args: [
            '--input-type=module',
            '--eval',
            program,
          ],
        },);
        expect(JSON.parse(stdout,),).toEqual({
          isCorpusReadError: false,
          name: 'Error',
          code: 'ENOENT',
        },);
      },
    },),

    it({
      name: 'CLASSIFIES a cause that is no object, or null, or one with no stderr as other, since none '
        + 'of them holds git stderr to read',
      fn: async () => {
        expect(new CorpusReadError({
          detail: 'people/gum/page.md at deadbeef',
          cause: 'a plain string',
        },).kind,).toBe('other',);
        expect(new CorpusReadError({
          detail: 'people/gum/page.md at deadbeef',
          cause: null,
        },).kind,).toBe('other',);
        expect(new CorpusReadError({
          detail: 'people/gum/page.md at deadbeef',
          cause: { code: 1, },
        },).kind,).toBe('other',);
      },
    },),

    it({
      name: 'READS a string stderr as its text, so a missing-object phrase lands on the kind, and one '
        + 'that is neither buffer nor string as no stderr at all',
      fn: async () => {
        expect(new CorpusReadError({
          detail: 'people/gum/page.md at deadbeef',
          cause: {
            stderr: "fatal: path 'people/gum/page.md' does not exist in 'deadbeef'",
          },
        },).kind,).toBe('missing-object',);
        expect(new CorpusReadError({
          detail: 'people/gum/page.md at deadbeef',
          cause: { stderr: 42, },
        },).kind,).toBe('other',);
      },
    },),
  ],
},);
