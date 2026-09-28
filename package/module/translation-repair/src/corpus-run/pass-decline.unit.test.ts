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
  mkdtemp,
  readdir,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  assertPipelineDigest,
  type PipelineDigest,
  recordEntryDecline,
  removeDeclinedPages,
} from '../../dist/final/node/index.mjs';

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

 @returns Both roots and where the entry's page would stand

 @example
 ```ts
 const run = await runsDirectory();
 ```
 */
async function runsDirectory(): Promise<{
  readonly declinedDir: string;
  readonly publishDir: string;
  readonly pageDir: string;
}> {
  /**
   The runs directory.
   */
  const runsDir = await mkdtemp(join(
    tmpdir(),
    'pass-decline-',
  ),);
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
    startedAt: Date.now(),
  },);
}

await describe({
  name: recordEntryDecline.name,
  children: [
    it({
      name: 'RECORDS the decline where no page stands, the control the removal rests on',
      fn: async () => {
        const run = await runsDirectory();

        await decline({ run, },);

        expect(await readdir(run.declinedDir,),).toStrictEqual([`${ENTRY.id}.json`,],);
      },
    },),
    it({
      name: 'REMOVES a page an earlier crash left for the entry, so the archive ships as its note says',
      fn: async () => {
        const run = await runsDirectory();
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
  ],
},);

await describe({
  name: removeDeclinedPages.name,
  children: [
    it({
      name: 'REMOVES the page standing for an entry declined earlier, since no later pass visits it',
      fn: async () => {
        const run = await runsDirectory();
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
        const run = await runsDirectory();
        await decline({ run, },);

        expect(await removeDeclinedPages({
          declinedDir: run.declinedDir,
          publishDir: run.publishDir,
        },),).toStrictEqual([],);
      },
    },),
  ],
},);
