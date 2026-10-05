/**
 Test-only settled artifacts built over a real preparation, as the builder
 writes them: the rows keep every slice the archive has wording for and fill
 every insertion, which is enough for the builder's own checks. Moved out of
 `artifact-two-lane-rebuild.unit.test.ts` when `page-republish.unit.test.ts`
 needed the same artifacts.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  assertPipelineDigest,
  buildSettledTwoLaneArtifact,
  type DocumentLanesResult,
  NO_PAGE_ASSEMBLY,
  type PipelineDigest,
  preparationIdentity,
  type PreparedDocumentPair,
  type SettledArtifact,
  type SliceDeliveryRecord,
} from '../../dist/final/node/index.mjs';

/**
 Hex digits in a tree digest.
 */
const DIGEST_HEX_LENGTH = 64;

/**
 Hex digits in a git commit id.
 */
const COMMIT_HEX_LENGTH = 40;

/**
 Digest every fixture artifact claims, before it is checked for shape.
 */
const DIGEST_TEXT = `sha256-tree-v1:${'c'.repeat(DIGEST_HEX_LENGTH,)}`;
assertPipelineDigest(DIGEST_TEXT,);

/**
 Digest every fixture artifact claims.
 */
const FIXTURE_DIGEST: PipelineDigest = DIGEST_TEXT;

/**
 Wording a lane writes where the archive holds none.
 */
const FRESH_LINE = 'The cat has been given a line.';

/**
 Rows that keep every slice the archive has wording for, and fill every
 insertion, which is enough for the builder's own checks.

 A PAIRED PREPARATION LEAVES INSERTIONS: a section or block the pairing did
 not claim is placed as an insertion slice whose archive wording is absent,
 and the builder refuses a row calling that wording present.

 @param prepared - preparation the rows describe

 @returns One row per slice

 @example
 ```ts
 const rows = keptEverything({ prepared, },);
 ```
 */
function keptEverything(
  { prepared, }: { readonly prepared: PreparedDocumentPair; },
): readonly SliceDeliveryRecord[] {
  return prepared.slices
    .map(function toRow(slice,): SliceDeliveryRecord {
      /**
       Original and archive sides of this slice.
       */
      const {
        source,
        target,
      } = slice;
      if (target.kind === 'insertion') {
        return {
          sliceIndex: target.sliceIndex,
          sourceText: source.text,
          incumbentKind: 'absent',
          incumbentText: target.text,
          outcome: {
            kind: 'decided',
            acceptedText: FRESH_LINE,
          },
          shippedText: FRESH_LINE,
          delivery: { kind: 'replacement-shipped', },
        };
      }
      return {
        sliceIndex: target.sliceIndex,
        sourceText: source.text,
        incumbentKind: 'present',
        incumbentText: target.text,
        outcome: {
          kind: 'decided',
          acceptedText: target.text,
        },
        shippedText: target.text,
        delivery: { kind: 'incumbent-retained', },
      };
    },);
}

/**
 Both lanes' results for rows that kept everything: every insertion filled,
 nothing withdrawn, trimmed or refused.

 @param prepared - preparation the lanes ran over

 @returns Lane results the builder projects

 @example
 ```ts
 const lanes = keptLanes({ prepared, },);
 ```
 */
function keptLanes(
  { prepared, }: { readonly prepared: PreparedDocumentPair; },
): DocumentLanesResult {
  /**
   Rows the lanes report.
   */
  const rows = keptEverything({ prepared, },);

  /**
   Identity both ledgers claim.
   */
  const identity = preparationIdentity({ prepared, },);

  /**
   Slices that shipped a replacement, which are the insertions.
   */
  const changed = rows
    .filter(function wasShipped({ delivery, },): boolean {
      return delivery.kind === 'replacement-shipped';
    },)
    .map(function indexOf({ sliceIndex, },): number {
      return sliceIndex;
    },);

  /**
   What each slice was decided to carry, as both lanes report it.
   */
  const sliceTexts = rows.map(function toEvidence({
    sliceIndex,
    incumbentKind,
    incumbentText,
    outcome,
  },) {
    return {
      sliceIndex,
      incumbentKind,
      incumbentText,
      outcome,
    };
  },);

  return {
    alignmentFindings: [...prepared.alignmentFindings,],
    repair: {
      repairedText: prepared.targetText,
      status: 'unchanged',
      issues: [],
      findings: [],
      sliceCritics: [],
      sliceCount: rows.length,
      changedSliceIndices: changed,
      withdrawnSliceIndices: [],
      trimmedReplacements: [],
      sliceTexts,
      chunks: [],
    },
    translate: {
      translatedText: prepared.targetText,
      sliceCount: rows.length,
      changedSliceCount: changed.length,
      refusedSliceCount: 0,
      withdrawnSliceCount: 0,
      changedSliceIndices: changed,
      sliceSelections: [],
      withdrawnSliceIndices: [],
      trimmedReplacements: [],
      resumedSliceCount: 0,
      status: 'complete',
      unfilled: [],
      slices: [],
      sliceTexts,
      findings: [],
    },
    repairDelivery: {
      preparationIdentity: identity,
      records: rows,
    },
    translateDelivery: {
      preparationIdentity: identity,
      records: rows,
    },
  };
}

/**
 A settled artifact over a preparation, as the builder returns it, carrying
 the contest and consolidation records the caller states.

 @param prepared - preparation the artifact records

 @param entryId - entry the artifact settles

 @param laneSelection - contest record, stated because the builder takes any
 the artifact schema allows while a pass writes only one

 @param consolidation - consolidation record, stated for the same reason

 @returns The artifact object, unserialized

 @example
 ```ts
 const artifact = settledArtifactOver({ prepared, entryId: 'CatEntry1', laneSelection: { kind: 'pending-human-decision', }, consolidation: { kind: 'not-run', }, },);
 ```
 */
export function settledArtifactOver(
  {
    prepared,
    entryId,
    laneSelection,
    consolidation,
  }: {
    readonly prepared: PreparedDocumentPair;
    readonly entryId: string;
    readonly laneSelection: Parameters<typeof buildSettledTwoLaneArtifact>[0]['laneSelection'];
    readonly consolidation: Parameters<typeof buildSettledTwoLaneArtifact>[0]['consolidation'];
  },
): SettledArtifact {
  return buildSettledTwoLaneArtifact({
    pageAssembly: NO_PAGE_ASSEMBLY,
    entryId,
    tip: 'a'.repeat(COMMIT_HEX_LENGTH,),
    pipelineDigest: FIXTURE_DIGEST,
    corpusSha: 'b'.repeat(COMMIT_HEX_LENGTH,),
    callConfig: { perCallTimeoutMs: 600_000, },
    durationMs: 1_234,
    prepared,
    lanes: keptLanes({ prepared, },),
    laneSelection,
    consolidation,
  },);
}

/**
 A settled artifact over a preparation, as the bytes a file on disk carries.

 @param prepared - preparation the artifact records

 @param entryId - entry the artifact settles

 @returns The artifact's JSON text

 @example
 ```ts
 const value: unknown = JSON.parse(settledArtifactText({ prepared, entryId: 'CatEntry1', },),);
 ```
 */
export function settledArtifactText(
  {
    prepared,
    entryId,
  }: {
    readonly prepared: PreparedDocumentPair;
    readonly entryId: string;
  },
): string {
  /**
   The artifact as the builder writes it.
   */
  const built = settledArtifactOver({
    prepared,
    entryId,
    laneSelection: { kind: 'pending-human-decision', },
    consolidation: { kind: 'not-run', },
  },);
  return JSON.stringify(built,);
}
