/**
 * Tests for reading one whole version 2 artifact.
 *
 * EVERY CASE BREAKS ONE VALID ARTIFACT IN EXACTLY ONE WAY, and the artifact's
 * comparison is derived by version 2's own frozen rules rather than typed out,
 * so a case that changes a ledger gets the comparison that follows from it
 * without anyone hand-maintaining a second copy of the rules.
 *
 * WHAT THEY PIN, beyond shape: the checks that catch a file whose parts
 * contradict each other. Every field here parses on its own in each of these
 * cases; what fails is a relation between two of them, which is the whole
 * reason a reader recomputes rather than believing what it is told.
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
  type ArtifactDeliveryRowV2,
  compareLanesV2,
  parseSettledArtifactV2,
} from '../../dist/final/node/index.mjs';

/**
 * Original of the slice both lanes work on.
 */
const SOURCE_NAP = '猫猫在窗台上睡觉。';

/**
 * Original of the passage the archive never translated.
 */
const SOURCE_BIRD = '窗台上有一只鸟。';

/**
 * Archive's own English for the first slice.
 */
const ARCHIVE_NAP = 'The cat sleeps on the sill.';

/**
 * Wording the translate lane decided for it.
 */
const FRESH_NAP = 'The cat naps on the windowsill.';

/**
 * Identity a preparation gives itself, which a standalone reader checks for
 * SYNTAX only: the inputs it hashes are not in the file.
 */
const PREPARATION_IDENTITY = `sha256-preparation-v1:${'a7'.repeat(32,)}`;

/**
 * Repair lane's ledger: it kept the archive's wording, and had nothing to do at
 * a passage the archive never translated.
 *
 * @returns Two rows, in document order
 *
 * @example
 * ```ts
 * const rows = repairLedger();
 * ```
 */
function repairLedger(): readonly ArtifactDeliveryRowV2[] {
  return [
    {
      chunkIndex: 0,
      sourceText: SOURCE_NAP,
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
      sourceText: SOURCE_BIRD,
      incumbentKind: 'absent',
      incumbentText: '',
      outcome: { kind: 'not-applicable', },
      shippedText: '',
      delivery: { kind: 'gap-remains', },
    },
  ];
}

/**
 * Translate lane's ledger: it replaced the first slice and could not fill the
 * second.
 *
 * @returns Two rows, in document order
 *
 * @example
 * ```ts
 * const rows = translateLedger();
 * ```
 */
function translateLedger(): readonly ArtifactDeliveryRowV2[] {
  return [
    {
      chunkIndex: 0,
      sourceText: SOURCE_NAP,
      incumbentKind: 'present',
      incumbentText: ARCHIVE_NAP,
      outcome: {
        kind: 'decided',
        acceptedText: FRESH_NAP,
      },
      shippedText: FRESH_NAP,
      delivery: { kind: 'replacement-shipped', },
    },
    {
      chunkIndex: 1,
      sourceText: SOURCE_BIRD,
      incumbentKind: 'absent',
      incumbentText: '',
      outcome: { kind: 'unfilled', },
      shippedText: '',
      delivery: { kind: 'gap-remains', },
    },
  ];
}

/**
 * Repair lane's raw result, carrying fields version 2 never described so every
 * case runs against a record shaped like a real one.
 *
 * @returns Raw result JSON
 *
 * @example
 * ```ts
 * const raw = repairResult();
 * ```
 */
function repairResult(): Record<string, unknown> {
  return {
    repairedText: `## Section one\n\n${ARCHIVE_NAP}`,
    status: 'unchanged',
    issues: [],
    findings: ['stage-quorum-unmet (critic 0/6)',],
    chunkCritics: [
      {
        chunkIndex: 0,
        heardCriticIds: [],
        claimAttributions: [],
      },
    ],
    sliceCount: 2,
    shippedChunkIndices: [],
    withdrawnChunkIndices: [],
    sliceTexts: [
      {
        chunkIndex: 0,
        incumbentKind: 'present',
        incumbentText: ARCHIVE_NAP,
        outcome: {
          kind: 'decided',
          acceptedText: ARCHIVE_NAP,
        },
      },
      {
        chunkIndex: 1,
        incumbentKind: 'absent',
        incumbentText: '',
        outcome: { kind: 'not-applicable', },
      },
    ],
  };
}

/**
 * Translate lane's raw result, on the same footing.
 *
 * @returns Raw result JSON
 *
 * @example
 * ```ts
 * const raw = translateResult();
 * ```
 */
