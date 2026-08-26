/**
 * Tests for carving a document pair the way the run that settled it did.
 *
 * WHAT THESE PIN is that a recorded recipe reproduces the run's own slicing,
 * proved by the identity hash rather than by inspection, and that a missing
 * recipe half is named rather than guessed silently. Every rebuild case carries
 * a positive control showing the recipe actually moved the slicing, since a
 * fixture the deterministic aligner slices identically would pass for the
 * wrong reason.
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
  buildSettledTwoLaneArtifact,
  type DocumentLanesResult,
  parseSettledTwoLaneArtifact,
  type PipelineDigest,
  preparationIdentity,
  type PreparedDocumentPair,
  prepareDocumentPair,
  rebuildPreparation,
  type SliceDeliveryRecord,
} from '../../dist/final/node/index.mjs';

/**
 * Two sections, equal shape, so the deterministic aligner pairs by index and a
 * supplied crossing is visibly different.
 */
const SOURCE_DOC = '## 第一节\n\n猫猫在窗台上睡觉。\n\n## 第二节\n\n猫猫有自己的碗。\n';

/**
 * Translation of the same shape.
 */
const TARGET_DOC = '## Section one\n\nThe cat sleeps on the sill.\n\n## Section two\n\nThe cat has a bowl.\n';

/**
 * One section of three blocks each side, so a block pairing that declines the
 * middle block changes what the slice carries.
 */
const BLOCKY_SOURCE = '## 第一节\n\n猫猫在窗台上睡觉。\n\n猫猫喜欢晒太阳。\n\n猫猫有自己的碗。\n';

/**
 * Translation of the same three blocks.
 */
const BLOCKY_TARGET = '## Section one\n\nThe cat sleeps on the sill.\n\nThe cat likes the sun.\n\nThe cat has a bowl.\n';

/**
 * Digest every fixture artifact claims.
 */
const DIGEST = 'sha256-tree-v1:'.concat('c'.repeat(64,),) as unknown as PipelineDigest;

/**
 * Wording a lane writes where the archive holds none.
 */
const FRESH_LINE = 'The cat has been given a line.';

/**
 * Rows that keep every slice the archive has wording for, and fill every
 * insertion, which is enough for the builder's own checks.
 *
 * A PAIRED PREPARATION LEAVES INSERTIONS: a section or block the pairing did
 * not claim is placed as an insertion slice whose archive wording is absent,
 * and the builder refuses a row calling that wording present.
 *
 * @param prepared - preparation the rows describe
 *
 * @returns One row per slice
 *
 * @example
 * ```ts
 * const rows = keptEverything({ prepared, },);
 * ```
 */
