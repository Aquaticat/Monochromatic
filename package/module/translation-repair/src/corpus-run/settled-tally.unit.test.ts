/**
 * Tests for the line a settled entry prints once both lanes have run.
 *
 * WHAT THESE PIN is that the line reports SETTLEMENT rather than a lane. The
 * version 1 line named one lane's status as the run's status, because there was
 * one lane; keeping that shape and appending translate counts beside it would
 * tell every later log reader that the repair lane is the outcome and the other
 * is commentary, which is the question this generation exists to leave open.
 *
 * They also pin that every number comes off the artifact rather than being
 * recounted beside it, since a log line that disagrees with the file it
 * describes is worse than no log line.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  ARTIFACT_SCHEMA_VERSION_V2,
  type SettledArtifactV2,
  settledTallyLine,
} from '../../dist/final/node/index.mjs';

/**
 * Archive wording of the slice both lanes worked on.
 */
const ARCHIVE_NAP = 'The cat sleeps on the sill.';

/**
 * Wording the repair lane shipped.
 */
const MENDED_NAP = 'The cat is asleep on the windowsill.';

/**
 * Wording the translate lane shipped for the gap.
 */
const FRESH_BOWL = 'The cat has a bowl of its own.';

/**
 * Artifact these cases render.
 *
 * Built as a literal rather than through the builder, because what is under
 * test is the RENDERING: a fixture assembled by the thing whose output it
 * describes could hide a field the renderer reads from the wrong place.
 *
 * @returns Artifact of a two-slice entry where the lanes differ
 *
 * @example
 * ```ts
 * const artifact = catArtifact();
 * ```
 */
function catArtifact(): SettledArtifactV2 {
  return {
    artifactSchemaVersion: ARTIFACT_SCHEMA_VERSION_V2,
    id: 'CatEntry1',
    tip: 'a'.repeat(40,),
    pipelineDigest: `sha256-tree-v1:${'c'.repeat(64,)}`,
    corpusSha: 'b'.repeat(40,),
    callConfig: {},
    durationMs: 1_234,
    timestamp: '2026-08-16T00:00:00.000Z',
    preparation: {
      identity: `sha256-preparation-v1:${'d'.repeat(64,)}`,
      sliceCount: 2,
      sourceChars: 18,
      targetChars: ARCHIVE_NAP.length,
      sourceBytes: 54,
      alignmentPairCount: 1,
      alignmentFindings: ['alignment structure-mismatch',],
    },
    lanes: {
      repair: {
        result: {
          status: 'repaired',
          issues: [
            {
              issue: { status: 'accepted', },
              resolved: true,
            },
            {
              issue: { status: 'accepted', },
              resolved: false,
            },
            {
              issue: { status: 'rejected', },
              resolved: false,
            },
          ],
          findings: [
            'alignment structure-mismatch',
            'slice 1 had no archive wording',
          ],
        },
        delivery: [
          {
            chunkIndex: 0,
            sourceText: '猫猫在窗台上睡觉。',
            incumbentKind: 'present',
            incumbentText: ARCHIVE_NAP,
            outcome: {
              kind: 'decided',
              acceptedText: MENDED_NAP,
            },
            shippedText: MENDED_NAP,
            delivery: { kind: 'replacement-shipped', },
          },
          {
            chunkIndex: 1,
            sourceText: '猫猫有自己的碗。',
            incumbentKind: 'absent',
            incumbentText: '',
            outcome: { kind: 'not-applicable', },
            shippedText: '',
            delivery: { kind: 'gap-remains', },
          },
        ],
      },
      translate: {
        result: { status: 'complete', },
        delivery: [
          {
            chunkIndex: 0,
            sourceText: '猫猫在窗台上睡觉。',
            incumbentKind: 'present',
            incumbentText: ARCHIVE_NAP,
            outcome: {
              kind: 'decided',
              acceptedText: ARCHIVE_NAP,
            },
            shippedText: ARCHIVE_NAP,
            delivery: { kind: 'incumbent-retained', },
          },
          {
            chunkIndex: 1,
            sourceText: '猫猫有自己的碗。',
            incumbentKind: 'absent',
            incumbentText: '',
            outcome: {
              kind: 'decided',
              acceptedText: FRESH_BOWL,
            },
            shippedText: FRESH_BOWL,
            delivery: { kind: 'replacement-shipped', },
          },
        ],
      },
    },
    comparison: [
      {
        chunkIndex: 0,
        incumbentKind: 'present',
        incumbentText: ARCHIVE_NAP,
        repairText: MENDED_NAP,
        translateText: ARCHIVE_NAP,
        verdict: 'repair-only',
        repairOutcome: {
          kind: 'decided',
          acceptedText: MENDED_NAP,
        },
        translateOutcome: {
          kind: 'decided',
          acceptedText: ARCHIVE_NAP,
        },
        decisionComparison: {
          kind: 'comparable',
          verdict: 'different',
        },
        repairDelivery: { kind: 'replacement-shipped', },
        translateDelivery: { kind: 'incumbent-retained', },
      },
      {
        chunkIndex: 1,
        incumbentKind: 'absent',
        incumbentText: '',
        repairText: '',
        translateText: FRESH_BOWL,
        verdict: 'translate-only',
        repairOutcome: { kind: 'not-applicable', },
        translateOutcome: {
          kind: 'decided',
          acceptedText: FRESH_BOWL,
        },
        decisionComparison: {
          kind: 'not-comparable',
          undecidedLanes: ['repair',],
        },
        repairDelivery: { kind: 'gap-remains', },
        translateDelivery: { kind: 'replacement-shipped', },
      },
    ],
    laneSelection: { kind: 'pending-human-decision', },
  } as unknown as SettledArtifactV2;
}