function translateResult(): Record<string, unknown> {
  return {
    translatedText: `## Section one\n\n${FRESH_NAP}`,
    sliceCount: 2,
    changedSliceCount: 1,
    refusedSliceCount: 0,
    withdrawnSliceCount: 0,
    shippedChunkIndices: [0,],
    withdrawnChunkIndices: [],
    resumedSliceCount: 0,
    status: 'unfilled',
    unfilled: [{ chunkIndex: 1, },],
    slices: [],
    sliceSelections: [],
    findings: [],
    sliceTexts: [
      {
        chunkIndex: 0,
        incumbentKind: 'present',
        incumbentText: ARCHIVE_NAP,
        outcome: {
          kind: 'decided',
          acceptedText: FRESH_NAP,
        },
      },
      {
        chunkIndex: 1,
        incumbentKind: 'absent',
        incumbentText: '',
        outcome: { kind: 'unfilled', },
      },
    ],
  };
}

/**
 * One whole version 2 artifact, with whatever this case changes.
 *
 * OVERRIDES RATHER THAN MUTATION, so no case reaches into a nested structure
 * and no case can leave one half-edited: a ledger handed in here is the ledger
 * both the lane and the comparison are built from.
 *
 * @param repairDelivery - repair lane's ledger
 *
 * @param translateDelivery - translate lane's ledger
 *
 * @param repairRaw - repair lane's raw result
 *
 * @param translateRaw - translate lane's raw result
 *
 * @param comparison - comparison to record, which DEFAULTS to what version 2's
 * own rules derive from the two ledgers, exactly as the writer does
 *
 * @param rest - any top-level field this case replaces
 *
 * @returns Artifact as JSON
 *
 * @example
 * ```ts
 * const artifact = artifactWith({ repairDelivery: rows, },);
 * ```
 */
function artifactWith(
  {
    repairDelivery = repairLedger(),
    translateDelivery = translateLedger(),
    repairRaw = repairResult(),
    translateRaw = translateResult(),
    comparison = compareLanesV2({
      repair: repairDelivery,
      translate: translateDelivery,
    },),
    ...rest
  }: {
    readonly repairDelivery?: readonly ArtifactDeliveryRowV2[];
    readonly translateDelivery?: readonly ArtifactDeliveryRowV2[];
    readonly repairRaw?: Record<string, unknown>;
    readonly translateRaw?: Record<string, unknown>;
    readonly comparison?: readonly unknown[];
    readonly [field: string]: unknown;
  } = {},
): Record<string, unknown> {
  return {
    artifactSchemaVersion: 2,
    id: 'CatEntry1',
    tip: 'a'.repeat(40,),
    pipelineDigest: `sha256-tree-v1:${'c'.repeat(64,)}`,
    corpusSha: 'b'.repeat(40,),
    callConfig: {
      roster: [
        'Tabby',
        'Calico',
      ],
      retries: 2,
    },
    durationMs: 40,
    timestamp: '2026-08-16T21:00:00.000Z',
    preparation: {
      identity: PREPARATION_IDENTITY,
      sliceCount: 2,
      sourceChars: 40,
      targetChars: 60,
      sourceBytes: 90,
      alignmentPairCount: 2,
      alignmentFindings: [],
    },
    lanes: {
      repair: {
        result: repairRaw,
        delivery: repairDelivery,
      },
      translate: {
        result: translateRaw,
        delivery: translateDelivery,
      },
    },
    comparison,
    laneSelection: { kind: 'pending-human-decision', },
    ...rest,
  };
}

/**
 * A ledger with one row replaced.
 *
 * @param rows - ledger to change
 *
 * @param at - position of the row to replace
 *
 * @param replace - what that row says instead, built from the row it replaces
 *
 * @returns New ledger, leaving the one passed in alone
 *
 * @example
 * ```ts
 * const rows = rowReplaced({ rows: repairLedger(), at: 1, replace: shipIt, },);
 * ```
 */
function rowReplaced<const TRow,>(
  {
    rows,
    at,
    replace,
  }: {
    readonly rows: readonly TRow[];
    readonly at: number;
    readonly replace: (row: TRow,) => TRow;
  },
): readonly TRow[] {
  return rows.map(function replaceOne(
    row,
    position,
  ): TRow {
    return (position === at) ? replace(row,) : row;
  },);
}

/**
 * Wording the repair lane decided in the cases where it decided one.
 */
