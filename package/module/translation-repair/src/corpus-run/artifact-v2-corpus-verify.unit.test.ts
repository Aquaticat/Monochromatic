/**
 * Tests for checking a version 2 artifact against a preparation.
 *
 * WHAT THESE PIN is the boundary the standalone reader has to leave open. That
 * reader checks the recorded preparation identity for SYNTAX and nothing more,
 * because the inputs the identity hashes are not in the file; these cases run
 * the same artifact against a preparation somebody rebuilt, which is the only
 * way the question gets answered.
 *
 * The preparation here is a REAL one from `prepareDocumentPair` rather than a
 * hand-built stand-in, so the identity, the slices and every measurement come
 * from the same code a corpus pass runs.
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
  buildSettledArtifactV2,
  type DocumentLanesResult,
  parseSettledArtifactV2,
  type PipelineDigest,
  preparationIdentity,
  prepareDocumentPair,
  type PreparedDocumentPair,
  type SliceDeliveryRecord,
  verifyArtifactV2AgainstPreparation,
} from '../../dist/final/node/index.mjs';

/**
 * Original document, two sections a preparation slices apart.
 */
const SOURCE_DOC = '## 第一节\n\n猫猫在窗台上睡觉。\n\n## 第二节\n\n猫猫有自己的碗。\n';

/**
 * Archive translation of it, structured the same way.
 */
const TARGET_DOC = '## Section one\n\nThe cat sleeps on the sill.\n\n## Section two\n\nThe cat has a bowl.\n';

/**
 * A second pair, which no artifact here describes.
 */
const OTHER_SOURCE_DOC = '## 第一节\n\n猫猫在门口等着。\n\n## 第二节\n\n猫猫喜欢晒太阳。\n';

/**
 * Its archive translation.
 */
const OTHER_TARGET_DOC = '## Section one\n\nThe cat waits by the door.\n\n## Section two\n\nThe cat likes the sun.\n';

/**
 * Built pipeline these fixtures claim to have run under.
 */
const DIGEST = 'sha256-tree-v1:'.concat('c'.repeat(64,),) as unknown as PipelineDigest;

