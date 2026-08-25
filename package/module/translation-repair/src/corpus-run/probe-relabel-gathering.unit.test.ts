/**
 * Tests for the two gatherers that rebuild prober inputs from a settled run.
 *
 * THEY ARE TESTED TOGETHER BECAUSE THEY ARE ONE INSTRUMENT. `gatherRelabelCases`
 * builds the arm asking about regions a human read as damaged, and
 * `gatherControlCases` builds the arm that says whether the first one means
 * anything. Neither reading survives on its own, and both read the same
 * artifact, the same manifest and the same corpus pages, so a fixture that
 * serves one serves the other and a divergence between them shows up here
 * rather than in a run.
 *
 * THE CONTROL'S ORDERING IS THE CASE WORTH THE FILE. `byLengthDistance` exists
 * because taking whichever unflagged regions came first made the arm answer a
 * different question: measured on the first control run, the regions that
 * happened to come first replaced 12 to 63 characters while the damaged regions
 * replaced 60 to 268, so a quiet control would have been partly a statement
 * about how much text there was to damage. The fixture below puts the SHORTEST
 * unflagged region first in document order and requires it to be dropped, so an
 * implementation that took document order would return it and fail.
 *
 * THE PINS ARE INJECTED, which is why any of this runs. Both functions read
 * `RUN_CORPUS_PIN` directly until this landed, so exercising either needed the
 * unlicensed corpus clone on disk. They now take the pin the way `censusEntry`
 * does, and the cases point them at a throwaway git repository.
 *
 * FIXTURE CONTENT IS CAT-THEMED INVENTION mirroring corpus structure only:
 * Simplified Chinese against English, one entry, committed once. The real
 * inputs are memorial pages nobody licensed us to copy.
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

import { resolveGit, } from '@monochromatic-dev/git-policy-cli/ts/resolve-git.ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import spawn from 'nano-spawn';

import {
  type ArtifactDeliveryRow,
  compareLanes,
  gatherControlCases,
  gatherRelabelCases,
  type RelabelCase,
} from '../../dist/final/node/index.mjs';

//region Probe relabel gathering tests

/**
 * Real git binary for fixture setup and pinned reads.
 *
 * The repo PATH exposes a policy shim whose staging guards reject the staging
 * patterns a fixture needs.
 */
const REAL_GIT = await resolveGit();

/**
 * Entry every fixture here describes.
 */
const ENTRY_ID = 'whiskers';

/**
 * Sheet position the round-three repair sheet marked damaged.
 *
 * TAKEN FROM `DAMAGED_CASES` RATHER THAN CHOSEN. `gatherRelabelCases` filters
 * the manifest against that constant, so a position invented here would be
 * filtered out and every case would pass against an empty result.
 */
const DAMAGED_POSITION = 2;

/**
 * Sheet position the reader did NOT mark, so the gatherer must skip it.
 */
const UNDAMAGED_POSITION = 1;

/**
 * Wording an edit replaced in the section the reader read as damaged.
 */
const DAMAGED_BEFORE = 'The cat sat on the warm windowsill mat.';

/**
 * Unflagged wording FURTHEST in length from the damaged one, and first in the
 * page, so document order and length order disagree.
 */
const FAR_BEFORE = 'She purred.';

/**
 * Unflagged wording closest in length to the damaged one.
 */
const NEAR_BEFORE = 'The kitten watched from the top stair.';

/**
 * Unflagged wording second-closest in length to the damaged one.
 */
const NEXT_BEFORE = 'The old tabby dozed beside the stove.';

/**
 * Original page, four sections, in the Simplified Chinese the corpus uses.
 */
const SOURCE_PAGE = [
  '---',
  'name: 小猫-whiskers',
  '---',
  '',
  '## 简介',
  '',
  '猫坐在温暖的窗台垫子上。',
  '',
  '## 呼噜',
  '',
  '她打起了呼噜。',
  '',
  '## 楼梯',
  '',
  '小猫从最高一级台阶上看着。',
  '',
  '## 炉火',
  '',
  '老猫在炉子旁边打盹。',
  '',
].join('\n',);

/**
 * Translation of that page, section for section, carrying every replaced
 * wording exactly once so a lookup by text can only land in one slice.
 */
