/**
 Tests for a pass rewriting from its artifact every page that is missing or
 disagrees (ledger A16c; the owner, 2026-09-27: a run always ships).

 Every case runs in a throwaway runs directory with an artifact the builder
 wrote over a real preparation, and reads the pair from fixture text rather
 than a corpus clone.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  mkdir,
  mkdtemp,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type CorpusPairReader,
  pageAgreement,
  parseSettledTwoLaneArtifact,
  prepareDocumentPair,
  republishSettledPages,
  type RepublishOutcome,
} from '../../dist/final/node/index.mjs';
import { settledArtifactText, } from './settled-artifact.test-fixture.ts';

/**
 Original with two sections.
 */
const SOURCE_DOC = '## 第一节\n\n猫猫在窗台上睡觉。\n\n## 第二节\n\n猫猫有自己的碗。\n';

/**
 Archive English of the same shape.
 */
const TARGET_DOC = '## Section one\n\nThe cat sleeps on the sill.\n\n## Section two\n\nThe cat has a bowl.\n';

/**
 Entry every case settles.
 */
const ENTRY = 'CatEntry1';

/**
 Logger the republish lines go through.
 */
const l = tagged({ tag: 'page-republish-test', },);

/**
 Raised by a pair reader whose corpus cannot be reached.
 */
class LitterBoxClosedError extends Error {
  /**
   Names the class for the refusal the republish records.
   */
  override readonly name = 'LitterBoxClosedError';
}

/**
 A throwaway runs directory holding one settled artifact, and where its page
 goes.

 @param strip - preparation keys to delete from the artifact, which is how a
 file written before those fields existed looks

 @returns Artifact and page roots, and the page path

 @example
 ```ts
 const run = await settledRun({ strip: [], },);
 ```
 */
async function settledRun(
  { strip, }: { readonly strip: readonly string[]; },
): Promise<{
  readonly artifactsDir: string;
  readonly publishDir: string;
  readonly pagePath: string;
}> {
  /**
   The runs directory.
   */
  const runsDir = await mkdtemp(join(
    tmpdir(),
    'page-republish-',
  ),);
  /**
   Where the artifact lives.
   */
  const artifactsDir = join(
    runsDir,
    'artifacts',
  );
  await mkdir(artifactsDir,);
  /**
   The artifact as the builder writes it, over the carve a current pass makes.
   */
  const written = JSON.parse(settledArtifactText({
    prepared: prepareDocumentPair({
      sourceText: SOURCE_DOC,
      targetText: TARGET_DOC,
      includeFrontMatter: true,
      sealArchiveOriginal: true,
    },),
    entryId: ENTRY,
  },),) as { readonly preparation: Record<string, unknown>; };
  await writeFile(
    join(
      artifactsDir,
      `${ENTRY}.json`,
    ),
    JSON.stringify({
      ...written,
      preparation: Object.fromEntries(Object.entries(written.preparation,)
        .filter(function kept([key,],): boolean {
          return !strip.includes(key,);
        },),),
    },),
  );
  /**
   Root of the mirrored tree.
   */
  const publishDir = join(
    runsDir,
    'fixed',
  );
  return {
    artifactsDir,
    publishDir,
    pagePath: join(
      publishDir,
      'people',
      ENTRY,
      'page.en.md',
    ),
  };
}

/**
 A pair reader handing back fixed text.

 @param sourceText - original to hand back

 @param targetText - archive English to hand back

 @returns The reader

 @example
 ```ts
 const readPair = pairOf({ sourceText: SOURCE_DOC, targetText: TARGET_DOC, },);
 ```
 */
function pairOf(
  {
    sourceText,
    targetText,
  }: {
    readonly sourceText: string;
    readonly targetText: string;
  },
): CorpusPairReader {
  return async function readPair() {
    return {
      sourceText,
      targetText,
    };
  };
}

/**
 The reader for the pair every artifact here was settled over.
 */
const SAME_PAIR = pairOf({
  sourceText: SOURCE_DOC,
  targetText: TARGET_DOC,
},);

/**
 Runs the republish over one runs directory and returns the entry's outcome.

 @param run - directories to read and write

 @param readPair - reader for the entry's pair

 @returns The one entry's outcome

 @example
 ```ts
 const outcome = await republishIn({ run, readPair: SAME_PAIR, },);
 ```
 */
async function republishIn(
  {
    run,
    readPair,
  }: {
    readonly run: Awaited<ReturnType<typeof settledRun>>;
    readonly readPair: CorpusPairReader;
  },
): Promise<RepublishOutcome> {
  /**
   One row, for the one entry.
   */
  const [row,] = await republishSettledPages({
    entryIds: [ENTRY,],
    artifactsDir: run.artifactsDir,
    publishDir: run.publishDir,
    readPair,
    l,
  },);
  if (row === undefined)
    throw new Error('republishSettledPages returned no row for the one entry it was given',);
  return row.outcome;
}

/**
 Whether the page on disk carries what the artifact ships.

 @param run - directories holding both

 @returns The verdict

 @example
 ```ts
 expect(await verdictOf({ run, },),).toBe('agreed-weighed',);
 ```
 */
