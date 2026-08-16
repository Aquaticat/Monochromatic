import { ArtifactParseError, } from '../artifact-guard.ts';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import type { PreparedDocumentPair, } from '../document-preparation.ts';
import { preparationIdentity, } from '../preparation-identity.ts';
import { sourceBytesOf, } from '../sample-grading.ts';
import type { ParsedArtifactV2, } from './artifact-v2-read-contract.ts';
import {
  assertFindingsDescribePreparation,
  assertLedgerDescribesPreparation,
  assertResultCountsPreparation,
} from './artifact-v2-verify.ts';

//region Artifact version 2 corpus verification
// The checks a file ALONE cannot make, run against a preparation somebody else
// obtained.
//
// A version 2 artifact stores measurements of the two documents rather than the
// documents, so the standalone reader checks the recorded preparation identity
// for syntax and nothing more. That is a real limit and not a temporary one:
// `preparationIdentity` hashes both whole documents, every slice's placement
// and offsets, the line-structure flag and the identity context, and the file
// carries none of those.
//
// SO THE PREPARATION IS A PARAMETER. Whoever holds the corpus checkout at the
// recorded commit and the matching pipeline builds the preparation and passes
// it here; this then answers the question the reader had to leave open, which
// is whether the artifact describes THAT slicing rather than some slicing.
//
// EVERY REFUSAL COMES BACK AS A PARSE ERROR, translated from the writer-side
// mismatch error the checks below raise. A caller reading artifacts should meet
// one error type from this layer rather than one named for the writer's
// internals.

/**
 * Runs one writer-side check and reports its refusal as a parse failure.
 *
 * @param check - check to run, which raises the writer's mismatch error
 *
 * @param path - dotted path the failure is reported under
 *
 * @throws {@link ArtifactParseError} carrying whatever the check said
 *
 * @example
 * ```ts
 * translating({ check: function counts() { assertResultCountsPreparation({ ... },); }, path, },);
 * ```
 */
function translating(
  {
    check,
    path,
  }: {
    readonly check: () => void;
    readonly path: string;
  },
): void {
  try {
    check();
  } catch (error) {
    throw new ArtifactParseError({
      path,
      reason: `an artifact describing this preparation: ${caughtValueText(error,)}`,
    },);
  }
}

/**
 * Refuses a measurement the preparation does not agree with.
 *
 * @param recorded - what the artifact says
 *
 * @param actual - what the preparation says
 *
 * @param path - dotted path of the recorded measurement
 *
 * @throws {@link ArtifactParseError} when they differ, naming both
 *
 * @example
 * ```ts
 * assertMeasured({ recorded: preparation.sliceCount, actual: prepared.slices.length, path, },);
 * ```
 */
function assertMeasured(
  {
    recorded,
    actual,
    path,
  }: {
    readonly recorded: number;
    readonly actual: number;
    readonly path: string;
  },
): void {
  if (recorded !== actual) {
    throw new ArtifactParseError({
      path,
      reason: `${String(actual,)}, which is what this preparation measures, rather than ${
        String(recorded,)
      }`,
    },);
  }
}

/**
 * Checks a parsed version 2 artifact against the preparation it claims to
 * describe.
 *
 * WHAT THIS ADDS over reading the file: the recorded identity is RECOMPUTED
 * rather than syntax-checked, every per-slice row is checked against the slice
 * the preparation actually produced, and every recorded measurement is checked
 * against the documents themselves.
 *
 * WHAT IT STILL CANNOT SAY: that the two raw lane results came from the same
 * run as the ledgers beside them. Each result reports the slice count of its
 * own preparation and that is checked here, which refuses a grossly mismatched
 * pairing and proves nothing finer.
 *
 * @param artifact - artifact as the version 2 reader returned it
 *
 * @param prepared - preparation whoever holds the corpus rebuilt
 *
 * @throws {@link ArtifactParseError} when the artifact describes a different
 * slicing, a different pair of documents, or measurements these documents do
 * not have
 *
 * @example
 * ```ts
 * verifyArtifactV2AgainstPreparation({ artifact, prepared, },);
 * ```
 */
export function verifyArtifactV2AgainstPreparation(
  {
    artifact,
    prepared,
  }: {
    readonly artifact: ParsedArtifactV2;
    readonly prepared: PreparedDocumentPair;
  },
): void {
  /**
   * Name this preparation gives itself, recomputed from the documents rather
   * than read out of the artifact.
   */
  const expected = preparationIdentity({ prepared, },);

  /**
   * What the artifact says about the slicing.
   */
  const { preparation, } = artifact;
  if (preparation.identity !== expected) {
    throw new ArtifactParseError({
      path: `${artifact.id}.preparation.identity`,
      reason: `${expected}, which is what this preparation names itself; the artifact records ${
        preparation.identity
      }, so it describes a different slicing of some pair of documents`,
    },);
  }
  assertMeasured({
    recorded: preparation.sliceCount,
    actual: prepared.slices
      .length,
    path: `${artifact.id}.preparation.sliceCount`,
  },);
  assertMeasured({
    recorded: preparation.sourceChars,
    actual: prepared.sourceText
      .length,
    path: `${artifact.id}.preparation.sourceChars`,
  },);
  assertMeasured({
    recorded: preparation.targetChars,
    actual: prepared.targetText
      .length,
    path: `${artifact.id}.preparation.targetChars`,
  },);
  assertMeasured({
    recorded: preparation.sourceBytes,
    actual: sourceBytesOf({ text: prepared.sourceText, },),
    path: `${artifact.id}.preparation.sourceBytes`,
  },);
  assertMeasured({
    recorded: preparation.alignmentPairCount,
    actual: prepared.alignmentPairCount,
    path: `${artifact.id}.preparation.alignmentPairCount`,
  },);
  translating({
    check: function findings(): void {
      assertFindingsDescribePreparation({
        prepared,
        reported: preparation.alignmentFindings,
      },);
    },
    path: `${artifact.id}.preparation.alignmentFindings`,
  },);

  // BOTH LEDGERS ROW BY ROW, against the slices the preparation produced. This
  // is the check the standalone reader has no way to make: it can see that the
  // two lanes agree with each other, and only a preparation says whether either
  // one describes the documents anybody actually ran.
  translating({
    check: function repairRows(): void {
      assertLedgerDescribesPreparation({
        prepared,
        expected,
        ledger: {
          preparationIdentity: preparation.identity,
          records: artifact.lanes
            .repair
            .delivery,
        },
        lane: 'repair',
      },);
    },
    path: `${artifact.id}.lanes.repair.delivery`,
  },);
  translating({
    check: function translateRows(): void {
      assertLedgerDescribesPreparation({
        prepared,
        expected,
        ledger: {
          preparationIdentity: preparation.identity,
          records: artifact.lanes
            .translate
            .delivery,
        },
        lane: 'translate',
      },);
    },
    path: `${artifact.id}.lanes.translate.delivery`,
  },);
  translating({
    check: function repairCounts(): void {
      assertResultCountsPreparation({
        prepared,
        sliceCount: artifact.lanes
          .repair
          .evidence
          .sliceCount,
        lane: 'repair',
      },);
    },
    path: `${artifact.id}.lanes.repair.result.sliceCount`,
  },);
  translating({
    check: function translateCounts(): void {
      assertResultCountsPreparation({
        prepared,
        sliceCount: artifact.lanes
          .translate
          .evidence
          .sliceCount,
        lane: 'translate',
      },);
    },
    path: `${artifact.id}.lanes.translate.result.sliceCount`,
  },);
}

//endregion Artifact version 2 corpus verification
