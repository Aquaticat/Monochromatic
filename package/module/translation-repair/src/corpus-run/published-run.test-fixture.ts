/**
 Test-only runs directories holding settled artifacts and the pages a pass
 publishes from them, for the suites of `verify-published` and its modules.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  mkdir,
  writeFile,
} from 'node:fs/promises';
import {
  dirname,
  join,
} from 'node:path';

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';

import {
  assertPipelineDigest,
  digestPipeline,
  type PipelineDigest,
  prepareDocumentPair,
  republishSettledPages,
} from '../../dist/final/node/index.mjs';
import { scratchDirWith, } from '../scratch-dir.test-fixture.ts';

import { settledArtifactOver, } from './settled-artifact.test-fixture.ts';

/**
 Original with two sections.
 */
const SOURCE_DOC = '## 第一节\n\n猫猫在窗台上睡觉。\n\n## 第二节\n\n猫猫有自己的碗。\n';

/**
 Archive English of the same shape.
 */
export const TARGET_DOC = '## Section one\n\nThe cat sleeps on the sill.\n\n## Section two\n\nThe cat has a bowl.\n';

/**
 Entry every case settles.
 */
export const ENTRY = 'CatEntry1';

/**
 Hex digits in a tree digest.
 */
const DIGEST_HEX_LENGTH = 64;

/**
 Digest the fixture artifacts claim to have been settled by, before it is
 checked for shape.
 */
const SETTLED_TEXT = `sha256-tree-v1:${ 'c'.repeat(DIGEST_HEX_LENGTH,) }`;
assertPipelineDigest(SETTLED_TEXT,);

/**
 Digest the fixture artifacts claim to have been settled by.
 */
export const SETTLED_BY: PipelineDigest = SETTLED_TEXT;

/**
 Digest of a build that is not the one the fixture artifacts were settled by,
 before it is checked for shape.
 */
const OTHER_TEXT = `sha256-tree-v1:${ 'd'.repeat(DIGEST_HEX_LENGTH,) }`;
assertPipelineDigest(OTHER_TEXT,);

/**
 Digest of a build that is not the one the fixture artifacts were settled by.
 */
export const OTHER_BUILD: PipelineDigest = OTHER_TEXT;

/**
 Directory of the built pipeline, which a verifier reads its artifacts
 through.
 */
export const BUILT_PIPELINE_DIR: string = join(
  import.meta.dirname,
  '..',
  '..',
  'dist',
  'final',
  'node',
);

/**
 Digest of the built pipeline, which a disagreement over an artifact another
 build settled names as the reader.

 @returns The digest text of `dist/final/node`

 @example
 ```ts
 const thisBuild = await builtPipelineDigest();
 ```
 */
export async function builtPipelineDigest(): Promise<PipelineDigest> {
  return (await digestPipeline({ dir: BUILT_PIPELINE_DIR, },)).digest;
}

/**
 Where a pass publishes one entry's page under a runs directory.

 @param runsDir - run directory the tree is under

 @param entryId - entry the page belongs to

 @returns The page's path

 @example
 ```ts
 const pagePath = publishedPagePath({ runsDir, entryId: ENTRY, },);
 ```
 */
export function publishedPagePath(
  {
    runsDir,
    entryId,
  }: {
    readonly runsDir: string;
    readonly entryId: string;
  },
): string {
  return join(
    runsDir,
    'fixed',
    'people',
    entryId,
    'page.en.md',
  );
}

/**
 Where one entry's artifact lives under a runs directory.

 @param runsDir - run directory the artifacts are under

 @param entryId - entry the artifact settles

 @returns The artifact's path

 @example
 ```ts
 const artifactPath = artifactPathOf({ runsDir, entryId: ENTRY, },);
 ```
 */
export function artifactPathOf(
  {
    runsDir,
    entryId,
  }: {
    readonly runsDir: string;
    readonly entryId: string;
  },
): string {
  return join(
    runsDir,
    'artifacts',
    `${entryId}.json`,
  );
}

/**
 A settled artifact as a file written before the archive text was stored
 carries it: the whole artifact without its `archiveText` field.

 @param entryId - entry the artifact settles

 @returns The artifact's JSON text

 @example
 ```ts
 await writeFile(artifactPathOf({ runsDir, entryId: ENTRY, },), artifactTextWithoutArchive({ entryId: ENTRY, },),);
 ```
 */
export function artifactTextWithoutArchive({ entryId, }: { readonly entryId: string; },): string {
  return JSON.stringify(
    settledArtifactOver({
      prepared: prepareDocumentPair({
        sourceText: SOURCE_DOC,
        targetText: TARGET_DOC,
        includeFrontMatter: true,
        sealArchiveOriginal: true,
      },),
      entryId,
      laneSelection: { kind: 'pending-human-decision', },
      consolidation: { kind: 'not-run', },
    },),
    function withoutArchiveText(
      key: string,
      value: unknown,
    ): unknown {
      return (key === 'archiveText') ? undefined : value;
    },
  );
}