const MENDED_NAP = 'The cat is asleep on the sill.';

/**
 * Evidence rows saying the repair lane decided that wording at the first slice.
 *
 * @returns Raw slice rows for the repair result
 *
 * @example
 * ```ts
 * const rows = repairDecidedRows();
 * ```
 */
function repairDecidedRows(): readonly Record<string, unknown>[] {
  return [
    {
      chunkIndex: 0,
      incumbentKind: 'present',
      incumbentText: ARCHIVE_NAP,
      outcome: {
        kind: 'decided',
        acceptedText: MENDED_NAP,
      },
    },
    {
      chunkIndex: 1,
      incumbentKind: 'absent',
      incumbentText: '',
      outcome: { kind: 'not-applicable', },
    },
  ];
}

/**
 * A ledger whose rows all claim the first slice.
 *
 * @param rows - ledger to collapse
 *
 * @returns Same rows, every one naming slice 0
 *
 * @example
 * ```ts
 * const rows = allNamingSliceZero({ rows: repairLedger(), },);
 * ```
 */
function allNamingSliceZero(
  { rows, }: { readonly rows: readonly ArtifactDeliveryRowV2[]; },
): readonly ArtifactDeliveryRowV2[] {
  return rows.map(function nameZero(row,): ArtifactDeliveryRowV2 {
    return {
      ...row,
      chunkIndex: 0,
    };
  },);
}

/**
 * Raw slice rows collapsed the same way, so a lane still agrees with itself and
 * only the repeat is left to catch.
 *
 * @param rows - raw slice rows to collapse
 *
 * @returns Same rows, every one naming slice 0
 *
 * @example
 * ```ts
 * const rows = evidenceNamingSliceZero({ rows: raw.sliceTexts, },);
 * ```
 */
function evidenceNamingSliceZero(
  { rows, }: { readonly rows: readonly Record<string, unknown>[]; },
): readonly Record<string, unknown>[] {
  return rows.map(function nameZero(row,): Record<string, unknown> {
    return {
      ...row,
      chunkIndex: 0,
    };
  },);
}

