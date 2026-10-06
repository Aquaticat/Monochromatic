/**
 Tests for the pass's republish step, which before any entry runs rewrites
 from its artifact every page that is missing or disagrees, and removes the
 page standing for every declined entry (ledger A16c).

 The pairs are read from a throwaway repository of invented pages at the
 commit each artifact records, never from the operator's clone. THE STEP NEVER
 STOPS THE PASS: a page it cannot rewrite and an artifacts directory it cannot
 list are logged and the pass goes on, which each case holds line by line.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  prepareDocumentPair,
  prepareRunsLayout,
  republishRunPages,
  writeDeclinedEntry,
} from '../../dist/final/node/index.mjs';
import { capturingLogger, } from '../capturing-logger.test-fixture.ts';
import { scratchDir, } from '../scratch-dir.test-fixture.ts';
import { makeCorpusPassClone, } from './corpus-pass-clone.test-fixture.ts';
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
 Commit the fixture artifacts record, which no repository holds.
 */
const ABSENT_COMMIT = 'b'.repeat(40,);

/**
 Settled artifact of the entry, recording the given corpus commit.

 @param corpusSha - commit the artifact says its texts were read at

 @returns The artifact's JSON text

 @example
 ```ts
 const text = artifactAt({ corpusSha: 'c'.repeat(40,), },);
 ```
 */
function artifactAt({ corpusSha, }: { readonly corpusSha: string; },): string {
  return settledArtifactText({
    prepared: prepareDocumentPair({
      sourceText: SOURCE_DOC,
      targetText: TARGET_DOC,
      includeFrontMatter: true,
      sealArchiveOriginal: true,
    },),
    entryId: ENTRY,
  },).replaceAll(
    ABSENT_COMMIT,
    corpusSha,
  );
}

/**
 Declines the entry in a runs directory and leaves a page standing for it, as
 a crash between the page write and the decline record leaves one.

 @param layout - the runs directory's declined and published roots

 @returns Directory the stale page stands in

 @example
 ```ts
 const pageDir = await declineWithStalePage({ layout, },);
 ```
 */
async function declineWithStalePage(
  { layout, }: {
    readonly layout: {
      readonly declinedDir: string;
      readonly publishDir: string;
    };
  },
): Promise<string> {
  await writeDeclinedEntry({
    declinedDir: layout.declinedDir,
    record: {
      id: ENTRY,
      tip: 'a'.repeat(40,),
      pipelineDigest: `sha256-tree-v1:${'d'.repeat(64,)}`,
      corpusSha: ABSENT_COMMIT,
      timestamp: '2026-09-08T21:00:00.000Z',
      reason: 'archive-original',
      note: 'The cat wrote this herself.',
    },
  },);

  /**
   Where the stale page stands.
   */
  const pageDir = join(
    layout.publishDir,
    'people',
    ENTRY,
  );
  await mkdir(
    pageDir,
    { recursive: true, },
  );
  await writeFile(
    join(
      pageDir,
      'page.en.md',
    ),
    'A page an earlier crash left.\n',
  );
  return pageDir;
}