function keptEverything(
  { prepared, }: { readonly prepared: PreparedDocumentPair; },
): readonly SliceDeliveryRecord[] {
  return prepared.slices
    .map(function toRow(slice,): SliceDeliveryRecord {
      /**
       * Archive wording of this slice, empty at an insertion.
       */
      const incumbentText = slice.target
        .text;

      /**
       * Whether the archive holds wording here at all.
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
 * Raw lane result consistent with rows that kept everything.
 *
 * @param rows - rows the result reports
 *
 * @returns Evidence core the builder projects
 *
 * @example
 * ```ts
 * const result = rawResultFor({ rows, },);
 * ```
 */
function rawResultFor(
  { rows, }: { readonly rows: readonly SliceDeliveryRecord[]; },
): Record<string, unknown> {
  /**
   * Slices the rows say shipped a replacement, which are the insertions.
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
 * Builds an artifact over a preparation and reads it back through JSON.
 *
 * @param prepared - preparation the artifact records
 *
 * @param strip - preparation keys to delete before parsing, which is how a
 * file written before those fields existed looks to a reader
 *
 * @returns Parsed artifact
 *
 * @example
 * ```ts
 * const artifact = writeAndRead({ prepared, strip: [], },);
 * ```
 */
function writeAndRead(
  {
    prepared,
    strip,
  }: {
    readonly prepared: PreparedDocumentPair;
    readonly strip: readonly string[];
  },
): ReturnType<typeof parseSettledTwoLaneArtifact> {
  /**
   * Rows the lanes report.
   */
  const rows = keptEverything({ prepared, },);

  /**
   * Identity both ledgers claim.
   */
  const identity = preparationIdentity({ prepared, },);

  /**
   * Lanes consistent with the preparation.
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
   * Artifact as the builder writes it, in its serialized form: what a reader
   * holds is the bytes a file carries, and a clone would keep things JSON drops.
   */
  const serialized = JSON.stringify(buildSettledTwoLaneArtifact({
    entryId: 'CatEntry1',
    tip: 'a'.repeat(40,),
    pipelineDigest: DIGEST,
    corpusSha: 'b'.repeat(40,),
    callConfig: { perCallTimeoutMs: 600_000, },
    durationMs: 1_234,
    prepared,
    lanes,
    laneSelection: { kind: 'pending-human-decision', },
    consolidation: { kind: 'not-run', },
  },),);

  /**
   * Those bytes read back.
   */
  const written = JSON.parse(serialized,) as Record<string, unknown>;

  /**
   * Preparation record, with the named keys removed.
   */
  const preparation = Object.fromEntries(
    Object.entries(written.preparation as Record<string, unknown>,)
      .filter(function kept([key,],): boolean {
        return !strip.includes(key,);
      },),
  );
  return parseSettledTwoLaneArtifact({
    value: {
      ...written,
      preparation,
    },
  },);
}

await describe({
  name: rebuildPreparation.name,
  children: [
    it({
      name:
        'REPRODUCES the run\'s own slicing from a recorded section pairing, proved by the identity hash: '
        + 'the deterministic aligner pairs these sections by index, the run crossed them, and the '
        + 'rebuild lands on the crossing rather than the index order',
      fn: async () => {
        /**
         * How the run carved it: sections crossed, block rounds asked and
         * silent.
         */
        const crossed = prepareDocumentPair({
          sourceText: SOURCE_DOC,
          targetText: TARGET_DOC,
          sectionPairing: [{
            source: 0,
            target: 1,
          },],
          blockPairings: new Map(),
        },);

        /**
         * How the bare aligner carves it.
         */
        const bare = prepareDocumentPair({
          sourceText: SOURCE_DOC,
          targetText: TARGET_DOC,
        },);

        // POSITIVE CONTROL: the crossing has to move the slicing.
        expect(preparationIdentity({ prepared: crossed, },),).not
          .toBe(preparationIdentity({ prepared: bare, },),);

        /**
         * Rebuild from what the artifact recorded.
         */
        const rebuilt = rebuildPreparation({
          artifact: writeAndRead({
            prepared: crossed,
            strip: [],
          },),
          sourceText: SOURCE_DOC,
          targetText: TARGET_DOC,
        },);
        expect(rebuilt.unrecorded,).toEqual([],);
        expect(preparationIdentity({ prepared: rebuilt.prepared, },),).toBe(
          preparationIdentity({ prepared: crossed, },),
        );
      },
    },),
    it({
      name:
        'REPRODUCES a recorded block pairing, keyed back by aligned section: a pairing that declines the '
        + 'middle block takes it out of the slice, and the rebuild carries the same slice text',
      fn: async () => {
        /**
         * How the run carved it: the middle block declined by the roster.
         */
        const declined = prepareDocumentPair({
          sourceText: BLOCKY_SOURCE,
          targetText: BLOCKY_TARGET,
          blockPairings: new Map([[
            0,
            [
              {
                source: 0,
                target: 0,
              },
              {
                source: 2,
                target: 2,
              },
            ],
          ],],),
        },);

        /**
         * How the bare aligner carves it.
         */
        const bare = prepareDocumentPair({
          sourceText: BLOCKY_SOURCE,
          targetText: BLOCKY_TARGET,
        },);

        // POSITIVE CONTROL: declining a block has to move the slicing.
        expect(preparationIdentity({ prepared: declined, },),).not
          .toBe(preparationIdentity({ prepared: bare, },),);

        /**
         * Rebuild from what the artifact recorded.
         */
        const rebuilt = rebuildPreparation({
          artifact: writeAndRead({
            prepared: declined,
            strip: [],
          },),
          sourceText: BLOCKY_SOURCE,
          targetText: BLOCKY_TARGET,
        },);
        expect(rebuilt.unrecorded,).toEqual([],);
        expect(preparationIdentity({ prepared: rebuilt.prepared, },),).toBe(
          preparationIdentity({ prepared: declined, },),
        );
      },
    },),
    it({
      name:
        'NAMES every recipe half a file does not record and rebuilds with the deterministic default, '
        + 'which is what every artifact settled before the fields existed looks like',
      fn: async () => {
        /**
         * Run carved deterministically, then recorded as an old file would be.
         */
        const bare = prepareDocumentPair({
          sourceText: SOURCE_DOC,
          targetText: TARGET_DOC,
        },);

        /**
         * Rebuild from a file carrying neither half.
         */
        const rebuilt = rebuildPreparation({
          artifact: writeAndRead({
            prepared: bare,
            strip: [
              'sectionPairing',
              'blockPairing',
            ],
          },),
          sourceText: SOURCE_DOC,
          targetText: TARGET_DOC,
        },);
        expect(rebuilt.unrecorded,).toEqual([
          'sectionPairing',
          'blockPairing',
        ],);
        expect(preparationIdentity({ prepared: rebuilt.prepared, },),).toBe(
          preparationIdentity({ prepared: bare, },),
        );
      },
    },),
    it({
      name:
        'NAMES only the missing half when the other is recorded, so a reader can say which default was '
        + 'guessed rather than reporting a whole recipe as absent',
      fn: async () => {
        /**
         * Run that asked the block rounds and recorded them, read through a
         * file that lost the section decider.
         */
        const asked = prepareDocumentPair({
          sourceText: SOURCE_DOC,
          targetText: TARGET_DOC,
          blockPairings: new Map(),
        },);
        expect(rebuildPreparation({
          artifact: writeAndRead({
            prepared: asked,
            strip: ['sectionPairing',],
          },),
          sourceText: SOURCE_DOC,
          targetText: TARGET_DOC,
        },).unrecorded,).toEqual(['sectionPairing',],);
      },
    },),
  ],
},);