/**
 * Splits the line into its `key=value` pairs.
 *
 * @returns Every field of the rendered line, keyed
 *
 * @example
 * ```ts
 * const fields = renderedFields();
 * ```
 */
function renderedFields(): Record<string, string> {
  return Object.fromEntries(
    settledTallyLine({ artifact: catArtifact(), },)
      .split(' ',)
      .filter(function isField(token,): boolean {
        return token.includes('=',);
      },)
      .map(function toPair(token,): readonly [string, string,] {
        /**
         * Key and value either side of the first separator.
         */
        const cut = token.indexOf('=',);
        return [
          token.slice(
            0,
            cut,
          ),
          token.slice(cut + 1,),
        ];
      },),
  );
}

await describe({
  name: settledTallyLine.name,
  children: [
    it({
      name:
        'reports SETTLEMENT as the top-level status rather than either lane`s, since a line reading '
        + 'status=repaired would name the repair lane as the run`s outcome in every log anyone greps, '
        + 'which is the question nobody has answered yet',
      fn: async () => {
        /**
         * Rendered fields of a two-lane entry.
         */
        const fields = renderedFields();
        expect(fields.status,).toBe('SETTLED',);
        expect(fields.selection,).toBe('pending-human-decision',);

        // Neither lane's status is reachable without its lane in the key.
        expect(fields.repairStatus,).toBe('repaired',);
        expect(fields.translateStatus,).toBe('complete',);
      },
    },),
    it({
      name:
        'names the lane on every lane measurement, so a count that belongs to one lane can never be '
        + 'read as the entry`s: the translate lane files no issues at all, and an unprefixed issues= '
        + 'would be read as the entry having had three',
      fn: async () => {
        /**
         * Rendered fields of the same entry.
         */
        const fields = renderedFields();
        expect(fields.repairIssues,).toBe('3',);
        expect(fields.repairAccepted,).toBe('2',);
        expect(fields.repairResolved,).toBe('1',);
        expect(fields.repairFindings,).toBe('2',);

        // The old unprefixed keys are gone rather than kept as aliases.
        for (const bare of [
          'issues',
          'accepted',
          'resolved',
          'findings',
        ]) {
          expect(Object.hasOwn(
            fields,
            bare,
          ),).toBe(false,);
        }
      },
    },),
    it({
      name:
        'counts what each document CARRIES per lane, and how many slices the two documents ended up '
        + 'disagreeing about, which is the number that says how much of an entry the open question '
        + 'actually covers',
      fn: async () => {
        /**
         * Rendered fields of an entry the lanes split on.
         */
        const fields = renderedFields();

        // The repair lane mended the first slice and had no work at the anchor;
        // the translate lane kept the archive and filled the gap. So each lane
        // carries exactly one change, and they are not the same slice.
        expect(fields.repairChanged,).toBe('1',);
        expect(fields.translateChanged,).toBe('1',);
        expect(fields.documentsDiffer,).toBe('2',);
      },
    },),
    it({
      name:
        'reports the preparation`s alignment findings ONCE rather than per lane, because both lanes ran '
        + 'over one alignment and a per-lane count would report one defect in the archive twice',
      fn: async () => {
        /**
         * Rendered fields, whose repair lane repeats the finding in its own
         * list.
         */
        const fields = renderedFields();
        expect(fields.alignmentFindings,).toBe('1',);

        // The repair lane's own findings include that same alignment finding
        // plus one of its own, which is exactly why the two are counted apart.
        expect(fields.repairFindings,).toBe('2',);
      },
    },),
    it({
      name:
        'reads the entry id, the slice count and the duration off the ARTIFACT rather than taking them '
        + 'beside it, so a line cannot describe an entry the file does not',
      fn: async () => {
        /**
         * Whole rendered line.
         */
        const line = settledTallyLine({ artifact: catArtifact(), },);
        expect(line.startsWith('TALLY CatEntry1 ',),).toBe(true,);

        /**
         * Its fields.
         */
        const fields = renderedFields();
        expect(fields.slices,).toBe('2',);
        expect(fields.ms,).toBe('1234',);
      },
    },),
  ],
},);
