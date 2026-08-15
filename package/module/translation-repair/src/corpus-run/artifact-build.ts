import { sourceBytesOf, } from '../sample-grading.ts';
import type { PipelineDigest, } from './pipeline-digest.ts';

//region Artifact build
// The SHAPE of one settled artifact, in one place.
//
// Split out of `corpus-pass.ts` when that file reached its line cap. The pass
// is a scheduling loop; this is the record it leaves behind, and the record is
// what every later reader parses. Keeping it here means a field can be added,
// documented and explained without spending the loop's line budget, which is
// how the two units earned their separation rather than merely fitting.

/**
 * Everything one settled entry records.
 *
 * Deliberately not narrowed to a named type per field: readers parse this from
 * JSON and validate what they need, and a second declaration here would be a
 * copy to keep in step rather than a contract anyone checks.
 *
 * @param entryId - corpus entry the run covered
 *
 * @param tip - repo commit the pass started under, as PROVENANCE. It says
 * where the code came from and never what ran: a dirty worktree leaves it
 * unchanged while the pipeline differs, and a documentation commit moves it
 * while the pipeline does not
 *
 * @param pipelineDigest - built output the pass ran, as IDENTITY. This is the
 * field two artifacts must share before their results may be pooled, since it
 * moves exactly when executed bytes do
 *
 * @param corpusSha - corpus commit the texts were read at
 *
 * @param callConfig - model call configuration this run used
 *
 * @param status - how the run finished
 *
 * @param durationMs - wall time the entry took
 *
 * @param sourceText - original zh page text, measured but not stored
 *
 * @param targetText - translated en page text, measured but not stored
 *
 * @param result - what the pipeline returned
 *
 * @param acceptedCount - accepted issues after adjudication
 *
 * @param resolvedCount - accepted issues the checkers confirmed fixed
 *
 * @returns Artifact ready to serialize
 *
 * @example
 * ```ts
 * const artifact = buildSettledArtifact({ entryId, tip, ... },);
 * ```
 */
export function buildSettledArtifact(
  {
    entryId,
    tip,
    pipelineDigest,
    corpusSha,
    callConfig,
    status,
    durationMs,
    sourceText,
    targetText,
    result,
    acceptedCount,
    resolvedCount,
  }: {
    readonly entryId: string;
    readonly tip: string;
    readonly pipelineDigest: PipelineDigest;
    readonly corpusSha: string;
    readonly callConfig: unknown;
    readonly status: string;
    readonly durationMs: number;
    readonly sourceText: string;
    readonly targetText: string;
    readonly result: {
      readonly issues: readonly unknown[];
      readonly findings: readonly unknown[];
      readonly chunkCritics: unknown;
      readonly repairedText: string;
    };
    readonly acceptedCount: number;
    readonly resolvedCount: number;
  },
): Readonly<Record<string, unknown>> {
  return {
    id: entryId,
    tip,

    // What actually ran, beside where it came from. Artifacts settled before
    // 2026-08-14 carry only `tip`, so a reader meeting one has no identity for
    // it at all and must refuse it rather than assume it shares this pipeline.
    pipelineDigest,

    corpusSha,
    callConfig,
    status,
    durationMs,
    timestamp: new Date().toISOString(),

    // CHARACTER counts, and named that way on purpose. They are UTF-16 code
    // unit lengths for eyeballing an entry's size in a log, and they are NOT
    // what `classifyBand` wants: that takes UTF-8 BYTES, which run roughly
    // twice these numbers on this corpus and up to three times on pure han
    // text. Feeding these into it classifies large pages as small, which has
    // already produced one wrong band census.
    sourceChars: sourceText.length,
    targetChars: targetText.length,

    // The band input, recorded so analysis over this directory has the RIGHT
    // number nearest to hand rather than the tempting wrong one. Artifacts
    // settled before 2026-08-14 lack this field, so a reader must treat its
    // absence as "measure the source yourself" rather than as zero.
    sourceBytes: sourceBytesOf({ text: sourceText, },),

    issueCount: result.issues
      .length,
    acceptedCount,
    resolvedCount,
    findings: result.findings,
    issues: result.issues,
    chunkCritics: result.chunkCritics,
    repairedText: result.repairedText,

    // Which slices the returned document carries a repair for, and which the
    // assembly guard took back. Recorded because both are facts about the
    // DOCUMENT that no other field states: an issue record says what its slice
    // decided, and a slice can be withdrawn while carrying no issue of its own.
    // Absent from artifacts settled before 2026-08-15, so a reader must treat
    // their absence as unknown rather than as empty.
    shippedChunkIndices: result.shippedChunkIndices,
    withdrawnChunkIndices: result.withdrawnChunkIndices,
  };
}

//endregion Artifact build
