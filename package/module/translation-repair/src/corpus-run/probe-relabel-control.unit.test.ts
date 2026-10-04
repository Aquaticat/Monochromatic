/**
 Tests for the control cases the probe gathers beside the damaged ones.

 THE CONTROL PICKS ONE UNFLAGGED REGION PER DRAWN ENTRY, and it must pick
 one the damage never touched: a region already probed as damaged would let
 the same wording answer as its own control. The taken set exists for that,
 and the holder search keeps a control whose replaced text the entry's own
 translation actually carries.

 FIXTURES ARE INVENTED AND CAT-THEMED, in Simplified Chinese against English,
 and the corpus pages live in a throwaway git clone the pin points at, since
 the real inputs are unlicensed corpus pages. The runs directory resolves once
 per process, so both cases write into one scratch run under two entries.

 @module
 */

import { mkdir, mkdtemp, writeFile, } from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  buildSampleManifest,
  gatherControlCases,
  type RelabelCase,
} from '../../dist/final/node/index.mjs';
import { namingFixtureGit, } from '../archive-naming.test-fixture.ts';
import { scratchDir, } from '../scratch-dir.test-fixture.ts';

//region Control gathering tests
// What the GATHERER does with regions it must not pick and regions it cannot.

/**
 Corpus page of the fixture entries, as the corpus writes one.
 */
const SOURCE_TEXT = '猫坐在垫子上。\n';

/**
 Translation of that page.
 */
const TARGET_TEXT = 'The cat sits on the mat.\n';

/**
 Wording the entries' translations carry, so a control region naming it has a
 holder.
 */
const HELD_BEFORE = 'The cat sits on the mat.';

/**
 Wording no slice of the entries carries.
 */
const UNHELD_BEFORE = 'A dog barks loudly at the moon.';

/**
 The one damaged case of an entry, flagging its own envelope.

 @param entryId - fixture entry the damage came from

 @returns Damaged cases as the gatherer reads them

 @example
 ```ts
 const damaged = damagedCases({ entryId: 'Kitten', },);
 ```
 */
function damagedCases({ entryId, }: { readonly entryId: string; }): readonly RelabelCase[] {
  return [{
    entryId,
    positions: [2,],
    region: {
      envelopeId: 'env-flagged',
      issueIds: ['adjudicated/naps',],
      before: HELD_BEFORE,
      editorAfter: 'The cat sat on the mat.',
    },
    issues: [],
    sourceText: SOURCE_TEXT,
    baselineText: TARGET_TEXT,
    recorded: 'The cat sat on the mat.',
  },];
}

/**
 Points the runs directory variable at a path until the handle's scope ends.

 @param path - directory the variable names meanwhile

 @returns Disposable handle restoring the variable as it stood

 @example
 ```ts
 using pointed = runsDirPointedAt({ path: runs.path, },);
 ```
 */
function runsDirPointedAt({ path, }: { readonly path: string; }): Disposable {
  /**
   Runs directory standing before this case ran.
   */
  const stoodBefore = process.env
    .TRANSLATION_REPAIR_RUNS_DIR;
  process.env.TRANSLATION_REPAIR_RUNS_DIR = path;
  return {
    [Symbol.dispose]: function restore(): void {
      if (stoodBefore === undefined)
        delete process.env.TRANSLATION_REPAIR_RUNS_DIR;
      else
        process.env.TRANSLATION_REPAIR_RUNS_DIR = stoodBefore;
    },
  };
}

/**
 Builds a throwaway corpus clone whose two fixture entries carry the fixture
 pages, and returns the pin pointing at its one commit.

 @returns Pin of the throwaway clone

 @throws Whatever the fixture git refuses with

 @example
 ```ts
 const pin = await fixturePin();
 ```
 */
async function fixturePin(): Promise<{
  readonly cloneDir: string;
  readonly commitSha: string;
}> {
  const cloneDir = await mkdtemp(join(tmpdir(), 'whiskers-control-corpus-',),);
  await mkdir(join(cloneDir, 'people', 'Kitten',), { recursive: true, },);
  await writeFile(join(cloneDir, 'people', 'Kitten', 'page.md',), SOURCE_TEXT, 'utf8',);
  await writeFile(join(cloneDir, 'people', 'Kitten', 'page.en.md',), TARGET_TEXT, 'utf8',);
  await mkdir(join(cloneDir, 'people', 'Puppy',), { recursive: true, },);
  await writeFile(join(cloneDir, 'people', 'Puppy', 'page.md',), SOURCE_TEXT, 'utf8',);
  await writeFile(join(cloneDir, 'people', 'Puppy', 'page.en.md',), TARGET_TEXT, 'utf8',);
  await namingFixtureGit({ cloneDir, args: ['init', '--quiet',], },);
  await namingFixtureGit({ cloneDir, args: ['add', 'people',], },);
  await namingFixtureGit({
    cloneDir,
    args: ['commit', '--quiet', '--message', 'fixture pages', '--no-gpg-sign',],
  },);
  const commitSha = await namingFixtureGit({ cloneDir, args: ['rev-parse', 'HEAD',], },);
  return {
    cloneDir,
    commitSha: commitSha.trim(),
  };
}

