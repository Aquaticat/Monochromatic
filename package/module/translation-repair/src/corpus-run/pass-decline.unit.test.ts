/**
 Tests for declining an entry whose archive note says the page is the
 author's own English: the archive ships, so no page may stand for it (ledger
 A16c, following from the owner's rule that a run always ships and the
 archive-note rule of 2026-09-08).

 A page can stand there only when a crash lost its artifact between the page
 write and the artifact write, and a later pass then declined the entry.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  mkdir,
  readdir,
  writeFile,
} from 'node:fs/promises';
import {
  dirname,
  join,
} from 'node:path';

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  assertPipelineDigest,
  entryArchiveOriginalOf,
  monotonicMs,
  type PipelineDigest,
  recordEntryDecline,
  removeDeclinedPages,
} from '../../dist/final/node/index.mjs';
import { capturingLogger, } from '../capturing-logger.test-fixture.ts';
import { scratchDir, } from '../scratch-dir.test-fixture.ts';

/**
 Hex digits in a tree digest.
 */
const DIGEST_HEX_LENGTH = 64;

/**
 Digest the declining build claims, before it is checked for shape.
 */
const DIGEST_TEXT = `sha256-tree-v1:${'d'.repeat(DIGEST_HEX_LENGTH,)}`;
assertPipelineDigest(DIGEST_TEXT,);

/**
 Digest the declining build claims.
 */
const DIGEST: PipelineDigest = DIGEST_TEXT;

/**
 The entry every case declines.
 */
const ENTRY = {
  id: 'SelfWrittenCat',
  sourceText: '猫猫自己写的。\n',
  targetText: 'The cat wrote this herself.\n',
};

/**
 A throwaway runs directory's decline and page roots.

 @returns Both roots and where the entry's page would stand, removed when its
 `await using` scope ends

 @example
 ```ts
 await using run = await runsDirectory();
 ```
 */
async function runsDirectory(): Promise<{
  readonly declinedDir: string;
  readonly publishDir: string;
  readonly pageDir: string;
} & AsyncDisposable> {
  /**
   Runs directory this case owns.
   */
  const scratch = await scratchDir({ prefix: 'pass-decline-', },);
  /**
   The runs directory.
   */
  const runsDir = scratch.path;
  /**
   Root of the mirrored tree.
   */
  const publishDir = join(
    runsDir,
    'fixed',
  );
  return {
    declinedDir: join(
      runsDir,
      'declined',
    ),
    publishDir,
    pageDir: join(
      publishDir,
      'people',
      ENTRY.id,
    ),
    [Symbol.asyncDispose]: async function removeRunsDir(): Promise<void> {
      await scratch[Symbol.asyncDispose]();
    },
  };
}

/**
 Declines the entry in one runs directory.

 @param run - directories to write

 @example
 ```ts
 await decline({ run, },);
 ```
 */