const TARGET_PAGE = [
  '---',
  'name: Whiskers',
  '---',
  '',
  '## Introduction',
  '',
  DAMAGED_BEFORE,
  '',
  '## Purring',
  '',
  FAR_BEFORE,
  '',
  '## The stairs',
  '',
  NEAR_BEFORE,
  '',
  '## The stove',
  '',
  NEXT_BEFORE,
  '',
].join('\n',);

/**
 * One edit the repair lane recorded, named the way an artifact names one.
 */
type FixtureRegion = {
  /**
   * Adjudicated issue this edit served.
   */
  readonly issueId: string;

  /**
   * Region the edit replaced.
   */
  readonly envelopeId: string;

  /**
   * Wording it replaced.
   */
  readonly before: string;
};

/**
 * Every edit the fixture run recorded, in DOCUMENT ORDER.
 *
 * The order matters: {@link FAR_BEFORE} sits second, ahead of both closer
 * regions, so a control that took whichever unflagged regions came first would
 * return it.
 */
const REGIONS: readonly FixtureRegion[] = [
  {
    issueId: 'adjudicated/windowsill',
    envelopeId: 'envelope/windowsill',
    before: DAMAGED_BEFORE,
  },
  {
    issueId: 'adjudicated/purr',
    envelopeId: 'envelope/purr',
    before: FAR_BEFORE,
  },
  {
    issueId: 'adjudicated/stair',
    envelopeId: 'envelope/stair',
    before: NEAR_BEFORE,
  },
  {
    issueId: 'adjudicated/stove',
    envelopeId: 'envelope/stove',
    before: NEXT_BEFORE,
  },
];

/**
 * Runs one git command inside the throwaway clone.
 *
 * Hermetic against user and system git configuration, so a contributor's own
 * settings cannot change what the fixture commits.
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
 * Builds the ledger row the artifact carries for its one slice.
 *
 * @returns One-row ledger, enough to satisfy the settled parser
 *
 * @example
 * ```ts
 * const rows = ledger();
 * ```
 */
function ledger(): readonly ArtifactDeliveryRow[] {
  return [
    {
      sliceIndex: 0,
      sourceText: '猫坐在温暖的窗台垫子上。',
      incumbentKind: 'present',
      incumbentText: DAMAGED_BEFORE,
      outcome: {
        kind: 'decided',
        acceptedText: DAMAGED_BEFORE,
      },
      shippedText: DAMAGED_BEFORE,
      delivery: { kind: 'incumbent-retained', },
    },
  ];
}

/**
 * Builds one repair-lane issue record carrying one replaced region.
 *
 * @param region - edit this record owns
 *
 * @returns Record as the lane stores one
 *
 * @example
 * ```ts
 * const record = issueRecord({ region: REGIONS[0], },);
 * ```
 */
function issueRecord({ region, }: { readonly region: FixtureRegion; },): unknown {
  return {
    sliceIndex: 0,
    resolved: false,
    issue: {
      issueId: region.issueId,
      status: 'accepted',
      severity: 'minor',
      claims: [],
      tallies: {},
    },
    repairRegions: [
      {
        envelopeId: region.envelopeId,
        issueIds: [region.issueId,],
        before: region.before,
        editorAfter: `${region.before} Then she yawned.`,
      },
    ],
  };
}

/**
 * Builds the settled version 2 artifact the gatherers read their records from.
 *
 * @returns Whole artifact value
 *
 * @example
 * ```ts
 * const artifact = settledArtifact();
 * ```
 */
