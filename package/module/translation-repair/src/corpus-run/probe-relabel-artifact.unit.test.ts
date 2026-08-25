/**
 * Tests for reading a settled run's repair-lane issue records back.
 *
 * THE ONE CASE THAT EARNS ITS KEEP IS WHERE THE RECORDS ARE READ FROM. This
 * reader asked for `artifact.issues`, at the ROOT, which version 2 does not
 * write; the issues live under `lanes.repair.result`. Every call therefore
 * refused a perfectly well-formed artifact, and the relabel probe could not
 * gather a single case. The module's own comment records it.
 *
 * A ROOT-READING VERSION AND A LANE-READING ONE ARE TOLD APART BY AN ARTIFACT
 * WITH NO ROOT `issues` KEY AT ALL, which is what production writes. The lane
 * reader answers with the lane's records; a root reader meets `requireArray` on
 * an absent field and refuses. So the discriminating fixture is the ordinary
 * one, and no malformed input is needed to make the point.
 *
 * THE RUNS DIRECTORY COMES FROM THE ENVIRONMENT, and `process.env` is
 * process-wide, so every case here runs at `concurrency: 1` and puts the
 * variable back however it ends. The runner spawns a process per test file, so
 * nothing outside this file is touched.
 *
 * FIXTURES ARE INVENTED AND CAT-THEMED, written into a throwaway directory that
 * removes itself. A real run directory holds unlicensed corpus wording.
 *
 * @module
 */

import {
  mkdir,
  mkdtemp,
  rm,
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
  type ArtifactDeliveryRow,
  compareLanes,
  readArtifactRecords,
} from '../../dist/final/node/index.mjs';

//region Probe relabel artifact reading tests

/**
 * Entry these fixtures describe.
 */
const ENTRY_ID = 'whiskers';

/**
 * Wording the archive carried for the one slice.
 */
const ARCHIVE_WORDING = 'The cat sat on the mat.';

/**
 * Wording the translate lane produced instead.
 */
const FRESH_WORDING = 'The cat sat upon the mat.';

/**
 * Source of that slice, in the Simplified Chinese the corpus is written in.
 */
const SOURCE_WORDING = '猫坐在垫子上。';

/**
 * Region an edit replaced, named as the artifact names one.
 */
const ENVELOPE_ID = 'envelope/purr';

/**
 * Issue that region served.
 */
const ISSUE_ID = 'adjudicated/purr';

/**
 * Prober whose recorded tally the fixture carries.
 */
const PROBER = 'cat-house/tabbyscribe-2';

/**
 * Builds the ledger row both lanes carry for the one slice.
 *
 * @param shipped - wording this lane delivered
 *
 * @param delivery - how that wording got there
 *
 * @returns One-row ledger
 *
 * @example
 * ```ts
 * const rows = ledger({ shipped: ARCHIVE_WORDING, delivery: { kind: 'incumbent-retained', }, },);
 * ```
 */
function ledger(
  {
    shipped,
    delivery,
  }: {
    readonly shipped: string;
    readonly delivery: ArtifactDeliveryRow['delivery'];
  },
): readonly ArtifactDeliveryRow[] {
  return [
    {
      sliceIndex: 0,
      sourceText: SOURCE_WORDING,
      incumbentKind: 'present',
      incumbentText: ARCHIVE_WORDING,
      outcome: {
        kind: 'decided',
        acceptedText: shipped,
      },
      shippedText: shipped,
      delivery,
    },
  ];
}

/**
 * Builds a settled version 2 artifact carrying the given repair-lane issues.
 *
 * NO ROOT `issues` KEY, deliberately, because that is what production writes
 * and what tells a lane reader from a root reader.
 *
 * @param issues - repair-lane issue records, in the shape the lane stores them
 *
 * @returns Whole artifact value
 *
 * @example
 * ```ts
 * const artifact = settledArtifact({ issues: [], },);
 * ```
 */
function settledArtifact(
  { issues, }: { readonly issues: readonly unknown[]; },
): Record<string, unknown> {
  /**
   * Repair lane's ledger, which kept the archive's wording.
   */
  const repairDelivery = ledger({
    shipped: ARCHIVE_WORDING,
    delivery: { kind: 'incumbent-retained', },
  },);

  /**
   * Translate lane's ledger, which shipped its own.
   */
  const translateDelivery = ledger({
    shipped: FRESH_WORDING,
    delivery: { kind: 'replacement-shipped', },
  },);

  return {
    artifactSchemaVersion: 4,
    id: ENTRY_ID,
    tip: 'a'.repeat(40,),
    pipelineDigest: `sha256-tree-v1:${'c'.repeat(64,)}`,
    corpusSha: 'b'.repeat(40,),
    callConfig: {
      roster: [PROBER,],
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
          repairedText: ARCHIVE_WORDING,
          status: 'unchanged',
          issues,
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
              incumbentText: ARCHIVE_WORDING,
              outcome: {
                kind: 'decided',
                acceptedText: ARCHIVE_WORDING,
              },
            },
          ],
        },
        delivery: repairDelivery,
      },
      translate: {
        result: {
          translatedText: FRESH_WORDING,
          sliceCount: 1,
          changedSliceCount: 1,
          refusedSliceCount: 0,
          withdrawnSliceCount: 0,
          changedSliceIndices: [0,],
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
              incumbentText: ARCHIVE_WORDING,
              outcome: {
                kind: 'decided',
                acceptedText: FRESH_WORDING,
              },
            },
          ],
        },
        delivery: translateDelivery,
      },
    },
    comparison: compareLanes({
      repair: repairDelivery,
      translate: translateDelivery,
    },),
    laneSelection: { kind: 'pending-human-decision', },
  };
}