await describe({
  name: republishRunPages.name,
  concurrency: DEFAULT_CONCURRENCY,
  children: [
    it({
      name: 'WRITES THE MISSING PAGE of a settled entry from the corpus pair at the commit its artifact records',
      fn: async () => {
        await using clone = await makeCorpusPassClone({ entries: [{
          id: ENTRY,
          sourceText: SOURCE_DOC,
          targetText: TARGET_DOC,
        },], },);
        await using scratch = await scratchDir({ prefix: 'pass-republish-', },);
        const layout = await prepareRunsLayout({ runsDir: scratch.path, },);
        await writeFile(
          join(
            layout.artifactsDir,
            `${ENTRY}.json`,
          ),
          artifactAt({ corpusSha: clone.commitSha, },),
        );
        /**
         Lines the step logged.
         */
        const messages: string[] = [];

        await republishRunPages({
          runsDir: scratch.path,
          artifactsDir: layout.artifactsDir,
          declinedDir: layout.declinedDir,
          publishDir: layout.publishDir,
          cloneDir: clone.cloneDir,
          l: capturingLogger({ messages, },),
        },);

        expect(await readFile(
          join(
            layout.publishDir,
            'people',
            ENTRY,
            'page.en.md',
          ),
          'utf8',
        ),).toBe(TARGET_DOC,);
        expect(messages,).toEqual([
          'publish: wrote 2 slices into a page of 81 characters',
          'REPUBLISHED entry=CatEntry1 why=missing: page rewritten from its artifact',
          'republish: 1 settled page judged, 1 rewritten, 0 left',
        ],);
      },
    },),
    it({
      name: 'LEAVES THE PAGE ABSENT AND SAYS WHY when the commit its artifact records is not in the clone, and '
        + 'does not stop',
      fn: async () => {
        await using clone = await makeCorpusPassClone({ entries: [], },);
        await using scratch = await scratchDir({ prefix: 'pass-republish-', },);
        const layout = await prepareRunsLayout({ runsDir: scratch.path, },);
        await writeFile(
          join(
            layout.artifactsDir,
            `${ENTRY}.json`,
          ),
          artifactAt({ corpusSha: ABSENT_COMMIT, },),
        );
        /**
         Lines the step logged.
         */
        const messages: string[] = [];

        await republishRunPages({
          runsDir: scratch.path,
          artifactsDir: layout.artifactsDir,
          declinedDir: layout.declinedDir,
          publishDir: layout.publishDir,
          cloneDir: clone.cloneDir,
          l: capturingLogger({ messages, },),
        },);

        expect(messages,).toEqual([
          'REPUBLISH LEFT entry=CatEntry1 why=missing because=CorpusReadError: page left as it was',
          'republish: 1 settled page judged, 0 rewritten, 1 left',
        ],);
        await expect(readFile(
          join(
            layout.publishDir,
            'people',
            ENTRY,
            'page.en.md',
          ),
          'utf8',
        ),).rejects.toThrow('ENOENT',);
      },
    },),
    it({
      name: 'REMOVES THE PAGE STANDING FOR A DECLINED ENTRY before it reads any artifact',
      fn: async () => {
        await using clone = await makeCorpusPassClone({ entries: [], },);
        await using scratch = await scratchDir({ prefix: 'pass-republish-', },);
        const layout = await prepareRunsLayout({ runsDir: scratch.path, },);
        /**
         Where the stale page stands.
         */
        const pageDir = await declineWithStalePage({ layout, },);
        /**
         Lines the step logged.
         */
        const messages: string[] = [];

        await republishRunPages({
          runsDir: scratch.path,
          artifactsDir: layout.artifactsDir,
          declinedDir: layout.declinedDir,
          publishDir: layout.publishDir,
          cloneDir: clone.cloneDir,
          l: capturingLogger({ messages, },),
        },);

        await expect(readFile(
          join(
            pageDir,
            'page.en.md',
          ),
          'utf8',
        ),).rejects.toThrow('ENOENT',);
        expect(messages,).toEqual([
          'republish: 0 settled pages judged, 0 rewritten, 0 left',
        ],);
      },
    },),
    it({
      name: 'SAYS THE ARTIFACTS ARE UNREADABLE and judges no page when the artifacts directory is gone, after '
        + 'the page of a declined entry is removed',
      fn: async () => {
        await using clone = await makeCorpusPassClone({ entries: [], },);
        await using scratch = await scratchDir({ prefix: 'pass-republish-', },);
        const layout = await prepareRunsLayout({ runsDir: scratch.path, },);
        await rm(
          layout.artifactsDir,
          { recursive: true, },
        );
        /**
         Where the stale page stands.
         */
        const pageDir = await declineWithStalePage({ layout, },);
        /**
         Lines the step logged.
         */
        const messages: string[] = [];

        await republishRunPages({
          runsDir: scratch.path,
          artifactsDir: layout.artifactsDir,
          declinedDir: layout.declinedDir,
          publishDir: layout.publishDir,
          cloneDir: clone.cloneDir,
          l: capturingLogger({ messages, },),
        },);

        expect(messages,).toEqual(['republish: artifacts unreadable (ENOENT); no page judged',],);
        await expect(readFile(
          join(
            pageDir,
            'page.en.md',
          ),
          'utf8',
        ),).rejects.toThrow('ENOENT',);
      },
    },),
  ],
},);