function settledArtifact(): Record<string, unknown> {
  /**
   * Ledger both lanes carry, which the comparison is computed over.
   */
  const delivery = ledger();

  return {
    artifactSchemaVersion: 4,
    id: ENTRY_ID,
    tip: 'a'.repeat(40,),
    pipelineDigest: `sha256-tree-v1:${'c'.repeat(64,)}`,
    corpusSha: 'b'.repeat(40,),
    callConfig: {
      roster: ['cat-house/tabbyscribe-2',],
      retries: 2,
    },
    durationMs: 40,
    timestamp: '2026-08-25T12:00:00.000Z',
    preparation: {
      identity: `sha256-preparation-v1:${'a7'.repeat(32,)}`,
      sliceCount: 1,
      sourceChars: 40,
      targetChars: 60,
      sourceBytes: 90,
      alignmentPairCount: 1,
      alignmentFindings: [],
    },
    lanes: {
      repair: {
        result: {
          repairedText: DAMAGED_BEFORE,
          status: 'unchanged',
          issues: REGIONS.map(function toRecord(region,) {
            return issueRecord({ region, },);
          },),
          findings: [],
          sliceCritics: [
            {
              sliceIndex: 0,
              heardCriticIds: [],
              claimAttributions: [],
            },
          ],
          sliceCount: 1,
          changedSliceIndices: [],
          withdrawnSliceIndices: [],
          sliceTexts: [
            {
              sliceIndex: 0,
              incumbentKind: 'present',
              incumbentText: DAMAGED_BEFORE,
              outcome: {
                kind: 'decided',
                acceptedText: DAMAGED_BEFORE,
              },
            },
          ],
        },
        delivery,
      },
      translate: {
        result: {
          translatedText: DAMAGED_BEFORE,
          sliceCount: 1,
          changedSliceCount: 0,
          refusedSliceCount: 0,
          withdrawnSliceCount: 0,
          changedSliceIndices: [],
          withdrawnSliceIndices: [],
          resumedSliceCount: 0,
          status: 'complete',
          unfilled: [],
          slices: [],
          sliceSelections: [],
          findings: [],
          sliceTexts: [
            {
              sliceIndex: 0,
              incumbentKind: 'present',
              incumbentText: DAMAGED_BEFORE,
              outcome: {
                kind: 'decided',
                acceptedText: DAMAGED_BEFORE,
              },
            },
          ],
        },
        delivery,
      },
    },
    comparison: compareLanes({
      repair: delivery,
      translate: delivery,
    },),
    laneSelection: { kind: 'pending-human-decision', },
  };
}

/**
 * Builds the drawn manifest the gatherers index positions into.
 *
 * The undamaged item sits FIRST so the damaged one lands at position
 * {@link DAMAGED_POSITION}, which is what the sheet marked and what the parser
 * requires to match where the item sits.
 *
 * @returns Manifest value, as a draw writes one
 *
 * @example
 * ```ts
 * const manifest = drawnManifest();
 * ```
 */
function drawnManifest(): Record<string, unknown> {
  return {
    seed: 'whiskers-seed',
    corpusSha: 'b'.repeat(40,),
    items: [
      {
        position: UNDAMAGED_POSITION,
        entryId: ENTRY_ID,
        issueId: 'adjudicated/stove',
      },
      {
        position: DAMAGED_POSITION,
        entryId: ENTRY_ID,
        issueId: 'adjudicated/windowsill',
      },
    ],
  };
}

/**
 * Everything one case needs on disk, disposed together.
 */
type Rig = AsyncDisposable & {
  /**
   * Pin naming the throwaway corpus clone and its one commit.
   */
  readonly pin: {
    readonly cloneDir: string;
    readonly commitSha: string;
  };

  /**
   * Path the drawn manifest was written to.
   */
  readonly manifestPath: string;
};

/**
 * Stands up a throwaway corpus clone, a throwaway runs directory holding one
 * settled artifact, and a manifest naming two drawn items.
 *
 * The runs directory is pointed at through the environment, which is
 * process-wide, so every case here runs at `concurrency: 1` and the disposer
 * puts the variable back however the case ends.
 *
 * @returns Rig carrying the pin and the manifest path
 *
 * @example
 * ```ts
 * await using rig = await gatheringRig();
 * ```
 */