/**
 * Builds one repair-lane issue record.
 *
 * @param withRegions - whether the record carries a replaced region, since an
 * older run records none and the reader defaults it
 *
 * @returns Record as the lane stores one
 *
 * @example
 * ```ts
 * const record = issueRecord({ withRegions: true, },);
 * ```
 */
function issueRecord(
  { withRegions, }: { readonly withRegions: boolean; },
): unknown {
  return {
    sliceIndex: 0,
    resolved: false,
    issue: {
      issueId: ISSUE_ID,
      status: 'accepted',
      severity: 'minor',
      claims: [
        {
          claimId: 'claim/whisker',
          claim: {
            category: 'accuracy/omission',
            severity: 'minor',
            summary: 'A purr is dropped from the greeting.',
            spans: [
              {
                side: 'source',
                nodeId: 'block/0',
                quotedText: SOURCE_WORDING,
              },
              {
                side: 'target',
                nodeId: 'block/0',
                quotedText: '',
              },
            ],
          },
        },
      ],
      tallies: {},
    },
    ...(withRegions
      ? {
        repairRegions: [
          {
            envelopeId: ENVELOPE_ID,
            issueIds: [ISSUE_ID,],
            before: ARCHIVE_WORDING,
            editorAfter: FRESH_WORDING,
          },
        ],
      }
      : {}),
  };
}

/**
 * Opens a throwaway runs directory and points the environment at it.
 *
 * @returns Disposable handle that restores the environment
 *
 * @example
 * ```ts
 * await using runs = await runsDir();
 * ```
 */
async function runsDir(): Promise<{
  readonly path: string;
  readonly [Symbol.asyncDispose]: () => Promise<void>;
}> {
  /**
   * Runs directory standing before this case ran.
   */
  const before = process.env
    .TRANSLATION_REPAIR_RUNS_DIR;

  /**
   * Fresh directory under the platform temp root.
   */
  const path = await mkdtemp(join(
    tmpdir(),
    'whiskers-relabel-artifact-',
  ),);

  await mkdir(
    join(
      path,
      'artifacts',
    ),
    { recursive: true, },
  );
  process.env.TRANSLATION_REPAIR_RUNS_DIR = path;

  return {
    path,
    [Symbol.asyncDispose]: async function restore() {
      if (before === undefined)
        delete process.env.TRANSLATION_REPAIR_RUNS_DIR;
      else
        process.env.TRANSLATION_REPAIR_RUNS_DIR = before;
      await rm(
        path,
        {
          recursive: true,
          force: true,
        },
      );
    },
  };
}

/**
 * Writes one artifact into a throwaway run and reads its records back.
 *
 * @param artifact - whole artifact value
 *
 * @returns Records the reader made of it
 *
 * @throws Whatever the reader refuses with
 *
 * @example
 * ```ts
 * const records = await recordsOf({ artifact: settledArtifact({ issues: [], },), },);
 * ```
 */
async function recordsOf(
  { artifact, }: { readonly artifact: Record<string, unknown>; },
): Promise<readonly {
  readonly issue: { readonly issueId: string; };
  readonly repairRegions: readonly { readonly envelopeId: string; }[];
  readonly recorded: Readonly<Record<string, string>>;
}[]> {
  await using runs = await runsDir();

  await writeFile(
    join(
      runs.path,
      'artifacts',
      `${ENTRY_ID}.json`,
    ),
    JSON.stringify(artifact,),
    'utf8',
  );
  return await readArtifactRecords({ entryId: ENTRY_ID, },);
}

await describe({
  name: readArtifactRecords.name,
  children: [
    it({
      name: 'READS the issues from the repair lane, where version 2 keeps them',
      fn: async () => {
        // A reader looking at `artifact.issues` meets an absent field on this
        // ordinary artifact and refuses. That was the defect: every call
        // refused a well-formed run, and the probe gathered nothing.
        expect(await recordsOf({ artifact: settledArtifact({ issues: [], },), },),).toEqual([],);
      },
    },),
    it({
      name: 'RETURNS one record per issue the lane adjudicated',
      fn: async () => {
        /**
         * Records read back from a lane carrying one issue.
         */
        const records = await recordsOf({
          artifact: settledArtifact({ issues: [issueRecord({ withRegions: true, },),], },),
        },);

        expect(records.length,).toBe(1,);
        expect(records[0]?.issue.issueId,).toBe(ISSUE_ID,);
      },
    },),
    it({
      name: 'CARRIES the replaced regions, which the relabelling is about',
      fn: async () => {
        /**
         * Records read back from a lane carrying one replaced region.
         */
        const records = await recordsOf({
          artifact: settledArtifact({ issues: [issueRecord({ withRegions: true, },),], },),
        },);

        expect(records[0]?.repairRegions.length,).toBe(1,);
        expect(records[0]?.repairRegions[0]?.envelopeId,).toBe(ENVELOPE_ID,);
      },
    },),
    it({
      name: 'ACCEPTS a record from before regions were stored, defaulting them to none',
      fn: async () => {
        // An issue with no region is an issue the editor never acted on, which
        // is an ordinary outcome rather than a malformed file. Refusing it
        // would make one unrepaired issue lose a whole entry's cases.
        /**
         * Records read back from a lane whose record stores no regions.
         */
        const records = await recordsOf({
          artifact: settledArtifact({ issues: [issueRecord({ withRegions: false, },),], },),
        },);

        expect(records.length,).toBe(1,);
        expect(records[0]?.repairRegions,).toEqual([],);
      },
    },),
  ],
  concurrency: 1,
},);

//endregion Probe relabel artifact reading tests