async function decline(
  { run, }: { readonly run: Awaited<ReturnType<typeof runsDirectory>>; },
): Promise<void> {
  await recordEntryDecline({
    entry: ENTRY,
    declinedDir: run.declinedDir,
    publishDir: run.publishDir,
    tip: 'a'.repeat(DIGEST_HEX_LENGTH,),
    pipelineDigest: DIGEST,
    note: '原文即英文',
    startedAt: monotonicMs(),
  },);
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: entryArchiveOriginalOf.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'READS A WHOLE-PAGE NOTE as the page being the author\'s own English, and logs the note with its reading',
          fn: async () => {
            /**
             Lines the reading logged.
             */
            const messages: string[] = [];

            expect(entryArchiveOriginalOf({
              entry: {
                ...ENTRY,
                targetText: '<!-- 这只猫的原文即英文 -->\n\nThe cat wrote this herself.\n',
              },
              l: capturingLogger({ messages, },),
            },),).toEqual({
              kind: 'whole-page',
              note: '这只猫的原文即英文',
            },);
            expect(messages,).toEqual([
              `[${entryArchiveOriginalOf.name}] ARCHIVE NOTE entry=${ENTRY.id} reading=whole-page: 这只猫的原文即英文`,
            ],);
          },
        },),
        it({
          name: 'SEALS NOTHING for a note that speaks of an English original in a wording no mark reads, and WARNS so '
            + 'a new wording is seen rather than silently unsealed (ledger E12)',
          fn: async () => {
            /**
             Lines the reading logged.
             */
            const messages: string[] = [];

            expect(entryArchiveOriginalOf({
              entry: {
                ...ENTRY,
                targetText: '<!-- The cat wrote the original in English, mostly. -->\n\nThe cat wrote this herself.\n',
              },
              l: capturingLogger({ messages, },),
            },),).toEqual({ kind: 'none', },);
            expect(messages,).toEqual([
              `[${entryArchiveOriginalOf.name}] ARCHIVE NOTE entry=${ENTRY.id} reading=unmarked-original-claim: the note `
                + 'speaks of an English original in a wording no mark reads, so nothing is sealed; add its mark if it '
                + 'seals (The cat wrote the original in English, mostly.)',
            ],);
          },
        },),
      ],
    },),

    describe({
      name: recordEntryDecline.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'RECORDS the decline where no page stands, the control the removal rests on',
          fn: async () => {
            await using run = await runsDirectory();

            await decline({ run, },);

            expect(await readdir(run.declinedDir,),).toStrictEqual([`${ENTRY.id}.json`,],);
          },
        },),
        it({
          name: 'REMOVES a page an earlier crash left for the entry, so the archive ships as its note says',
          fn: async () => {
            await using run = await runsDirectory();
            await mkdir(
              run.pageDir,
              { recursive: true, },
            );
            await writeFile(
              join(
                run.pageDir,
                'page.en.md',
              ),
              'A page the run settled before a crash lost its artifact.\n',
            );

            await decline({ run, },);

            expect(await readdir(run.pageDir,),).toStrictEqual([],);
            expect(await readdir(run.declinedDir,),).toStrictEqual([`${ENTRY.id}.json`,],);
          },
        },),
        it({
          name: 'RETHROWS a removal failure other than a missing page and records nothing, so a page it could not '
            + 'remove never stands behind a recorded decline',
          fn: async () => {
            await using run = await runsDirectory();
            // A FILE WHERE THE ENTRY'S PAGE DIRECTORY BELONGS: removing the page
            // under it fails with ENOTDIR, a failure that is not the page's absence.
            await mkdir(
              dirname(run.pageDir,),
              { recursive: true, },
            );
            await writeFile(
              run.pageDir,
              'A file where the cat\'s page directory belongs.\n',
            );

            await expect(decline({ run, },),).rejects.toHaveProperty(
              'code',
              'ENOTDIR',
            );
            /**
             What the runs directory holds after the refusal: the mirrored tree,
             and no decline record's directory.
             */
            const written = await readdir(dirname(run.declinedDir,),);
            expect(written,).toStrictEqual(['fixed',],);
          },
        },),
      ],
    },),

    describe({
      name: removeDeclinedPages.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'REMOVES the page standing for an entry declined earlier, since no later pass visits it',
          fn: async () => {
            await using run = await runsDirectory();
            await decline({ run, },);
            await mkdir(
              run.pageDir,
              { recursive: true, },
            );
            await writeFile(
              join(
                run.pageDir,
                'page.en.md',
              ),
              'A page standing beside a decline record.\n',
            );

            expect(await removeDeclinedPages({
              declinedDir: run.declinedDir,
              publishDir: run.publishDir,
            },),).toStrictEqual([ENTRY.id,],);
            expect(await readdir(run.pageDir,),).toStrictEqual([],);
          },
        },),
        it({
          name: 'REMOVES NOTHING where no page stands, the control the removal rests on',
          fn: async () => {
            await using run = await runsDirectory();
            await decline({ run, },);

            expect(await removeDeclinedPages({
              declinedDir: run.declinedDir,
              publishDir: run.publishDir,
            },),).toStrictEqual([],);
          },
        },),
      ],
    },),
  ],
},);