async function gatheringRig(): Promise<Rig> {
  /**
   * Runs directory standing before this case ran.
   */
  const before = process.env
    .TRANSLATION_REPAIR_RUNS_DIR;

  /**
   * Fresh temp directory holding the throwaway corpus repository.
   */
  const cloneDir = await mkdtemp(join(
    tmpdir(),
    'whiskers-relabel-corpus-',
  ),);

  /**
   * Fresh temp directory standing in for a run.
   */
  const runsDir = await mkdtemp(join(
    tmpdir(),
    'whiskers-relabel-runs-',
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
      ENTRY_ID,
    ),
    { recursive: true, },
  );
  await writeFile(
    join(
      cloneDir,
      'people',
      ENTRY_ID,
      'page.md',
    ),
    SOURCE_PAGE,
    'utf8',
  );
  await writeFile(
    join(
      cloneDir,
      'people',
      ENTRY_ID,
      'page.en.md',
    ),
    TARGET_PAGE,
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
    ],
  },);

  /**
   * Commit every read pins to.
   */
  const commitSha = (await fixtureGit({
    cloneDir,
    args: [
      'rev-parse',
      'HEAD',
    ],
  },))
    .trim();

  await mkdir(
    join(
      runsDir,
      'artifacts',
    ),
    { recursive: true, },
  );
  await writeFile(
    join(
      runsDir,
      'artifacts',
      `${ENTRY_ID}.json`,
    ),
    JSON.stringify(settledArtifact(),),
    'utf8',
  );
  process.env.TRANSLATION_REPAIR_RUNS_DIR = runsDir;

  /**
   * Path the manifest was written to, outside the runs directory because the
   * reader takes whatever path it is handed.
   */
  const manifestPath = join(
    runsDir,
    'manifest.json',
  );

  await writeFile(
    manifestPath,
    JSON.stringify(drawnManifest(),),
    'utf8',
  );

  return {
    pin: {
      cloneDir,
      commitSha,
    },
    manifestPath,
    [Symbol.asyncDispose]: async function removeRig() {
      if (before === undefined)
        delete process.env.TRANSLATION_REPAIR_RUNS_DIR;
      else
        process.env.TRANSLATION_REPAIR_RUNS_DIR = before;
      await rm(
        cloneDir,
        {
          recursive: true,
          force: true,
        },
      );
      await rm(
        runsDir,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

/**
 * Reads the envelope ids off a gathered arm, in the order it returned them.
 *
 * @param cases - what a gatherer returned
 *
 * @returns Envelope ids, order preserved
 *
 * @example
 * ```ts
 * const ids = envelopesOf({ cases, },);
 * ```
 */
function envelopesOf(
  { cases, }: { readonly cases: readonly RelabelCase[]; },
): readonly string[] {
  return cases.map(function toEnvelopeId(gathered,) {
    return gathered.region
      .envelopeId;
  },);
}

await describe({
  name: gatherRelabelCases.name,
  children: [
    it({
      name: 'GATHERS the drawn item the reader marked damaged, and only that one',
      fn: async () => {
        await using rig = await gatheringRig();

        /**
         * Damaged arm rebuilt from the fixture run.
         */
        const cases = await gatherRelabelCases({
          manifestPath: rig.manifestPath,
          pin: rig.pin,
        },);

        // The manifest names two items and the artifact carries four edits.
        // Only the item whose position the round-three sheet marked is a case,
        // so a gatherer that ignored `DAMAGED_CASES` would return two.
        expect(envelopesOf({ cases, },),).toEqual(['envelope/windowsill',],);
      },
    },),
    it({
      name: 'RECORDS the sheet position each case came from, so a case can be traced back',
      fn: async () => {
        await using rig = await gatheringRig();

        expect((await gatherRelabelCases({
          manifestPath: rig.manifestPath,
          pin: rig.pin,
        },))[0]?.positions,).toEqual([DAMAGED_POSITION,],);
      },
    },),
    it({
      name: 'PAIRS the replaced region with ITS OWN slice, not with the whole page',
      fn: async () => {
        // A prompt built from the whole document would ask the prober about a
        // passage production never sent, and every claim it drew would describe
        // a different prompt than the one under investigation.
        await using rig = await gatheringRig();

        /**
         * The one damaged case.
         */
        const [gathered,] = await gatherRelabelCases({
          manifestPath: rig.manifestPath,
          pin: rig.pin,
        },);

        expect(gathered?.baselineText.includes(DAMAGED_BEFORE,),).toBe(true,);
        expect(gathered?.baselineText.includes(FAR_BEFORE,),).toBe(false,);
        expect(gathered?.sourceText.includes('窗台',),).toBe(true,);
        expect(gathered?.sourceText.includes('呼噜',),).toBe(false,);
      },
    },),
    it({
      name: 'CARRIES the issues the region served, and names an unprobed region as unprobed',
      fn: async () => {
        await using rig = await gatheringRig();

        /**
         * The one damaged case.
         */
        const [gathered,] = await gatherRelabelCases({
          manifestPath: rig.manifestPath,
          pin: rig.pin,
        },);

        expect(gathered?.issues.map(function toId(issue,) {
          return issue.issueId;
        },),).toEqual(['adjudicated/windowsill',],);
        expect(gathered?.recorded,).toBe('not probed',);
      },
    },),
  ],
  concurrency: 1,
},);

await describe({
  name: gatherControlCases.name,
  children: [
    it({
      name: 'NEVER re-probes an envelope the damaged arm already probed',
      fn: async () => {
        // The control exists to say whether the damaged arm's claims are about
        // the damage or about the prompt. Handing it the same edit would make
        // the two arms one arm and the comparison vacuous.
        await using rig = await gatheringRig();

        /**
         * Damaged arm, whose envelope the control must exclude.
         */
        const damaged = await gatherRelabelCases({
          manifestPath: rig.manifestPath,
          pin: rig.pin,
        },);

        /**
         * Control arm drawn from the same entry.
         */
        const controls = await gatherControlCases({
          manifestPath: rig.manifestPath,
          damaged,
          pin: rig.pin,
        },);

        expect(envelopesOf({ cases: controls, },)
          .includes('envelope/windowsill',),).toBe(false,);
      },
    },),
    it({
      name: 'ORDERS unflagged regions by how closely they match the damaged replaced length, '
        + 'so the arm is not partly a statement about how much text there was to damage',
      fn: async () => {
        // THE DEFECT THIS GUARDS. Taking whichever regions came first would
        // return the short one, which sits ahead of both closer regions in the
        // page. The fixture is built so document order and length order
        // disagree, which is the only way this case can fail.
        await using rig = await gatheringRig();

        /**
         * Damaged arm, whose replaced length the control matches against.
         */
        const damaged = await gatherRelabelCases({
          manifestPath: rig.manifestPath,
          pin: rig.pin,
        },);

        /**
         * Control arm, closest replaced length first.
         */
        const controls = await gatherControlCases({
          manifestPath: rig.manifestPath,
          damaged,
          pin: rig.pin,
        },);

        expect(envelopesOf({ cases: controls, },),).toEqual([
          'envelope/stair',
          'envelope/stove',
        ],);
      },
    },),
    it({
      name: 'DROPS the region furthest in length even though it comes FIRST in the page',
      fn: async () => {
        // The positive control for the ordering case: an implementation that
        // sorted by length but ignored the per-entry cap would return all three
        // and pass that one while failing this.
        await using rig = await gatheringRig();

        /**
         * Damaged arm, whose replaced length the control matches against.
         */
        const damaged = await gatherRelabelCases({
          manifestPath: rig.manifestPath,
          pin: rig.pin,
        },);

        /**
         * Control arm, capped at two regions per entry.
         */
        const controls = await gatherControlCases({
          manifestPath: rig.manifestPath,
          damaged,
          pin: rig.pin,
        },);

        expect(controls.length,).toBe(2,);
        expect(envelopesOf({ cases: controls, },)
          .includes('envelope/purr',),).toBe(false,);

        // Spelled out so the reader can see WHY that one is dropped rather than
        // taking the fixture's word for it.
        expect(Math.abs(FAR_BEFORE.length - DAMAGED_BEFORE.length,),)
          .toBeGreaterThan(Math.abs(NEXT_BEFORE.length - DAMAGED_BEFORE.length,),);
      },
    },),
    it({
      name: 'PAIRS each control region with the slice that carries it, never across two',
      fn: async () => {
        await using rig = await gatheringRig();

        /**
         * Damaged arm, whose replaced length the control matches against.
         */
        const damaged = await gatherRelabelCases({
          manifestPath: rig.manifestPath,
          pin: rig.pin,
        },);

        /**
         * Control arm drawn from the same entry.
         */
        const controls = await gatherControlCases({
          manifestPath: rig.manifestPath,
          damaged,
          pin: rig.pin,
        },);

        for (const control of controls) {
          expect(control.baselineText.includes(control.region
            .before,),).toBe(true,);
          expect(control.baselineText.includes(DAMAGED_BEFORE,),).toBe(false,);
          expect(control.entryId,).toBe(ENTRY_ID,);
        }
      },
    },),
    it({
      name: 'RETURNS nothing when the damaged arm named no entry, rather than drawing at large',
      fn: async () => {
        // The control's entries come from the damaged cases, which is what
        // holds prose style, translator and subject matter fixed. A control
        // that fell back to the whole pool would vary those too, and the only
        // thing meant to differ between the arms is whether a human saw damage.
        await using rig = await gatheringRig();

        expect(await gatherControlCases({
          manifestPath: rig.manifestPath,
          damaged: [],
          pin: rig.pin,
        },),).toEqual([],);
      },
    },),
  ],
  concurrency: 1,
},);

//endregion Probe relabel gathering tests
