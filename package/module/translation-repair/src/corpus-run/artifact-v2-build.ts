import type { DocumentLanesResult, } from '../document-lanes.ts';
import type { PreparedDocumentPair, } from '../document-preparation.ts';
import { compareDocumentLanes, } from '../lane-comparison.ts';
import { preparationIdentity, } from '../preparation-identity.ts';
import { sourceBytesOf, } from '../sample-grading.ts';
import {
  ARTIFACT_SCHEMA_VERSION_V2,
  type ArtifactJsonValue,
  type SettledArtifactV2,
} from './artifact-v2-contract.ts';
import type { PipelineDigest, } from './pipeline-digest.ts';

//region Artifact version 2 build
// The one place a two-lane artifact is assembled.
//
// EVERYTHING DERIVABLE IS DERIVED HERE rather than passed in beside what it
// was derived from. Version 1 took a status and two counts as parameters next
// to the result they described, so a caller could state a status the result
// contradicted, and the fields a reader trusts most were the ones least tied to
// what actually ran. The counts moved onto the result in `e4f857c83`; this
// takes the same rule further, since the preparation identity and the whole
// lane comparison are also things nobody should be able to supply.
//
// So the parameters are exactly what cannot be computed from the run: which
// entry it was, which commit and pipeline produced it, which corpus commit the
// texts came from, how the models were called, and how long it took.

/**
 * Assembles one settled entry's version 2 artifact.
 *
 * @param entryId - corpus entry this covers
 *
 * @param tip - repository head when the pass started, as provenance
 *
 * @param pipelineDigest - built output that ran, as identity
 *
 * @param corpusSha - corpus commit the two texts were read at
 *
 * @param callConfig - model call configuration this run used
 *
 * @param durationMs - wall time the entry took, both lanes included
 *
 * @param prepared - preparation both lanes ran over, which supplies the
 * identity and every measurement rather than being measured by the caller
 *
 * @param lanes - what both lanes returned, with the ledgers derived from them
 *
 * @returns Artifact ready to serialize
 *
 * @throws {@link LaneComparisonError} when the two ledgers cannot be compared,
 * which is a defect in the run rather than in this artifact: an entry whose
 * lanes disagree about their own preparation has nothing worth writing
 *
 * @example
 * ```ts
 * const artifact = buildSettledArtifactV2({ entryId, tip, pipelineDigest, ... },);
 * ```
 */
export function buildSettledArtifactV2(
  {
    entryId,
    tip,
    pipelineDigest,
    corpusSha,
    callConfig,
    durationMs,
    prepared,
    lanes,
  }: {
    readonly entryId: string;
    readonly tip: string;
    readonly pipelineDigest: PipelineDigest;
    readonly corpusSha: string;
    readonly callConfig: Readonly<Record<string, ArtifactJsonValue>>;
    readonly durationMs: number;
    readonly prepared: PreparedDocumentPair;
    readonly lanes: DocumentLanesResult;
  },
): SettledArtifactV2 {
  /**
   * Name this slicing gives itself, computed from the preparation rather than
   * taken from a caller, so the identity an artifact records is the identity of
   * the thing the artifact describes.
   */
  const identity = preparationIdentity({ prepared, },);

  /**
   * The two lanes compared, derived here rather than accepted as a parameter.
   *
   * A comparison supplied beside the ledgers it describes could disagree with
   * them, and a reader has no way to tell which of the two to believe. Derived,
   * there is only one answer, and a reader that recomputes it is checking this
   * code rather than adjudicating between two stored claims.
   */
  const comparison = compareDocumentLanes({
    repair: {
      preparationIdentity: identity,
      records: lanes.repairDelivery,
    },
    translate: {
      preparationIdentity: identity,
      records: lanes.translateDelivery,
    },
  },);
  return {
    artifactSchemaVersion: ARTIFACT_SCHEMA_VERSION_V2,
    id: entryId,
    tip,
    pipelineDigest,
    corpusSha,
    callConfig,
    durationMs,
    timestamp: new Date().toISOString(),
    preparation: {
      identity,
      sliceCount: prepared.slices
        .length,

      // CHARACTER counts, named that way on purpose: they are UTF-16 code unit
      // lengths for reading an entry's size off a log line, and they are NOT
      // what band classification takes. Feeding them into it classifies large
      // pages as small, which has already produced one wrong band census.
      sourceChars: prepared.sourceText
        .length,
      targetChars: prepared.targetText
        .length,

      // The band input, recorded so analysis over a directory has the RIGHT
      // number nearest to hand rather than the tempting wrong one.
      sourceBytes: sourceBytesOf({ text: prepared.sourceText, },),
      alignmentPairCount: prepared.alignmentPairCount,

      // Read off the LANES rather than off the preparation, because that is
      // where a caller would see them: the driver reports the preparation's
      // findings once, and taking them from anywhere else would let the two
      // copies drift.
      alignmentFindings: lanes.alignmentFindings,
    },
    lanes: {
      repair: {
        result: lanes.repair,
        delivery: lanes.repairDelivery,
      },
      translate: {
        result: lanes.translate,
        delivery: lanes.translateDelivery,
      },
    },
    comparison: comparison.slices,

    // NOBODY HAS PICKED ONE, said out loud. Which lane ships is the user's
    // question, and an artifact that left the field out would make "not decided
    // yet" indistinguishable from "written before anyone asked".
    laneSelection: { kind: 'pending-human-decision', },
  };
}

//endregion Artifact version 2 build
