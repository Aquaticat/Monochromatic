import { ArtifactParseError, } from '../artifact-guard.ts';
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import type { PreparedDocumentPair, } from '../document-preparation.ts';
import { sourceBytesOf, } from '../sample-grading.ts';
import type { ParsedTwoLaneArtifact, } from './artifact-two-lane-read-contract.ts';
import { assertResultCountsPreparation, } from './artifact-two-lane-verify.ts';

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
// SO THE PREPARATION IS A PARAMETER, and what it is checked against is the
// artifact's MEASUREMENTS. A check that recomputed the identity and read both
// ledgers row by row against the preparation stood here until 2026-09-29: no
// rebuild matches a run's identity (ledger A12b), so nothing called it, and it
// went with the other functions only tests reached (ledger B30).
//
// EVERY REFUSAL COMES BACK AS A PARSE ERROR, translated by `translating` from
// the writer-side mismatch error its checks raise. A caller reading artifacts should meet
// one error type from this layer rather than one named for the writer's
// internals.

/**
 Runs one writer-side check and reports its refusal as a parse failure.
 
 @param check - check to run, which raises the writer's mismatch error
 
 @param path - dotted path the failure is reported under
 
 @throws {@link ArtifactParseError} carrying whatever the check said
 
 @example
 ```ts
 translating({ check: function counts() { assertResultCountsPreparation({ ... },); }, path, },);
 ```
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
 Refuses a measurement the preparation does not agree with.
 
 @param recorded - what the artifact says
 
 @param actual - what the preparation says
 
 @param path - dotted path of the recorded measurement
 
 @throws {@link ArtifactParseError} when they differ, naming both
 
 @example
 ```ts
 assertMeasured({ recorded: preparation.sliceCount, actual: prepared.slices.length, path, },);
 ```
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
 Checks what a parsed artifact measured of its preparation against a
 preparation: slice count, document sizes, alignment pairs, and each lane's
 own slice count.
 
 SPLIT FROM THE IDENTITY CHECK (ledger A12b), since removed (ledger B30). The recorded identity also
 hashes the declared names as the run's build worded them, and the recorded
 alignment findings include the roster pairing rounds' own (mikaela16's six
 are all `block-pairing` lines), which a rebuild never runs, so it reports
 none over the same rows. A preparation rebuilt today matches neither; a
 rebuild whose rows reproduce the run's carve
 (`artifact-two-lane-rebuild-rows.ts`) is verified by these measurements
 instead.
 
 @param artifact - artifact as the version 2 reader returned it
 
 @param prepared - preparation to measure against
 
 @throws {@link ArtifactParseError} when a recorded measurement is not this
 preparation's
 
 @example
 ```ts
 verifyArtifactMeasurements({ artifact, prepared: rebuilt.prepared, },);
 ```
 */
export function verifyArtifactMeasurements(
  {
    artifact,
    prepared,
  }: {
    readonly artifact: ParsedTwoLaneArtifact;
    readonly prepared: PreparedDocumentPair;
  },
): void {
  /**
   What the artifact says about the slicing.
   */
  const { preparation, } = artifact;
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