await describe({
  name: parseSettledArtifactV2.name,
  children: [
    it({
      name:
        'reports an artifact written before archiveText existed as UNRECORDED rather than as empty, '
        + 'since a file that never carried the field cannot say the entry had no English',
      fn: async () => {
        const parsed = parseSettledArtifactV2({ value: artifactWith(), },);
        expect(parsed.preparation
          .archiveText
          .kind,).toBe('unrecorded',);
      },
    },),
    it({
      name: 'ROUND-TRIPS the archive text an artifact does carry',
      fn: async () => {
        /**
         * Invented archive English, cat-themed, standing in for an entry's whole
         * translation.
         */
        const held = '## A cat\'s day\n\nThe kitten dozes on the windowsill.\n';
        /**
         * The fixture's own preparation, extended through the helper's field
         * escape hatch rather than by spreading its `unknown` value.
         */
        const preparation = artifactWith()
          .preparation as Record<string, unknown>;
        const parsed = parseSettledArtifactV2({
          value: artifactWith({
            preparation: {
              ...preparation,
              archiveText: held,
            },
          },),
        },);
        expect(parsed.preparation
          .archiveText
          .kind,).toBe('stored',);
        expect((parsed.preparation
          .archiveText
          .kind === 'stored')
          ? parsed.preparation
            .archiveText
            .text
          : '',).toBe(held,);
      },
    },),
    it({
      name: 'REFUSES an archiveText that is not a string, rather than coercing it',
      fn: async () => {
        /**
         * {@inheritDoc preparation}
         */
        const preparation = artifactWith()
          .preparation as Record<string, unknown>;
        expect(function readWrong() {
          parseSettledArtifactV2({
            value: artifactWith({
              preparation: {
                ...preparation,
                archiveText: 42,
              },
            },),
          },);
        },).toThrow('archiveText',);
      },
    },),
    it({
      name:
        'reads a whole artifact, RECOMPUTES its comparison, and hands back each raw lane result unread: '
        + 'a reader wanting a field this version does not check gets it from the artifact rather than '
        + 'from a later generation of this parser',
      fn: async () => {
        /**
         * One valid artifact, read back.
         */
        const parsed = parseSettledArtifactV2({ value: artifactWith(), },);
        expect(parsed.id,).toBe('CatEntry1',);
        expect(parsed.preparation
          .identity,).toBe(PREPARATION_IDENTITY,);
        expect(parsed.lanes
          .repair
          .evidence
          .status,).toBe('unchanged',);
        expect(parsed.lanes
          .translate
          .evidence
          .status,).toBe('unfilled',);
        expect(parsed.comparison
          .map(function toVerdict(row,): string {
            return row.verdict;
          },),).toEqual([
          'translate-only',
          'gap-remains',
        ],);

        // The whole raw record, including fields version 2 never described.
        expect(parsed.lanes
          .repair
          .raw
          .repairedText,).toBe(`## Section one\n\n${ARCHIVE_NAP}`,);
        expect(parsed.laneSelection,).toEqual({ kind: 'pending-human-decision', },);
      },
    },),
    it({
      name:
        'REFUSES a key on a lane ENVELOPE and ACCEPTS the same key inside that lane`s RESULT, which is '
        + 'the schema-ownership rule in one pair: version 2 says a lane is a result beside a ledger, and '
        + 'says nothing at all about what a result holds',
      fn: async () => {
        expect(function extraOnEnvelope() {
          parseSettledArtifactV2({
            value: artifactWith({
              lanes: {
                repair: {
                  result: repairResult(),
                  delivery: repairLedger(),
                  whiskers: 3,
                },
                translate: {
                  result: translateResult(),
                  delivery: translateLedger(),
                },
              },
            },),
          },);
        },).toThrow('lanes.repair.whiskers',);
        expect(parseSettledArtifactV2({
          value: artifactWith({
            repairRaw: {
              ...repairResult(),
              whiskers: 3,
            },
          },),
        },).lanes
          .repair
          .raw
          .whiskers,).toBe(3,);
      },
    },),
    it({
      name:
        'REFUSES a nested `null` in the call configuration and ACCEPTS one in an unknown raw addition: '
        + 'the writer controls every byte of the first and leaves an unset key out, and controls none of '
        + 'the second',
      fn: async () => {
        expect(function nullInConfig() {
          parseSettledArtifactV2({ value: artifactWith({ callConfig: { budget: { slice: null, }, }, },), },);
        },).toThrow('CatEntry1.callConfig.budget.slice',);
        expect(parseSettledArtifactV2({
          value: artifactWith({
            translateRaw: {
              ...translateResult(),
              confidence: { perSlice: null, },
            },
          },),
        },).lanes
          .translate
          .raw
          .confidence,).toEqual({ perSlice: null, },);
      },
    },),
    it({
      name:
        'REFUSES a raw result whose slices are in the WRONG ORDER, even though every row is right: the '
        + 'ledger and the result are joined by position because both are stated in document order, and '
        + 'joining by slice index instead would report that everything matched',
      fn: async () => {
        /**
         * The repair result with its two correct rows swapped.
         */
        const raw = repairResult();
        expect(function rowsOutOfOrder() {
          parseSettledArtifactV2({
            value: artifactWith({
              repairRaw: {
                ...raw,
                sliceTexts: (raw.sliceTexts as readonly unknown[]).toReversed(),
              },
            },),
          },);
        },).toThrow('lanes.repair.delivery[0].chunkIndex',);
      },
    },),
    it({
      name:
        'REFUSES two ledgers of equal length covering DIFFERENT slices, which a length check alone reads '
        + 'as a matching pair and which no later join could recover from',
      fn: async () => {
        /**
         * Translate ledger renumbered so it covers slices 1 and 2.
         */
        const shifted = translateLedger().map(function renumber(row,): ArtifactDeliveryRowV2 {
          return {
            ...row,
            chunkIndex: row.chunkIndex + 1,
          };
        },);

        /**
         * Its raw result renumbered the same way, so the lane agrees with
         * itself and only the two LANES disagree.
         */
        const raw = translateResult();
        expect(function coverageDiffers() {
          parseSettledArtifactV2({
            value: artifactWith({
              translateDelivery: shifted,
              translateRaw: {
                ...raw,
                shippedChunkIndices: [1,],
                sliceTexts: (raw.sliceTexts as readonly Record<string, unknown>[])
                  .map(function renumber(row,): Record<string, unknown> {
                    return {
                      ...row,
                      chunkIndex: (row.chunkIndex as number) + 1,
                    };
                  },),
              },
              comparison: [],
            },),
          },);
        },).toThrow('position 0 names slice 0',);
      },
    },),
    it({
      name:
        'REFUSES a ledger that names one slice TWICE, which every other relation reads as a matching '
        + 'pair: the evidence joins by POSITION and agrees, the two lanes join by position and agree, '
        + 'and the row count still equals the prepared slice count',
      fn: async () => {
        /**
         * Repair ledger whose two rows both claim slice 0.
         */
        const collapsedRepair = allNamingSliceZero({ rows: repairLedger(), },);

        /**
         * Translate ledger collapsed the same way.
         */
        const collapsedTranslate = allNamingSliceZero({ rows: translateLedger(), },);

        // POSITIVE CONTROL for what this case is about: the frozen comparison
        // reads these two ledgers as a matching pair, so a reader that ran only
        // the cross-lane rules would have accepted the repeat.
        expect(
          compareLanesV2({
            repair: collapsedRepair,
            translate: collapsedTranslate,
          },).length,
        ).toBe(2,);

        /**
         * Repair raw result whose slice rows are collapsed to match.
         */
        const repairRaw = repairResult();

        /**
         * Translate raw result on the same footing, its shipped set still
         * naming the slice its first row shipped.
         */
        const translateRaw = translateResult();
        expect(function slicesRepeat() {
          parseSettledArtifactV2({
            value: artifactWith({
              repairDelivery: collapsedRepair,
              translateDelivery: collapsedTranslate,
              repairRaw: {
                ...repairRaw,
                sliceTexts: evidenceNamingSliceZero({
                  rows: repairRaw.sliceTexts as readonly Record<string, unknown>[],
                },),
              },
              translateRaw: {
                ...translateRaw,
                sliceTexts: evidenceNamingSliceZero({
                  rows: translateRaw.sliceTexts as readonly Record<string, unknown>[],
                },),
              },
            },),
          },);
        },).toThrow('this row names 0, so the rows are a repeat',);
      },
    },),
    it({
      name:
        'REFUSES a ledger whose rows are PERMUTED rather than repeated, which the first version of this '
        + 'check let through: distinctness was the rule, and a ledger naming slice 1 then slice 0 is '
        + 'perfectly distinct while every positional join in this reader reads each row against the '
        + 'wrong slice of the preparation',
      fn: async () => {
        // Both ledgers reversed, so each lane still agrees with itself and with
        // the other, and only the anchor to document order is broken.
        /**
         * Repair ledger in the wrong order.
         */
        const flippedRepair = repairLedger()
          .toReversed();

        /**
         * Translate ledger flipped the same way.
         */
        const flippedTranslate = translateLedger()
          .toReversed();

        // POSITIVE CONTROL: the frozen comparison reads the two flipped ledgers
        // as a matching pair, so nothing outside this check was going to notice.
        expect(
          compareLanesV2({
            repair: flippedRepair,
            translate: flippedTranslate,
          },).length,
        ).toBe(2,);

        /**
         * Repair raw result with its slice rows flipped to match.
         */
        const repairRaw = repairResult();

        /**
         * Translate raw result on the same footing.
         */
        const translateRaw = translateResult();
        expect(function slicesPermuted() {
          parseSettledArtifactV2({
            value: artifactWith({
              repairDelivery: flippedRepair,
              translateDelivery: flippedTranslate,
              repairRaw: {
                ...repairRaw,
                sliceTexts: (repairRaw.sliceTexts as readonly Record<string, unknown>[]).toReversed(),
              },
              translateRaw: {
                ...translateRaw,
                sliceTexts: (translateRaw.sliceTexts as readonly Record<string, unknown>[]).toReversed(),
              },
            },),
          },);
        },).toThrow('this row names 0, so the rows are out of order',);
      },
    },),
    it({
      name:
        'ACCEPTS a BLOCKED repair run that withdrew nothing by assembly, which is the case a reader that '
        + 'recomputed the status would refuse: a blocked run whose slices all agreed with the archive '
        + 'produces no withdrawal at all, and is an ordinary artifact',
      fn: async () => {
        expect(parseSettledArtifactV2({
          value: artifactWith({
            repairRaw: {
              ...repairResult(),
              status: 'blocked-non-translation',
            },
          },),
        },).lanes
          .repair
          .evidence
          .status,).toBe('blocked-non-translation',);
      },
    },),
    it({
      name:
        'REFUSES a run whose status and deliveries could not have happened together, in both directions: '
        + 'an unblocked run carrying a withdrawal by whole-document refusal, and a blocked one carrying a '
        + 'shipped replacement, since a blocked run never assembles anything',
      fn: async () => {
        /**
         * An unblocked run naming the refusal that only a blocked one produces.
         */
        const refusedWhileRunning = rowReplaced({
          rows: repairLedger(),
          at: 0,
          replace: function withdrawByRefusal(row,): ArtifactDeliveryRowV2 {
            return {
              ...row,
              outcome: {
                kind: 'decided',
                acceptedText: MENDED_NAP,
              },
              delivery: {
                kind: 'replacement-withdrawn',
                reason: 'blocked-non-translation',
              },
            };
          },
        },);
        expect(function unblockedRefusal() {
          parseSettledArtifactV2({
            value: artifactWith({
              repairDelivery: refusedWhileRunning,
              repairRaw: {
                ...repairResult(),
                sliceTexts: repairDecidedRows(),
              },
            },),
          },);
        },).toThrow('lanes.repair.result.status',);

        /**
         * A blocked run naming a slice its document carries.
         */
        const shippedWhileBlocked = rowReplaced({
          rows: repairLedger(),
          at: 0,
          replace: function shipIt(row,): ArtifactDeliveryRowV2 {
            return {
              ...row,
              outcome: {
                kind: 'decided',
                acceptedText: MENDED_NAP,
              },
              shippedText: MENDED_NAP,
              delivery: { kind: 'replacement-shipped', },
            };
          },
        },);
        expect(function blockedShipping() {
          parseSettledArtifactV2({
            value: artifactWith({
              repairDelivery: shippedWhileBlocked,
              repairRaw: {
                ...repairResult(),
                status: 'blocked-non-translation',
                shippedChunkIndices: [0,],
                sliceTexts: repairDecidedRows(),
              },
            },),
          },);
        },).toThrow('lanes.repair.result.status',);
      },
    },),
    it({
      name:
        'REFUSES an index set the ledger rows do not produce, and reads the WITHDRAWN set as the '
        + 'assembly guard`s alone: a run refused as a whole never assembled anything, so counting its '
        + 'withdrawals would make every blocked document look like one the guard tore apart',
      fn: async () => {
        expect(function shippedDisagrees() {
          parseSettledArtifactV2({
            value: artifactWith({
              repairRaw: {
                ...repairResult(),
                shippedChunkIndices: [0,],
              },
            },),
          },);
        },).toThrow('lanes.repair.result.shippedChunkIndices',);

        /**
         * A blocked run whose blocked withdrawal stays OUT of the withdrawn
         * list, which is what the writer produces.
         */
        const withdrawnByRefusal = rowReplaced({
          rows: repairLedger(),
          at: 0,
          replace: function withdrawByRefusal(row,): ArtifactDeliveryRowV2 {
            return {
              ...row,
              outcome: {
                kind: 'decided',
                acceptedText: MENDED_NAP,
              },
              delivery: {
                kind: 'replacement-withdrawn',
                reason: 'blocked-non-translation',
              },
            };
          },
        },);
        expect(parseSettledArtifactV2({
          value: artifactWith({
            repairDelivery: withdrawnByRefusal,
            repairRaw: {
              ...repairResult(),
              status: 'blocked-non-translation',
              sliceTexts: repairDecidedRows(),
            },
          },),
        },).lanes
          .repair
          .evidence
          .withdrawnChunkIndices,).toEqual([],);
      },
    },),
    it({
      name:
        'REFUSES a row whose two axes cannot both be true, which every field parsing on its own cannot '
        + 'catch: a document carrying a shipped replacement at a slice its lane says it had nothing to '
        + 'do at is a row this reader would otherwise hand on as fact',
      fn: async () => {
        expect(function axesDisagree() {
          parseSettledArtifactV2({
            value: artifactWith({
              repairDelivery: rowReplaced({
                rows: repairLedger(),
                at: 1,
                replace: function shipAtGap(row,): ArtifactDeliveryRowV2 {
                  return {
                    ...row,
                    delivery: { kind: 'replacement-shipped', },
                  };
                },
              },),
            },),
          },);
        },).toThrow('lanes.repair.delivery[1]',);
      },
    },),
    it({
      name:
        'REFUSES a recorded comparison the ledgers do not derive, since a stored comparison is a claim '
        + 'about two ledgers stored beside it and nothing has to trust it',
      fn: async () => {
        /**
         * The derived comparison with one verdict changed to something the rows
         * do not produce.
         */
        const retitled = compareLanesV2({
          repair: repairLedger(),
          translate: translateLedger(),
        },)
          .map(function retitleFirst(
            row,
            position,
          ): Record<string, unknown> {
            return (position === 0)
              ? {
                ...row,
                verdict: 'both-agree',
              }
              : row;
          },);
        expect(function comparisonDisagrees() {
          parseSettledArtifactV2({ value: artifactWith({ comparison: retitled, },), },);
        },).toThrow('CatEntry1.comparison[0]',);
      },
    },),
    it({
      name:
        'ACCEPTS a recorded comparison whose rows carry the same values in a different KEY ORDER, which '
        + 'is what a file read off disk holds: key order is not part of what a row says, and refusing it '
        + 'would fail artifacts over a difference no reader can see',
      fn: async () => {
        /**
         * The same comparison with every key written in the opposite order.
         */
        const reordered = compareLanesV2({
          repair: repairLedger(),
          translate: translateLedger(),
        },)
          .map(function reverseKeys(row,): Record<string, unknown> {
            return Object.fromEntries(Object.entries(row,)
              .toReversed(),);
          },);
        expect(parseSettledArtifactV2({ value: artifactWith({ comparison: reordered, },), },).comparison
          .length,).toBe(2,);
      },
    },),
    it({
      name:
        'REFUSES text that differs only by Unicode COMPOSITION, since the contract compares character '
        + 'for character with no normalization: a reader that quietly normalized would report two '
        + 'derivations as agreeing when the bytes on disk do not',
      fn: async () => {
        /**
         * Archive wording written composed in the ledger.
         */
        const composed = 'The cat naps in the café.';

        // BOTH DOCUMENTS carry the composed wording, so the two lanes agree
        // with each other and the only disagreement left is INSIDE the repair
        // lane, between its raw result and its own ledger. Leaving the translate
        // side alone would make the lanes disagree first, and this case would
        // pass on a refusal it is not about.
        expect(function compositionDiffers() {
          parseSettledArtifactV2({
            value: artifactWith({
              translateDelivery: rowReplaced({
                rows: translateLedger(),
                at: 0,
                replace: function composeIncumbent(row,): ArtifactDeliveryRowV2 {
                  return {
                    ...row,
                    incumbentText: composed,
                  };
                },
              },),
              translateRaw: {
                ...translateResult(),
                sliceTexts: rowReplaced({
                  rows: translateResult().sliceTexts as readonly Record<string, unknown>[],
                  at: 0,
                  replace: function composeIncumbent(row,): Record<string, unknown> {
                    return {
                      ...row,
                      incumbentText: composed,
                    };
                  },
                },),
              },
              repairDelivery: rowReplaced({
                rows: repairLedger(),
                at: 0,
                replace: function composeThroughout(row,): ArtifactDeliveryRowV2 {
                  return {
                    ...row,
                    incumbentText: composed,
                    shippedText: composed,
                    outcome: {
                      kind: 'decided',
                      acceptedText: composed,
                    },
                  };
                },
              },),
              repairRaw: {
                ...repairResult(),
                sliceTexts: rowReplaced({
                  rows: repairResult().sliceTexts as readonly Record<string, unknown>[],
                  at: 0,
                  replace: function decomposeIncumbent(row,): Record<string, unknown> {
                    return {
                      ...row,
                      incumbentText: composed.normalize('NFD',),
                      outcome: {
                        kind: 'decided',
                        acceptedText: composed.normalize('NFD',),
                      },
                    };
                  },
                },),
              },
            },),
          },);
        },).toThrow('lanes.repair.delivery[0].incumbentText',);
      },
    },),
    it({
      name:
        'REFUSES every version but its own, including a MISSING one and a version 2 spelled as text: '
        + 'dispatch has already chosen this reader by the time it is called, so a file arriving here '
        + 'under another version is a caller reading the wrong file',
      fn: async () => {
        expect([
          undefined,
          null,
          '2',
          1,
          3,
        ].map(function refuses(version,): string {
          try {
            parseSettledArtifactV2({ value: artifactWith({ artifactSchemaVersion: version, },), },);
            return 'accepted';
          } catch (error) {
            return Error.isError(error,) ? error.name : 'threw a non-error';
          }
        },),).toEqual([
          'ArtifactParseError',
          'ArtifactParseError',
          'ArtifactParseError',
          'ArtifactParseError',
          'ArtifactParseError',
        ],);
      },
    },),
    it({
      name:
        'ACCEPTS an identity that is syntactically an identity and describes some other preparation, '
        + 'which pins the SYNTAX-ONLY boundary: the inputs the identity hashes are not in the file, so a '
        + 'standalone reader cannot tell one from another and must not pretend otherwise',
      fn: async () => {
        /**
         * A well formed identity of a preparation nobody here ran.
         */
        const foreign = `sha256-preparation-v1:${'bd'.repeat(32,)}`;
        expect(parseSettledArtifactV2({
          value: artifactWith({
            preparation: {
              identity: foreign,
              sliceCount: 2,
              sourceChars: 40,
              targetChars: 60,
              sourceBytes: 90,
              alignmentPairCount: 2,
              alignmentFindings: [],
            },
          },),
        },).preparation
          .identity,).toBe(foreign,);
        expect(function badIdentity() {
          parseSettledArtifactV2({
            value: artifactWith({
              preparation: {
                identity: 'sha256-preparation-v1:cafe',
                sliceCount: 2,
                sourceChars: 40,
                targetChars: 60,
                sourceBytes: 90,
                alignmentPairCount: 2,
                alignmentFindings: [],
              },
            },),
          },);
        },).toThrow('CatEntry1.preparation.identity',);
      },
    },),
    it({
      name:
        'REFUSES a translate lane whose counts or status disagree with what it recorded per slice, which '
        + 'is the lane`s own arithmetic checked against its own rows',
      fn: async () => {
        expect(function countDisagrees() {
          parseSettledArtifactV2({
            value: artifactWith({
              translateRaw: {
                ...translateResult(),
                changedSliceCount: 2,
              },
            },),
          },);
        },).toThrow('lanes.translate.result.changedSliceCount',);
        expect(function statusDisagrees() {
          parseSettledArtifactV2({
            value: artifactWith({
              translateRaw: {
                ...translateResult(),
                status: 'complete',
              },
            },),
          },);
        },).toThrow('lanes.translate.result.status',);
      },
    },),
    it({
      name:
        'CARRIES THE REPAIR LANE`S BALLOTS THROUGH, verbatim reasons included, which is the whole '
        + 'reason the rounds are recorded: this lane can delete a declared name from a translation, '
        + 'and until the rounds landed in the artifact the only way to see it happen was to run a '
        + 'live probe against the real judging sheet',
      fn: async () => {
        /**
         * One judged round of the shape the editor stage now records.
         */
        const round = {
          kind: 'selected',
          stage: 'envelope',
          envelopeId: 'envelope/nap',
          slate: [
            {
              index: 1,
              rendered: 'Mittens the Cat naps on the sill.',
              hash: 'hash-with-alias',
              producer: {
                kind: 'model',
                modelId: 'hf:openai/gpt-oss-120b',
              },
            },
            {
              index: 2,
              rendered: 'The cat naps on the sill.',
              hash: 'hash-without-alias',
              producer: {
                kind: 'model',
                modelId: 'hf:zai-org/GLM-5.2',
              },
            },
          ],
          ballots: [
            {
              modelId: 'hf:Qwen/Qwen3.8-27B',
              best: 2,
              reason: 'the alias has no basis in the original',
              weight: 1,
            },
          ],
          tally: {
            judgesAvailable: 1,
            ballots: 1,
            abstentions: 0,
            selfVotes: 0,
          },
          perCandidate: [],
          selectedIndex: 2,
          voteWeight: 1,
        };

        /**
         * Artifact JSON as a settled file holds it, round-tripped through the
         * serialization a written artifact actually goes through.
         */
        const written = JSON.parse(JSON.stringify(artifactWith({
          repairRaw: {
            ...repairResult(),
            chunks: [
              {
                chunkIndex: 0,
                rounds: [round,],
                droppedDeclaredNames: ['Mittens the Cat',],
              },
            ],
          },
        },),),) as unknown;

        /**
         * Repair lane as a reader gets it back.
         */
        const { raw, } = parseSettledArtifactV2({ value: written, },)
          .lanes
          .repair;
        expect(raw.chunks,).toEqual([
          {
            chunkIndex: 0,
            rounds: [round,],
            droppedDeclaredNames: ['Mittens the Cat',],
          },
        ],);
      },
    },),
    it({
      name:
        'REFUSES a lane selection naming a decision nobody has made, so a later generation that recorded '
        + 'one cannot be read as though this file already carried it',
      fn: async () => {
        expect(function unknownSelection() {
          parseSettledArtifactV2({ value: artifactWith({ laneSelection: { kind: 'translate', }, },), },);
        },).toThrow('CatEntry1.laneSelection.kind',);
      },
    },),
  ],
},);