/**
 * One lane ledger over a real preparation, where the lane examined every slice
 * and kept what the archive already said.
 *
 * @param prepared - preparation to build rows from
 *
 * @returns One row per prepared slice, in document order
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
       * Archive wording at this slice, which the lane decided to keep.
       */
      const incumbentText = slice.target
        .text;
      return {
        chunkIndex: slice.target
          .chunkIndex,
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
 * What one lane's raw result reports about those rows.
 *
 * @param rows - ledger the result describes
 *
 * @returns Raw result fields version 2 requires, shared by both lanes here
 *
 * @example
 * ```ts
 * const raw = rawResultFor({ rows, },);
 * ```
 */
function rawResultFor(
  { rows, }: { readonly rows: readonly SliceDeliveryRecord[]; },
): Record<string, unknown> {
  return {
    sliceCount: rows.length,
    shippedChunkIndices: [],
    withdrawnChunkIndices: [],

    // The two counts the translate lane reports beside its lists. Harmless on
    // the repair result, whose evidence core does not name them, and required
    // on the other side.
    changedSliceCount: 0,
    withdrawnSliceCount: 0,
    sliceTexts: rows.map(function toEvidence(row,): Record<string, unknown> {
      return {
        chunkIndex: row.chunkIndex,
        incumbentKind: row.incumbentKind,
        incumbentText: row.incumbentText,
        outcome: row.outcome,
      };
    },),
  };
}

/**
 * Builds one artifact over a real preparation and reads it back.
 *
 * THROUGH JSON on the way, because that is what a reader holds: the writer's
 * object and the file are two different things, and a check that skipped the
 * serialization would not be reading an artifact at all.
 *
 * @param prepared - preparation both lanes ran over
 *
 * @returns Artifact as the version 2 reader returns it
 *
 * @example
 * ```ts
 * const artifact = writeAndRead({ prepared, },);
 * ```
 */
function writeAndRead(
  { prepared, }: { readonly prepared: PreparedDocumentPair; },
): ReturnType<typeof parseSettledArtifactV2> {
  /**
   * Rows both lanes report, which are the same here: neither moved.
   */
  const rows = keptEverything({ prepared, },);

  /**
   * Name this preparation gives itself, stamped on both ledgers by the driver.
   */
  const identity = preparationIdentity({ prepared, },);

  /**
   * What the driver returned.
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
   * What the writer assembled, still an object in memory.
   */
  const written = buildSettledArtifactV2({
    entryId: 'CatEntry1',
    tip: 'a'.repeat(40,),
    pipelineDigest: DIGEST,
    corpusSha: 'b'.repeat(40,),
    callConfig: { perCallTimeoutMs: 600_000, },
    durationMs: 1_234,
    prepared,
    lanes,
    laneSelection: { kind: 'pending-human-decision', },
  },);

  // THROUGH THE SERIALIZED FORM, deliberately, rather than a structured clone:
  // what a reader holds is the bytes a file carries, and a clone would preserve
  // things JSON drops.
  const serialized = JSON.stringify(written,);
  return parseSettledArtifactV2({ value: JSON.parse(serialized,), },);
}

await describe({
  name: verifyArtifactV2AgainstPreparation.name,
  children: [
    it({
      name:
        'ACCEPTS an artifact against the preparation it was written over, which is the only way the '
        + 'recorded identity is ever checked for more than syntax: the file stores measurements of the '
        + 'two documents rather than the documents, so nothing in it can recompute the name it carries',
      fn: async () => {
        /**
         * A real preparation of the cat pair.
         */
        const prepared = prepareDocumentPair({
          sourceText: SOURCE_DOC,
          targetText: TARGET_DOC,
        },);
        verifyArtifactV2AgainstPreparation({
          artifact: writeAndRead({ prepared, },),
          prepared,
        },);
      },
    },),
    it({
      name:
        'REFUSES the same artifact against a preparation of DIFFERENT documents, naming the identity it '
        + 'expected: a standalone reader accepts any syntactically valid identity, and this is the check '
        + 'that tells one preparation from another',
      fn: async () => {
        /**
         * Preparation the artifact describes.
         */
        const prepared = prepareDocumentPair({
          sourceText: SOURCE_DOC,
          targetText: TARGET_DOC,
        },);

        /**
         * A preparation of another pair entirely.
         */
        const otherPair = prepareDocumentPair({
          sourceText: OTHER_SOURCE_DOC,
          targetText: OTHER_TARGET_DOC,
        },);

        /**
         * Artifact written over the first.
         */
        const artifact = writeAndRead({ prepared, },);
        expect(function differentDocuments() {
          verifyArtifactV2AgainstPreparation({
            artifact,
            prepared: otherPair,
          },);
        },).toThrow('CatEntry1.preparation.identity',);
      },
    },),
    it({
      name:
        'REFUSES the same DOCUMENTS sliced under a different budget, which is the subtle half: the two '
        + 'preparations describe one pair of texts and pair different originals with different archive '
        + 'wordings, so an artifact read against the wrong one would report rows nobody produced',
      fn: async () => {
        /**
         * Preparation the artifact describes.
         */
        const prepared = prepareDocumentPair({
          sourceText: SOURCE_DOC,
          targetText: TARGET_DOC,
        },);

        /**
         * The same documents sliced far more finely.
         */
        const finer = prepareDocumentPair({
          sourceText: SOURCE_DOC,
          targetText: TARGET_DOC,
          sliceCharBudget: 8,
        },);

        // POSITIVE CONTROL for the case: unless the budget actually changed the
        // slicing, this would be checking an artifact against its own
        // preparation and passing for the wrong reason.
        expect(preparationIdentity({ prepared: finer, },),).not
          .toBe(preparationIdentity({ prepared, },),);
        expect(function differentSlicing() {
          verifyArtifactV2AgainstPreparation({
            artifact: writeAndRead({ prepared, },),
            prepared: finer,
          },);
        },).toThrow('CatEntry1.preparation.identity',);
      },
    },),
  ],
},);