/**
 Writes one entry's artifact into the shared scratch run.

 @param entryId - fixture entry the artifact records

 @param repairRegions - regions the artifact records for that entry

 @example
 ```ts
 await writeArtifact({ entryId: 'Kitten', repairRegions: [], },);
 ```
 */
async function writeArtifact(
  {
    entryId,
    repairRegions,
  }: {
    readonly entryId: string;
    readonly repairRegions: readonly {
      readonly envelopeId: string;
      readonly issueIds: readonly string[];
      readonly before: string;
      readonly editorAfter: string;
    }[];
  },
): Promise<void> {
  await writeFile(
    join(process.env.TRANSLATION_REPAIR_RUNS_DIR ?? '', 'artifacts', `${entryId}.json`,),
    JSON.stringify({
      id: entryId,
      status: 'settled',
      issues: [{
        sliceIndex: 0,
        resolved: false,
        issue: {
          issueId: 'adjudicated/naps',
          status: 'accepted',
          severity: 'minor',
          claims: [{
            claimId: 'claim/whisker',
            claim: {
              category: 'accuracy/omission',
              severity: 'minor',
              summary: 'A purr is dropped from the greeting.',
              spans: [{
                side: 'source',
                nodeId: 'block/0',
                quotedText: '猫坐在垫子上',
              }, {
                side: 'target',
                nodeId: 'block/0',
                quotedText: '',
              },],
            },
          },],
          tallies: {},
        },
        repairRegions,
        refined: false,
        repairDisposition: 'unchanged',
      },],
    },),
    'utf8',
  );
}

/**
 Gathers the control cases of one fixture entry.

 @param entryId - fixture entry whose controls to gather

 @param repairRegions - regions the artifact records for that entry

 @returns Control cases the gatherer produced

 @throws Whatever the reads refuse with

 @example
 ```ts
 const controls = await controlsFor({ entryId: 'Kitten', repairRegions: [], },);
 ```
 */
async function controlsFor(
  {
    entryId,
    repairRegions,
  }: {
    readonly entryId: string;
    readonly repairRegions: readonly {
      readonly envelopeId: string;
      readonly issueIds: readonly string[];
      readonly before: string;
      readonly editorAfter: string;
    }[];
  },
): Promise<readonly RelabelCase[]> {
  await writeArtifact({
    entryId,
    repairRegions,
  },);
  return await gatherControlCases({
    manifestPath: MANIFEST_PATH,
    damaged: damagedCases({ entryId, },),
    pin: PIN,
  },);
}

/**
 Pin of the fixture corpus clone the cases read.

 Declared at module scope so the clone exists before any case runs.
 */
const PIN = await fixturePin();

/**
 Manifest both cases draw through.

 Declared at module scope beside the pin, since the runs directory resolves
 once per process and the cases share one scratch run.
 */
const MANIFEST_PATH = join(
  await mkdtemp(join(tmpdir(), 'whiskers-control-manifest-',),),
  'manifest.json',
);

await writeFile(
  MANIFEST_PATH,
  JSON.stringify(buildSampleManifest({
    sample: [{
      entryId: 'Kitten',
      band: 'small',
      issueId: 'adjudicated/naps',
      category: 'fluency/grammar',
      severity: 'major',
      summary: 'the tense is wrong',
      sourceQuotes: ['猫坐在垫子上',],
      targetQuotes: [HELD_BEFORE,],
      sourceAnchor: 'quoted',
    },],
    seed: 'cat-seed',
    corpusSha: 'sha/1',
    generation: {
      kind: 'unrecorded',
      reason: 'the fixture draw',
    },
  },),),
);

/**
 Shared scratch run both cases write artifacts into.

 The runs directory resolves once per process, so the variable is pointed at
 this one directory before the first read and stays pointed until the module
 ends.
 */
await using SCRATCH_RUNS = await scratchDir({ prefix: 'whiskers-relabel-control-', },);

await mkdir(join(SCRATCH_RUNS.path, 'artifacts',), { recursive: true, },);

using POINTED_AT_SCRATCH = runsDirPointedAt({ path: SCRATCH_RUNS.path, },);

await describe({
  name: gatherControlCases.name,
  children: [
    it({
      name: 'TAKES ONE REGION PER ENVELOPE, since a second region of the same envelope would answer as '
        + 'its own control',
      fn: async () => {
        const controls = await controlsFor({
          entryId: 'Kitten',
          repairRegions: [{
            envelopeId: 'env-one',
            issueIds: ['adjudicated/naps',],
            before: HELD_BEFORE,
            editorAfter: 'The cat sat on the mat.',
          }, {
            envelopeId: 'env-one',
            issueIds: ['adjudicated/naps',],
            before: HELD_BEFORE,
            editorAfter: 'The cat napped on the mat.',
          },],
        },);
        expect(controls.length,).toBe(1,);
      },
    },),

    it({
      name: 'SKIPS A REGION the entry translation never held, since a control over text no slice carries '
        + 'would compare against nothing',
      fn: async () => {
        const controls = await controlsFor({
          entryId: 'Puppy',
          repairRegions: [{
            envelopeId: 'env-two',
            issueIds: ['adjudicated/naps',],
            before: UNHELD_BEFORE,
            editorAfter: 'A dog barked loudly at the moon.',
          },],
        },);
        expect(controls.length,).toBe(0,);
      },
    },),
  ],
},);

//endregion Control gathering tests