/**
 Both sides of a document a run settles.

 @example
 ```ts
 const documents: PublishedDocuments = { sourceText: SOURCE_DOC, targetText: TARGET_DOC, };
 ```
 */
type PublishedDocuments = {
  /**
   Original page.
   */
  readonly sourceText: string;

  /**
   Archive English page.
   */
  readonly targetText: string;
};

/**
 Reader of the documents a run settles, as a publishing pass is given one.

 @param documents - both sides every entry is settled over

 @returns Reader answering the same documents for any entry

 @example
 ```ts
 const readPair = readerOf({ documents: { sourceText: SOURCE_DOC, targetText: TARGET_DOC, }, },);
 ```
 */
function readerOf(
  { documents, }: { readonly documents: PublishedDocuments; },
): () => Promise<PublishedDocuments> {
  return function readPair(): Promise<PublishedDocuments> {
    return Promise.resolve(documents,);
  };
}

/**
 A throwaway runs directory holding one settled artifact for each entry named
 and the page a pass publishes from it.

 @param entryIds - entries to settle, the one entry every case settles where
 absent

 @param documents - both sides every entry is settled over, the two sections
 of `SOURCE_DOC` and `TARGET_DOC` where absent

 @param lanesAnswered - whether the artifacts carry a contest the lanes
 agreed through, which ships the wording a lane wrote into every slice the
 archive has none for; false leaves the contest unasked, where such a slice
 ships nothing

 @returns The directory and the page path of the first entry, removed when
 its `await using` scope ends

 @example
 ```ts
 await using published = await publishedRun();
 const { runsDir, pagePath, } = published;
 ```
 */
export async function publishedRun(
  {
    entryIds = [ENTRY,],
    documents = {
      sourceText: SOURCE_DOC,
      targetText: TARGET_DOC,
    },
    lanesAnswered = false,
  }: {
    readonly entryIds?: readonly string[];
    readonly documents?: PublishedDocuments;
    readonly lanesAnswered?: boolean;
  } = {},
): Promise<{
  readonly runsDir: string;
  readonly pagePath: string;
} & AsyncDisposable> {
  // The runs directory.
  return await scratchDirWith({
    prefix: 'verify-published-',
    setup: async function seeded({ path: runsDir, },): Promise<{
      readonly runsDir: string;
      readonly pagePath: string;
    }> {
      /**
       Where the artifacts live.
       */
      const artifactsDir = join(
        runsDir,
        'artifacts',
      );
      await mkdir(artifactsDir,);
      await Promise.all(entryIds.map(async function settle(entryId,): Promise<void> {
        await writeFile(
          artifactPathOf({
            runsDir,
            entryId,
          },),
          JSON.stringify(settledArtifactOver({
            prepared: prepareDocumentPair({
              ...documents,
              includeFrontMatter: true,
              sealArchiveOriginal: true,
            },),
            entryId,
            laneSelection: lanesAnswered
              ? {
                kind: 'contested',
                slices: [],
              }
              : { kind: 'pending-human-decision', },
            consolidation: { kind: 'not-run', },
          },),),
        );
      },),);
      await republishSettledPages({
        entryIds,
        artifactsDir,
        publishDir: join(
          runsDir,
          'fixed',
        ),
        readPair: readerOf({ documents, },),
        l: tagged({ tag: 'verify-published-test', },),
      },);
      return {
        runsDir,
        pagePath: publishedPagePath({
          runsDir,
          entryId: nonNullishOrThrow(entryIds[0],),
        },),
      };
    },
  },);
}

/**
 Lays down a page for an entry that has no artifact.

 @param runsDir - run directory the tree is under

 @param entryId - entry the page belongs to

 @example
 ```ts
 await strayPage({ runsDir, entryId: 'StrayCat2', },);
 ```
 */
export async function strayPage(
  {
    runsDir,
    entryId,
  }: {
    readonly runsDir: string;
    readonly entryId: string;
  },
): Promise<void> {
  await mkdir(
    dirname(publishedPagePath({
      runsDir,
      entryId,
    },),),
    { recursive: true, },
  );
  await writeFile(
    publishedPagePath({
      runsDir,
      entryId,
    },),
    'The cat stays.\n',
  );
}

/**
 Records that the pipeline declined an entry, as a pass writes it.

 @param runsDir - run directory the records are under

 @param entryId - entry declined

 @example
 ```ts
 await declineEntry({ runsDir, entryId: 'DeclinedCat3', },);
 ```
 */
export async function declineEntry(
  {
    runsDir,
    entryId,
  }: {
    readonly runsDir: string;
    readonly entryId: string;
  },
): Promise<void> {
  /**
   Where the decline records live.
   */
  const declinedDir = join(
    runsDir,
    'declined',
  );
  await mkdir(
    declinedDir,
    { recursive: true, },
  );
  await writeFile(
    join(
      declinedDir,
      `${entryId}.json`,
    ),
    '{}',
  );
}
