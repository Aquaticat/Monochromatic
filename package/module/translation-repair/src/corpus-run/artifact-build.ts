import { SETTLED_ARTIFACT_SCHEMA_VERSION, } from '../artifact-schema-version.ts';
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
 * @param durationMs - wall time the entry took
 *
 * @param sourceText - original zh page text, measured but not stored
 *
 * @param targetText - translated en page text, measured but not stored
 *
 * @param result - what the pipeline returned, and the ONLY source for the
 * status and the two issue counts. Those arrived as three parameters BESIDE it
 * until 2026-08-16, so a caller could state a status the result contradicted
 * and counts nothing had counted, and the fields a reader trusts most were the
 * ones least tied to what actually ran
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
    durationMs,
    sourceText,
    targetText,
    result,
  }: {
    readonly entryId: string;
    readonly tip: string;
    readonly pipelineDigest: PipelineDigest;
    readonly corpusSha: string;
    readonly callConfig: unknown;
    readonly durationMs: number;
    readonly sourceText: string;
    readonly targetText: string;
    readonly result: {
      readonly status: string;
      readonly issues: readonly {
        readonly issue: { readonly status: string; };
        readonly resolved: boolean;
      }[];
      readonly findings: readonly unknown[];
      readonly chunkCritics: unknown;
      readonly repairedText: string;
      readonly sliceCount: number;
      readonly shippedChunkIndices: readonly number[];
      readonly withdrawnChunkIndices: readonly number[];
    };
  },
): Readonly<Record<string, unknown>> {
  /**
   * Issues the adjudication accepted, counted HERE rather than by the caller.
   */
  const accepted = result.issues
    .filter(function isAccepted(record,): boolean {
      return record.issue
        .status
        === 'accepted';
    },);

  return {
    id: entryId,

    // WHICH GENERATION THIS IS, stated rather than left to be guessed. Three
    // shapes preceded this field and every reader told them apart by which
    // fields happened to be present, which works only until two generations
    // differ in something other than presence.
    artifactSchemaVersion: SETTLED_ARTIFACT_SCHEMA_VERSION,

    tip,

    // What actually ran, beside where it came from. Artifacts settled before
    // 2026-08-14 carry only `tip`, so a reader meeting one has no identity for
    // it at all and must refuse it rather than assume it shares this pipeline.
    pipelineDigest,

    corpusSha,
    callConfig,

    // The run's OWN status, read off the result rather than taken from a
    // parameter beside it, so an artifact cannot report a document settled that
    // the pipeline reported blocked.
    status: result.status,

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
    acceptedCount: accepted.length,
    resolvedCount: accepted.filter(function isResolved(record,): boolean {
      return record.resolved;
    },)
      .length,
    findings: result.findings,
    issues: result.issues,
    chunkCritics: result.chunkCritics,
    repairedText: result.repairedText,

    // Slices the preparation produced, which both index sets below are out of.
    // Without it a reader holding an artifact can range-check neither, and
    // cannot tell one changed slice of two from one of two hundred.
    sliceCount: result.sliceCount,

    // Which slices the returned document carries a repair for, and which the
    // assembly guard took back. Recorded because both are facts about the
    // DOCUMENT that no other field states: an issue record says what its slice
    // decided, and a slice can be withdrawn while carrying no issue of its own.
    // Absent from artifacts settled before 2026-08-15, so a reader must treat
    // their absence as unknown rather than as empty. `readArtifactChangeSets`
    // is that reader, and the schema version above is what tells it which rule
    // to apply.
    shippedChunkIndices: result.shippedChunkIndices,
    withdrawnChunkIndices: result.withdrawnChunkIndices,
  };
}

//endregion Artifact build