async function verdictOf(
  { run, }: { readonly run: Awaited<ReturnType<typeof settledRun>>; },
): Promise<string> {
  /**
   The artifact as a reader parses it.
   */
  const artifact = parseSettledTwoLaneArtifact({
    value: JSON.parse(await readFile(
      join(
        run.artifactsDir,
        `${ENTRY}.json`,
      ),
      'utf8',
    ),) as unknown,
  },);
  return pageAgreement({
    artifact,
    pageText: await readFile(
      run.pagePath,
      'utf8',
    ),
  },).agreement;
}

await describe({
  name: republishSettledPages.name,
  children: [
    it({
      name: 'WRITES a missing page from its artifact, and the page then agrees with it',
      fn: async () => {
        const run = await settledRun({ strip: [], },);

        expect(await republishIn({
          run,
          readPair: SAME_PAIR,
        },),).toStrictEqual({
          kind: 'republished',
          why: 'missing',
        },);
        expect(await verdictOf({ run, },),).toBe('agreed-weighed',);
      },
    },),
    it({
      name: 'LEAVES an agreeing page as it is, the control that a rewrite is not every page\'s fate',
      fn: async () => {
        const run = await settledRun({ strip: [], },);
        await republishIn({
          run,
          readPair: SAME_PAIR,
        },);
        /**
         The page the first pass wrote.
         */
        const written = await readFile(
          run.pagePath,
          'utf8',
        );

        expect(await republishIn({
          run,
          readPair: SAME_PAIR,
        },),).toStrictEqual({ kind: 'agreed', },);
        expect(await readFile(
          run.pagePath,
          'utf8',
        ),).toBe(written,);
      },
    },),
    it({
      name: 'REWRITES a page that disagrees with its artifact back to what the artifact ships',
      fn: async () => {
        const run = await settledRun({ strip: [], },);
        await republishIn({
          run,
          readPair: SAME_PAIR,
        },);
        /**
         The page as it should stand.
         */
        const written = await readFile(
          run.pagePath,
          'utf8',
        );
        await writeFile(
          run.pagePath,
          written.replace(
            'The cat has a bowl.',
            'The cat has.',
          ),
        );
        expect(await verdictOf({ run, },),).toBe('disagreed',);

        expect(await republishIn({
          run,
          readPair: SAME_PAIR,
        },),).toStrictEqual({
          kind: 'republished',
          why: 'disagreed',
        },);
        expect(await readFile(
          run.pagePath,
          'utf8',
        ),).toBe(written,);
      },
    },),
    it({
      name: 'SPLICES INTO THE ARCHIVE THE ARTIFACT STORED, not the corpus copy, which the pass reshapes before it carves',
      fn: async () => {
        const run = await settledRun({ strip: [], },);

        expect(await republishIn({
          run,
          readPair: pairOf({
            sourceText: SOURCE_DOC,
            targetText: `${TARGET_DOC}\nA stray corpus line the run never carved.\n`,
          },),
        },),).toStrictEqual({
          kind: 'republished',
          why: 'missing',
        },);
        expect((await readFile(
          run.pagePath,
          'utf8',
        )).includes('stray corpus line',),).toBe(false,);
        expect(await verdictOf({ run, },),).toBe('agreed-weighed',);
      },
    },),
    it({
      name: 'FALLS BACK TO THE CORPUS COPY for an artifact that predates storing the archive',
      fn: async () => {
        const run = await settledRun({ strip: ['archiveText',], },);

        expect(await republishIn({
          run,
          readPair: SAME_PAIR,
        },),).toStrictEqual({
          kind: 'republished',
          why: 'missing',
        },);
        expect(await verdictOf({ run, },),).toBe('agreed-unweighed',);
      },
    },),
    it({
      name: 'LEAVES a page whose original no longer carves as the run carved it, saying where it moved',
      fn: async () => {
        const run = await settledRun({ strip: [], },);

        /**
         What became of the page.
         */
        const outcome = await republishIn({
          run,
          readPair: pairOf({
            sourceText: SOURCE_DOC.replace(
              '猫猫有自己的碗。',
              '猫猫有两个碗。',
            ),
            targetText: TARGET_DOC,
          },),
        },);
        expect(outcome.kind,).toBe('left',);
        expect((outcome.kind === 'left') && outcome.because.startsWith('carve moved:',),).toBe(true,);
        await expect(readFile(
          run.pagePath,
          'utf8',
        ),).rejects.toThrow('ENOENT',);
      },
    },),
    it({
      name: 'LEAVES a page when the pair cannot be read, naming the class and never its message',
      fn: async () => {
        const run = await settledRun({ strip: [], },);

        expect(await republishIn({
          run,
          readPair: async function closed() {
            throw new LitterBoxClosedError('the corpus clone is shut for the night',);
          },
        },),).toStrictEqual({
          kind: 'left',
          why: 'missing',
          because: 'LitterBoxClosedError',
        },);
      },
    },),
    it({
      name: 'LEAVES an artifact it cannot read, and goes on',
      fn: async () => {
        const run = await settledRun({ strip: [], },);
        await writeFile(
          join(
            run.artifactsDir,
            `${ENTRY}.json`,
          ),
          '{"id":',
        );

        /**
         What became of the page.
         */
        const outcome = await republishIn({
          run,
          readPair: SAME_PAIR,
        },);
        expect(outcome.kind,).toBe('left',);
        expect((outcome.kind === 'left') && outcome.why,).toBe('unreadable',);
      },
    },),
  ],
},);
