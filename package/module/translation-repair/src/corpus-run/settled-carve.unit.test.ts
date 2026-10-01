/**
 Tests for carving an entry the way the pass carved it when it settled.
 
 WHAT THESE PIN is that an instrument reading settled entries gets the slicing
 the artifact records, proved by the identity hash against the artifact's
 own recorded identity, and that the three answers for an entry (settled,
 legacy, unsettled) stay distinct. Every rebuild case carries a positive
 control showing the recipe moved the slicing.
 
 Fixtures are cat-themed invention. No corpus content appears here.
 
 @module
 */

import {
  mkdir,
  mkdtemp,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import {
  devNull,
  tmpdir,
} from 'node:os';
import { join, } from 'node:path';

import { resolveRealGit as resolveGit, } from '@monochromatic-dev/git-executable/ts';
import {
  DEFAULT_CONCURRENCY,
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import spawn from 'nano-spawn';

import {
  buildSettledTwoLaneArtifact,
  NO_PAGE_ASSEMBLY,
  carveSettled,
  type DocumentLanesResult,
  listSettledEntryIds,
  type PipelineDigest,
  preparationIdentity,
  type PreparedDocumentPair,
  prepareDocumentPair,
  readSettledRecipe,
  recipeLabel,
  type SliceDeliveryRecord,
} from '../../dist/final/node/index.mjs';
import { scratchDir, } from '../scratch-dir.test-fixture.ts';

/**
 Real git binary for fixture setup and pinned reads.
 */
const REAL_GIT = await resolveGit();

/**
 Entry the throwaway clone carries.
 */
const ENTRY_ID = 'whiskers';

/**
 Two sections of equal shape, so a supplied crossing is visibly different
 from the index order the deterministic aligner takes.
 */
const SOURCE_PAGE = '## 第一节\n\n猫猫在窗台上睡觉。\n\n## 第二节\n\n猫猫有自己的碗。\n';

/**
 Translation of the same shape.
 */
const TARGET_PAGE = '## Section one\n\nThe cat sleeps on the sill.\n\n## Section two\n\nThe cat has a bowl.\n';

/**
 Digest every fixture artifact claims.
 */
const DIGEST = 'sha256-tree-v1:'.concat('c'.repeat(64,),) as unknown as PipelineDigest;

/**
 Wording a lane writes where the archive holds none.
 */
const FRESH_LINE = 'The cat has been given a line.';

/**
 Runs git against the fixture clone with no user configuration.
 
 @param cloneDir - fixture clone
 
 @param args - git arguments
 
 @returns Standard output
 
 @example
 ```ts
 const sha = await fixtureGit({ cloneDir, args: ['rev-parse', 'HEAD',], },);
 ```
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
   Git's output.
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
 Makes a throwaway corpus clone carrying the fixture entry at one commit.

 @param pages - original and archive English the entry carries, the fixture
 pages unless a case needs others

 @returns Clone directory and commit, removed on dispose

 @example
 ```ts
 await using corpus = await throwawayCorpus();
 ```
 */
async function throwawayCorpus(
  {
    sourcePage = SOURCE_PAGE,
    targetPage = TARGET_PAGE,
  }: {
    readonly sourcePage?: string;
    readonly targetPage?: string;
  } = {},
): Promise<
  AsyncDisposable & {
    readonly cloneDir: string;
    readonly commitSha: string;
  }
> {
  /**
   Where the clone lives.
   */
  const cloneDir = await mkdtemp(join(
    tmpdir(),
    'whiskers-settled-carve-',
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

  /**
   Entry directory.
   */
  const dir = join(
    cloneDir,
    'people',
    ENTRY_ID,
  );
  await mkdir(
    dir,
    { recursive: true, },
  );
  await writeFile(
    join(
      dir,
      'page.md',
    ),
    sourcePage,
    'utf8',
  );
  await writeFile(
    join(
      dir,
      'page.en.md',
    ),
    targetPage,
    'utf8',
  );
  await fixtureGit({
    cloneDir,
    args: [
      'add',
      `people/${ENTRY_ID}/page.md`,
      `people/${ENTRY_ID}/page.en.md`,
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
      '--',
      `people/${ENTRY_ID}/page.md`,
      `people/${ENTRY_ID}/page.en.md`,
    ],
  },);

  /**
   Commit the entry sits at.
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

/**
 Rows that keep every present slice and fill every insertion.
 
 @param prepared - preparation the rows describe
 
 @returns One row per slice
 
 @example
 ```ts
 const rows = rowsFor({ prepared, },);
 ```
 */
function rowsFor(
  { prepared, }: { readonly prepared: PreparedDocumentPair; },
): readonly SliceDeliveryRecord[] {
  return prepared.slices
    .map(function toRow(slice,): SliceDeliveryRecord {
      /**
       Archive wording of this slice, empty at an insertion.
       */
      const incumbentText = slice.target
        .text;

      /**
       Whether the archive holds wording here at all.
       */
      const absent = slice.target
        .kind === 'insertion';
      if (absent)
        return {
          sliceIndex: slice.target
            .sliceIndex,
          sourceText: slice.source
            .text,
          incumbentKind: 'absent',
          incumbentText,
          outcome: {
            kind: 'decided',
            acceptedText: FRESH_LINE,
          },
          shippedText: FRESH_LINE,
          delivery: { kind: 'replacement-shipped', },
        };
      return {
        sliceIndex: slice.target
          .sliceIndex,
        sourceText: slice.source
          .text,
        incumbentKind: 'present',
        incumbentText,
        outcome: {
          kind: 'decided',
          acceptedText: incumbentText,
        },
        shippedText: incumbentText,
        delivery: { kind: 'incumbent-retained', },
      };
    },);
}

/**
 Raw lane result consistent with the rows.
 
 @param rows - rows the result reports
 
 @returns Evidence core the builder projects
 
 @example
 ```ts
 const result = rawResultFor({ rows, },);
 ```
 */
function rawResultFor(
  { rows, }: { readonly rows: readonly SliceDeliveryRecord[]; },
): Record<string, unknown> {
  /**
   Slices the rows say shipped a replacement.
   */
  const shipped = rows
    .filter(function wasShipped(row,): boolean {
      return row.delivery
        .kind === 'replacement-shipped';
    },)
    .map(function indexOf(row,): number {
      return row.sliceIndex;
    },);
  return {
    sliceCount: rows.length,
    changedSliceIndices: shipped,
    withdrawnSliceIndices: [],
    changedSliceCount: shipped.length,
    withdrawnSliceCount: 0,
    sliceTexts: rows.map(function toEvidence(row,): Record<string, unknown> {
      return {
        sliceIndex: row.sliceIndex,
        incumbentKind: row.incumbentKind,
        incumbentText: row.incumbentText,
        outcome: row.outcome,
      };
    },),
  };
}

/**
 Writes a settled artifact for the fixture entry into a runs directory.
 
 @param runsDir - runs directory to write under
 
 @param prepared - preparation the artifact records
 
 @param corpusSha - commit the artifact claims
 
 @param strip - preparation keys to delete, which is how a file written
 before those fields existed looks
 
 @example
 ```ts
 await writeArtifact({ runsDir, prepared, corpusSha, strip: [], },);
 ```
 */
async function writeArtifact(
  {
    runsDir,
    prepared,
    corpusSha,
    strip,
  }: {
    readonly runsDir: string;
    readonly prepared: PreparedDocumentPair;
    readonly corpusSha: string;
    readonly strip: readonly string[];
  },
): Promise<void> {
  /**
   Rows the lanes report.
   */
  const rows = rowsFor({ prepared, },);

  /**
   Identity both ledgers claim.
   */
  const identity = preparationIdentity({ prepared, },);

  /**
   Lanes consistent with the preparation.
   */
  const lanes = {
    alignmentFindings: [...prepared.alignmentFindings,],
    repair: {
      ...rawResultFor({ rows, },),
      repairedText: prepared.targetText,
      status: 'unchanged',
    },
    translate: {
      ...rawResultFor({ rows, },),
      translatedText: prepared.targetText,
      status: 'complete',
    },
    repairDelivery: {
      preparationIdentity: identity,
      records: rows,
    },
    translateDelivery: {
      preparationIdentity: identity,
      records: rows,
    },
  } as unknown as DocumentLanesResult;

  /**
   Artifact as the builder writes it, in its serialized form.
   */
  const serialized = JSON.stringify(buildSettledTwoLaneArtifact({
    pageAssembly: NO_PAGE_ASSEMBLY,
    entryId: ENTRY_ID,
    tip: 'a'.repeat(40,),
    pipelineDigest: DIGEST,
    corpusSha,
    callConfig: { perCallTimeoutMs: 600_000, },
    durationMs: 1_234,
    prepared,
    lanes,
    laneSelection: { kind: 'pending-human-decision', },
    consolidation: { kind: 'not-run', },
  },),);

  /**
   Those bytes read back.
   */
  const written = JSON.parse(serialized,) as Record<string, unknown>;

  /**
   Preparation record with the named keys removed.
   */
  const preparation = Object.fromEntries(
    Object.entries(written.preparation as Record<string, unknown>,)
      .filter(function kept([key,],): boolean {
        return !strip.includes(key,);
      },),
  );
  await writeArtifactFile({
    runsDir,
    value: {
      ...written,
      preparation,
    },
  },);
}

/**
 Writes any value as the fixture entry's artifact.
 
 @param runsDir - runs directory to write under
 
 @param value - artifact content
 
 @example
 ```ts
 await writeArtifactFile({ runsDir, value: legacyArtifact, },);
 ```
 */
async function writeArtifactFile(
  {
    runsDir,
    value,
  }: {
    readonly runsDir: string;
    readonly value: unknown;
  },
): Promise<void> {
  /**
   Artifacts subdirectory.
   */
  const dir = join(
    runsDir,
    'artifacts',
  );
  await mkdir(
    dir,
    { recursive: true, },
  );
  await writeFile(
    join(
      dir,
      `${ENTRY_ID}.json`,
    ),
    JSON.stringify(
      value,
      undefined,
      2,
    ),
    'utf8',
  );
}

/**
 How a roster run carved the fixture: sections crossed, block rounds asked.
 
 @returns Paired preparation
 
 @example
 ```ts
 const paired = pairedPreparation();
 ```
 */
function pairedPreparation(): PreparedDocumentPair {
  return prepareDocumentPair({
    sourceText: SOURCE_PAGE,
    targetText: TARGET_PAGE,
    sectionPairing: [{
      source: 0,
      target: 1,
    },],
    blockPairings: new Map(),
  },);
}

await describe({
  name: '',
  concurrency: 1,
  children: [
    describe({
      name: listSettledEntryIds.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name:
            'LISTS nothing for a runs directory no pass has settled into, since a missing artifacts '
            + 'subdirectory is an ordinary state rather than a fault',
          fn: async () => {
            await using runs = await scratchDir({ prefix: 'whiskers-settled-runs-', },);
            expect(await listSettledEntryIds({ runsDir: runs.path, },),).toEqual([],);
          },
        },),
        it({
          name: 'LISTS entry ids off the artifact file names, sorted, ignoring anything that is not an artifact',
          fn: async () => {
            await using runs = await scratchDir({ prefix: 'whiskers-settled-runs-', },);

            /**
             Artifacts subdirectory with two artifacts and a stray note.
             */
            const dir = join(
              runs.path,
              'artifacts',
            );
            await mkdir(
              dir,
              { recursive: true, },
            );
            await Promise.all([
              'tabby.json',
              'calico.json',
              'notes.txt',
            ].map(async function place(name,): Promise<void> {
              await writeFile(
                join(
                  dir,
                  name,
                ),
                '{}',
                'utf8',
              );
            },),);
            expect(await listSettledEntryIds({ runsDir: runs.path, },),).toEqual([
              'calico',
              'tabby',
            ],);
          },
        },),
        it({
          name: 'LISTS REGULAR FILES ONLY: a directory or a symlink named like an artifact is no settled entry, as the '
            + 'census and the scheduler read the same directory (ledger B64)',
          fn: async () => {
            await using runs = await scratchDir({ prefix: 'whiskers-settled-runs-', },);

            /**
             Artifacts subdirectory with one artifact, a directory and a symlink.
             */
            const dir = join(
              runs.path,
              'artifacts',
            );
            await mkdir(
              join(
                dir,
                'persian.json',
              ),
              { recursive: true, },
            );
            await writeFile(
              join(
                dir,
                'tabby.json',
              ),
              '{}',
              'utf8',
            );
            await symlink(
              join(
                dir,
                'tabby.json',
              ),
              join(
                dir,
                'siamese.json',
              ),
            );
            expect(await listSettledEntryIds({ runsDir: runs.path, },),).toEqual(['tabby',],);
          },
        },),
      ],
    },),

    describe({
      name: readSettledRecipe.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'REPORTS an entry no artifact records as unsettled, without touching the corpus',
          fn: async () => {
            await using runs = await scratchDir({ prefix: 'whiskers-settled-runs-', },);
            expect(await readSettledRecipe({
              entryId: ENTRY_ID,
              runsDir: runs.path,
            },),).toEqual({ kind: 'unsettled', },);
          },
        },),
        it({
          name:
            'REPORTS an artifact from before the two-lane shape as legacy, since it records no preparation '
            + 'and therefore no recipe to carve through',
          fn: async () => {
            await using runs = await scratchDir({ prefix: 'whiskers-settled-runs-', },);
            await writeArtifactFile({
              runsDir: runs.path,
              value: {
                id: ENTRY_ID,
                tip: 'tip/1',
                corpusSha: 'sha/1',
                status: 'repaired',
                durationMs: 1,
                issues: [],
              },
            },);
            expect(await readSettledRecipe({
              entryId: ENTRY_ID,
              runsDir: runs.path,
            },),).toEqual({ kind: 'legacy', },);
          },
        },),
        it({
          name:
            'READS the recipe a two-lane artifact records, beside its commit, with the supplied section pairing '
            + 'and the stored block pairing as preparation inputs',
          fn: async () => {
            await using runs = await scratchDir({ prefix: 'whiskers-settled-runs-', },);
            await writeArtifact({
              runsDir: runs.path,
              prepared: pairedPreparation(),
              corpusSha: 'b'.repeat(40,),
              strip: [],
            },);

            /**
             Recipe as read back.
             */
            const settled = await readSettledRecipe({
              entryId: ENTRY_ID,
              runsDir: runs.path,
            },);
            expect(settled.kind,).toBe('settled',);
            if (settled.kind !== 'settled')
              throw new Error('unreachable: the kind was checked',);
            expect(settled.corpusSha,).toBe('b'.repeat(40,),);
            expect(settled.recipe
              .sectionPairing,).toEqual([{
              source: 0,
              target: 1,
            },],);
            expect(settled.recipe
              .blockPairings,).toEqual(new Map(),);
            expect(settled.recipe
              .unrecorded,).toEqual([],);
          },
        },),
        it({
          name: 'NAMES the recipe halves an older two-lane artifact does not record',
          fn: async () => {
            await using runs = await scratchDir({ prefix: 'whiskers-settled-runs-', },);
            await writeArtifact({
              runsDir: runs.path,
              prepared: prepareDocumentPair({
                sourceText: SOURCE_PAGE,
                targetText: TARGET_PAGE,
              },),
              corpusSha: 'b'.repeat(40,),
              strip: [
                'sectionPairing',
                'blockPairing',
              ],
            },);

            /**
             Recipe as read back.
             */
            const settled = await readSettledRecipe({
              entryId: ENTRY_ID,
              runsDir: runs.path,
            },);
            if (settled.kind !== 'settled')
              throw new Error(`expected a settled reading, got ${settled.kind}`,);
            expect(settled.recipe
              .unrecorded,).toEqual([
              'sectionPairing',
              'blockPairing',
            ],);
          },
        },),
      ],
    },),

    describe({
      name: carveSettled.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name:
            'CARVES the pair at the artifact\'s own commit through its recipe, landing on the identity the '
            + 'artifact records: the deterministic carve of the same pair lands elsewhere',
          fn: async () => {
            await using corpus = await throwawayCorpus();
            await using runs = await scratchDir({ prefix: 'whiskers-settled-runs-', },);

            /**
             How the run carved it.
             */
            const paired = pairedPreparation();

            // POSITIVE CONTROL: the recipe has to move the slicing.
            expect(preparationIdentity({ prepared: paired, },),).not
              .toBe(preparationIdentity({
                prepared: prepareDocumentPair({
                  sourceText: SOURCE_PAGE,
                  targetText: TARGET_PAGE,
                },),
              },),);
            await writeArtifact({
              runsDir: runs.path,
              prepared: paired,
              corpusSha: corpus.commitSha,
              strip: [],
            },);

            /**
             Carve through the settled recipe.
             */
            const carve = await carveSettled({
              entryId: ENTRY_ID,
              runsDir: runs.path,
              cloneDir: corpus.cloneDir,
            },);
            expect(carve.kind,).toBe('settled',);
            if (carve.kind !== 'settled')
              throw new Error('unreachable: the kind was checked',);
            expect(carve.corpusSha,).toBe(corpus.commitSha,);
            expect(carve.sourceText,).toBe(SOURCE_PAGE,);
            expect(preparationIdentity({ prepared: carve.prepared, },),).toBe(
              preparationIdentity({ prepared: paired, },),
            );
            expect(recipeLabel({ recipe: carve.recipe, },),).toBe('complete recipe',);
          },
        },),
        it({
          name: 'FORWARDS an unsettled or legacy answer without reading the corpus',
          fn: async () => {
            await using runs = await scratchDir({ prefix: 'whiskers-settled-runs-', },);
            expect(await carveSettled({
              entryId: ENTRY_ID,
              runsDir: runs.path,
              cloneDir: '/nonexistent/clone',
            },),).toEqual({ kind: 'unsettled', },);
          },
        },),
        it({
          name: 'CARVES AN ARCHIVE-AUTHORITY ENTRY AS THE RUN DID, with no metadata slice, so slice indices do not '
            + 'shift by one (ledger F-6)',
          fn: async () => {
            /**
             Original carrying visible metadata.
             */
            const sourcePage = `---\nname: 猫猫\n---\n\n${SOURCE_PAGE}`;
            /**
             Archive English carrying the same metadata.
             */
            const targetPage = `---\nname: Maomao\n---\n\n${TARGET_PAGE}`;
            await using corpus = await throwawayCorpus({
              sourcePage,
              targetPage,
            },);
            await using runs = await scratchDir({ prefix: 'whiskers-settled-runs-', },);
            /**
             How a current pass carves it when the archive's front matter governs.
             */
            const carved = prepareDocumentPair({
              sourceText: sourcePage,
              targetText: targetPage,
              includeFrontMatter: true,
              frontMatterAuthority: 'archive',
              sealArchiveOriginal: true,
            },);
            await writeArtifact({
              runsDir: runs.path,
              prepared: carved,
              corpusSha: corpus.commitSha,
              strip: [],
            },);

            /**
             Carve through the settled artifact.
             */
            const carve = await carveSettled({
              entryId: ENTRY_ID,
              runsDir: runs.path,
              cloneDir: corpus.cloneDir,
            },);
            if (carve.kind !== 'settled')
              throw new Error(`expected a settled carve, got ${carve.kind}`,);
            expect(carve.prepared.slices.length,).toBe(carved.slices.length,);
            expect(preparationIdentity({ prepared: carve.prepared, },),).toBe(
              preparationIdentity({ prepared: carved, },),
            );
          },
        },),
        it({
          name: 'CARVES OVER THE ARCHIVE THE ARTIFACT STORED, which the pass reshaped before carving, '
            + 'not the corpus copy (ledger A18)',
          fn: async () => {
            await using corpus = await throwawayCorpus({
              targetPage: `${TARGET_PAGE}\nA stray corpus line the run never carved.\n`,
            },);
            await using runs = await scratchDir({ prefix: 'whiskers-settled-runs-', },);
            /**
             How the pass carved the archive it had reshaped.
             */
            const carved = prepareDocumentPair({
              sourceText: SOURCE_PAGE,
              targetText: TARGET_PAGE,
              includeFrontMatter: true,
              sealArchiveOriginal: true,
            },);
            await writeArtifact({
              runsDir: runs.path,
              prepared: carved,
              corpusSha: corpus.commitSha,
              strip: [],
            },);

            /**
             Carve through the settled artifact.
             */
            const carve = await carveSettled({
              entryId: ENTRY_ID,
              runsDir: runs.path,
              cloneDir: corpus.cloneDir,
            },);
            if (carve.kind !== 'settled')
              throw new Error(`expected a settled carve, got ${carve.kind}`,);
            expect(carve.targetText,).toBe(TARGET_PAGE,);
            expect(preparationIdentity({ prepared: carve.prepared, },),).toBe(
              preparationIdentity({ prepared: carved, },),
            );
          },
        },),
      ],
    },),

    describe({
      name: recipeLabel.name,
      concurrency: DEFAULT_CONCURRENCY,
      children: [
        it({
          name: 'NAMES the halves the deterministic default stood in for, in the order they are missing',
          fn: async () => {
            expect(recipeLabel({
              recipe: {
                unrecorded: [
                  'sectionPairing',
                  'blockPairing',
                ],
              },
            },),).toBe('deterministic default for sectionPairing, blockPairing',);
          },
        },),
      ],
    },),
  ],
},);
