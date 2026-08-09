import {
  ArtifactParseError,
  requireArray,
  requireCount,
  requireRecord,
  requireString,
} from './artifact-guard.ts';
import type { ClaimAdmissibility, } from './introduced-defect-screen.ts';
import type {
  ProbeClaimAttribution,
  TelemetryRegionTally,
} from './probe-attribution.ts';

//region Artifact probe tally
// Region-level parsing for the shadow-mode probe reader.
//
// Split out of `artifact-probe-read.ts` when that file crossed its line cap.
// The seam is the unit each half is about: this half turns one region's JSON
// into one tally, and the other half decides which records have a region worth
// reading at all.
//
// The split also fixes a reading order the single file could not have: the
// tally parser called its claim parser and its admissibility table before
// either was declared, which is legal and unreadable top-down.

/**
 * Every admissibility the screen can record.
 */
const ADMISSIBILITY_VALUES: readonly ClaimAdmissibility[] = [
  'corroborated',
  'removal-corroborated',
  'contradicted',
  'unanchored',
];

/**
 * Reads a claim's admissibility, refusing a value the screen cannot have
 * written.
 *
 * Narrowing rather than asserting, because the majority rule counts only the
 * two upheld values. An unrecognized string would be silently non-upholding, so
 * a writer emitting a new verdict name would quietly zero the corroboration
 * every region reports rather than announce that the schemas diverged.
 *
 * @param value - candidate admissibility from artifact JSON
 *
 * @param path - dotted path for error messages
 *
 * @returns Admissibility as the screen recorded it
 *
 * @throws {@link ArtifactParseError} when the value is not one the screen emits
 *
 * @example
 * ```ts
 * const admissibility = requireAdmissibility({ value, path, },);
 * ```
 */
function requireAdmissibility(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): ClaimAdmissibility {
  /**
   * Candidate as a string, which it must be before it can be one of the set.
   */
  const text = requireString({
    value,
    path,
  },);
  /**
   * Matching admissibility, absent when the writer emitted something else.
   */
  const found = ADMISSIBILITY_VALUES.find(function matches(candidate,) {
    return candidate === text;
  },);
  if (found === undefined)
    throw new ArtifactParseError({
      path,
      reason: `one of ${ADMISSIBILITY_VALUES.join(', ',)}`,
    },);
  return found;
}

/**
 * Parses a region's claim list down to who said what.
 *
 * Attribution only, and the return type says so. `evidence`, `omittedText` and
 * `reason` carry UNLICENSED corpus text, this reader feeds a summary meant to
 * be pasteable, and nothing downstream reads them. Returning a full claim with
 * those fields blanked would be indistinguishable from a prober that quoted
 * nothing.
 *
 * @param value - candidate claim array from artifact JSON
 *
 * @param path - dotted path of the owning tally, for error messages
 *
 * @returns Claims reduced to prober and admissibility
 *
 * @throws {@link ArtifactParseError} when a claim is malformed
 *
 * @example
 * ```ts
 * const claims = parseClaimAttributions({ value: tally.claims, path, },);
 * ```
 */
function parseClaimAttributions(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): readonly ProbeClaimAttribution[] {
  return requireArray({
    value,
    path: `${path}.claims`,
  },)
    .map(function toClaim(
      entry,
      index,
    ): ProbeClaimAttribution {
      /**
       * Claim as a record.
       */
      const claim = requireRecord({
        value: entry,
        path: `${path}.claims[${String(index,)}]`,
      },);
      return {
        modelId: requireString({
          value: claim.modelId,
          path: `${path}.claims[${String(index,)}].modelId`,
        },),
        admissibility: requireAdmissibility({
          value: claim.admissibility,
          path: `${path}.claims[${String(index,)}].admissibility`,
        },),
      };
    },);
}

/**
 * Admissibility each declared count is the tally of.
 */
const ADMISSIBILITY_FIELDS: Readonly<Record<string, ClaimAdmissibility>> = {
  corroborated: 'corroborated',
  removalCorroborated: 'removal-corroborated',
  contradicted: 'contradicted',
  unanchored: 'unanchored',
};

/**
 * Parses one region tally.
 *
 * @param value - candidate tally from artifact JSON
 *
 * @param path - dotted path for error messages
 *
 * @returns Tally as the summary reads it
 *
 * @throws {@link ArtifactParseError} when any count or id is malformed, or when
 * the declared counts disagree with the claim list they were derived from
 *
 * @example
 * ```ts
 * const tally = parseRegionTally({ value, path: 'Kitten.issues[0]...regions[0]', },);
 * ```
 */
export function parseRegionTally(
  {
    value,
    path,
  }: {
    readonly value: unknown;
    readonly path: string;
  },
): TelemetryRegionTally {
  /**
   * Tally as a record.
   */
  const tally = requireRecord({
    value,
    path,
  },);

  /**
   * Reads one named count off the tally.
   *
   * @param field - count to read
   *
   * @returns Count value
   *
   * @example
   * ```ts
   * countAt('corroborated',);
   * ```
   */
  function countAt(field: string,): number {
    return requireCount({
      value: tally[field],
      path: `${path}.${field}`,
    },);
  }

  // The majority rule counts distinct probers, so the verdict cannot be
  // computed without modelId and admissibility. Reading the counts alone
  // silently judged every region as uncorroborated.
  /**
   * Screened claims of this region, attribution only.
   */
  const claims = parseClaimAttributions({
    value: tally.claims,
    path,
  },);

  /**
   * Counts as the artifact declares them.
   */
  const declared = {
    corroborated: countAt('corroborated',),
    removalCorroborated: countAt('removalCorroborated',),
    contradicted: countAt('contradicted',),
    unanchored: countAt('unanchored',),
  };

  // The screen DERIVES each count from the claim list, so the two are one fact
  // written twice and can only disagree in a malformed artifact. They are not
  // interchangeable downstream: the CLAIMS report sums the counts while the
  // majority rule reads the claims, so a disagreement makes a region report one
  // corroboration and flag nothing, or flag a majority while reporting none.
  // Both look like ordinary output.
  for (const [field, count,] of Object.entries(declared,)) {
    /**
     * Claims actually carrying this admissibility.
     */
    const observed = claims
      .filter(function matches(claim,) {
        return claim.admissibility === ADMISSIBILITY_FIELDS[field];
      },)
      .length;
    if (observed !== count)
      throw new ArtifactParseError({
        path: `${path}.${field}`,
        reason: `${String(observed,)} to match its claim list, not ${
          String(count,)
        }`,
      },);
  }

  return {
    envelopeId: requireString({
      value: tally.envelopeId,
      path: `${path}.envelopeId`,
    },),
    issueIds: requireArray({
      value: tally.issueIds,
      path: `${path}.issueIds`,
    },)
      .map(function toId(
        entry,
        index,
      ) {
        return requireString({
          value: entry,
          path: `${path}.issueIds[${String(index,)}]`,
        },);
      },),
    ...declared,
    noneFound: countAt('noneFound',),
    uncertain: countAt('uncertain',),
    claims,
  };
}

//endregion Artifact probe tally
