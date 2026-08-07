import type { IssueProbeReading, } from './repair-record.ts';
import type { RegionDefectTally, } from './introduced-defect-screen.ts';

//region Probe telemetry
// Aggregating the shadow-mode probe across a run, so its false-positive rate
// can be compared against the human repair grades and the gate question
// answered with a number instead of an intuition.
//
// TWO joins have to be got right and neither is enforced by any type, which is
// why they live in one named function rather than in whatever script reads the
// artifacts first.
//
// SHIPPED ONLY. The probe runs wherever an operation applied, including
// candidates selection later rejected, so readings exist on records the repair
// sheet gives no grade box. Counting those puts regions no human ever judged
// into the denominator of a rate that is supposed to be about judged ones.
//
// DISTINCT ENVELOPES. A record carries the tallies of the regions serving ITS
// issue, and envelopes merge, so every issue of a merged envelope carries the
// SAME tally. Summing over records counts one region once per issue it served,
// which silently overweights exactly the widest edits.

/**
 * How a region's probers came down on it, once a majority rule is applied.
 *
 * @example
 * ```ts
 * const verdict: RegionProbeVerdict = 'majority-introduced';
 * ```
 */
export type RegionProbeVerdict =
  | 'majority-introduced'
  | 'minority-introduced'
  | 'none-introduced';

/**
 * One run's probe telemetry, over distinct shipped regions.
 *
 * @example
 * ```ts
 * const summary: ProbeTelemetrySummary = summarizeProbeTelemetry({ readings, },);
 * ```
 */
export type ProbeTelemetrySummary = {
  /**
   * Distinct regions that shipped and were probed.
   */
  readonly regions: number;

  /**
   * Regions a strict majority of the CONFIGURED roster called defective on
   * corroborated evidence, which is the population a gate would have blocked.
   */
  readonly majorityIntroduced: number;

  /**
   * Regions where some prober corroborated damage but no majority did.
   */
  readonly minorityIntroduced: number;

  /**
   * Regions where nobody corroborated any damage.
   */
  readonly noneIntroduced: number;

  /**
   * Corroborated claims of ADDED damage, summed over distinct regions.
   */
  readonly corroborated: number;

  /**
   * Corroborated claims of DROPPED content, summed over distinct regions.
   */
  readonly removalCorroborated: number;

  /**
   * Claims the deterministic screen refuted, summed over distinct regions.
   * A high share here indicts the prompt rather than the repairs: it means
   * probers kept quoting wording the differential says they cannot have.
   */
  readonly contradicted: number;

  /**
   * Claims carrying no usable anchor, summed over distinct regions.
   */
  readonly unanchored: number;

  /**
   * Regions whose chunk was probed by fewer probers than configured, where a
   * majority is harder to reach and an absent verdict is not a clean bill.
   */
  readonly degradedRosterRegions: number;
};

/**
 * Corroborated claims on one region, in either direction.
 *
 * @param tally - screened tally of one region
 *
 * @returns Claims the differential upheld
 *
 * @example
 * ```ts
 * const upheld = corroboratedCount({ tally, },);
 * ```
 */
export function corroboratedCount(
  { tally, }: { readonly tally: RegionDefectTally; },
): number {
  return tally.corroborated + tally.removalCorroborated;
}

/**
 * Admissibility values that uphold a claim that the edit caused damage.
 */
const UPHELD_ADMISSIBILITY: ReadonlySet<string> = new Set([
  'corroborated',
  'removal-corroborated',
],);

/**
 * Counts the distinct PROBERS with at least one upheld claim on a region.
 *
 * The majority rule weighs voices against a roster size, so its numerator has
 * to be voices too. {@link corroboratedCount} counts CLAIMS, and one prober may
 * file several on a single region, so a three-model roster could reach a
 * "majority" on one prober filing twice. The other half of the same tally
 * already counts probers rather than claims, since `noneFound` and `uncertain`
 * are per-prober, which is what makes the mixed units a defect rather than a
 * deliberate choice.
 *
 * Measured before changing, across the 210 distinct regions settled at the
 * time: no prober had ever filed more than one upheld claim on one region, so
 * this agrees with the claim count on every region measured so far and revises
 * no figure already reported. It removes the case that would have inflated one.
 *
 * @param tally - screened tally of one region, whose claims carry `modelId`
 *
 * @returns Distinct probers upholding damage on this region
 *
 * @example
 * ```ts
 * const voices = corroboratingProberCount({ tally, },);
 * ```
 */
export function corroboratingProberCount(
  { tally, }: { readonly tally: RegionDefectTally; },
): number {
  return new Set(
    tally.claims
      .filter(function upholds(claim,) {
        return UPHELD_ADMISSIBILITY.has(claim.admissibility,);
      },)
      .map(function toProber(claim,) {
        return claim.modelId;
      },),
  ).size;
}

/**
 * Applies the majority rule to one region.
 *
 * The denominator is the CONFIGURED roster, never the heard one. Under
 * retry-to-quorum a six-model roster can settle with three heard, and counting
 * a majority of THOSE would let two probers speak for six. Unheard voices count
 * as non-confirming, which is the conservative direction for a probe whose
 * false positives discard correct repairs.
 *
 * The numerator counts PROBERS, not claims, so both sides of the comparison are
 * voices. See {@link corroboratingProberCount} for why the claim count cannot
 * play that role.
 *
 * @param tally - screened tally of one region
 *
 * @param configuredProbers - probers asked for that region's chunk
 *
 * @returns What the region's probers established
 *
 * @example
 * ```ts
 * const verdict = judgeRegionProbe({ tally, configuredProbers: 3, },);
 * ```
 */
export function judgeRegionProbe(
  {
    tally,
    configuredProbers,
  }: {
    readonly tally: RegionDefectTally;
    readonly configuredProbers: number;
  },
): RegionProbeVerdict {
  /**
   * Distinct probers upholding damage on this region.
   */
  const upheld = corroboratingProberCount({ tally, },);
  if (upheld === 0)
    return 'none-introduced';
  return ((upheld * 2) > configuredProbers)
    ? 'majority-introduced'
    : 'minority-introduced';
}

/**
 * One envelope's evidence as a single record carried it.
 */
type RegionEvidence = {
  /**
   * Screened tally of the region.
   */
  readonly tally: RegionDefectTally;

  /**
   * Probers asked for the region's chunk.
   */
  readonly configuredProbers: number;

  /**
   * Probers whose reply arrived and validated.
   */
  readonly heardProbers: number;
};

/**
 * Renders one copy of an envelope's evidence as a comparable string.
 *
 * Identities rather than only counts. Two copies naming DIFFERENT probers or
 * serving different issues, in equal numbers, are as much a contradiction as
 * two different totals, and comparing totals alone would let them through while
 * the invariant claims disagreement is refused.
 *
 * @param evidence - one record's copy of an envelope's evidence
 *
 * @returns Fingerprint equal exactly when two copies agree
 *
 * @example
 * ```ts
 * const fingerprint = evidenceFingerprint({ evidence, },);
 * ```
 */
function evidenceFingerprint(
  { evidence, }: { readonly evidence: RegionEvidence; },
): string {
  /**
   * Screened tally of this copy.
   */
  const { tally, } = evidence;
  return [
    String(evidence.configuredProbers,),
    String(evidence.heardProbers,),
    String(tally.corroborated,),
    String(tally.removalCorroborated,),
    String(tally.contradicted,),
    String(tally.unanchored,),
    String(tally.noneFound,),
    String(tally.uncertain,),
    // Sorted so two copies listing the same probers in different orders are
    // still one fact rather than a contradiction.
    tally.claims
      .map(function toIdentity(claim,) {
        return `${claim.modelId}/${claim.admissibility}`;
      },)
      .toSorted()
      .join(','),
    tally.issueIds
      .toSorted()
      .join(','),
  ].join('|',);
}

/**
 * Whether two copies of one envelope's evidence say the same thing.
 *
 * Compares what the summary actually reads: the roster sizes, the five screened
 * counts, and the number of distinct probers upholding damage. Claim text is
 * not compared because the reader drops it, so comparing it would only ever be
 * comparing two empty strings.
 *
 * @param kept - copy already recorded for the envelope
 *
 * @param found - copy met on a later record
 *
 * @returns True when the two agree on every figure the summary uses
 *
 * @example
 * ```ts
 * const agrees = sameRegionEvidence({ kept, found, },);
 * ```
 */
function sameRegionEvidence(
  {
    kept,
    found,
  }: {
    readonly kept: RegionEvidence;
    readonly found: RegionEvidence;
  },
): boolean {
  return evidenceFingerprint({ evidence: kept, },)
    === evidenceFingerprint({ evidence: found, },);
}

/**
 * Summarizes probe readings over the distinct regions that actually shipped.
 *
 * @param readings - probe readings of SHIPPED issue records only; the caller
 * filters, because only the caller knows each record's disposition
 *
 * @returns Counts over distinct envelopes
 *
 * @example
 * ```ts
 * const summary = summarizeProbeTelemetry({ readings, },);
 * ```
 */
export function summarizeProbeTelemetry(
  { readings, }: { readonly readings: readonly IssueProbeReading[]; },
): ProbeTelemetrySummary {
  /**
   * One entry per distinct envelope, keeping the first reading that named it.
   */
  const distinct = new Map<string, RegionEvidence>();
  for (const reading of readings) {
    for (const tally of reading.regions) {
      /**
       * Copy already kept for this envelope, absent on first sighting.
       */
      const kept = distinct.get(tally.envelopeId,);
      if (kept !== undefined) {
        // Every record serving a merged envelope carries the SAME tally, and
        // an envelope lives inside one chunk so its records were probed by one
        // roster. Copies that disagree therefore cannot both be right, and
        // keeping the first would make the whole summary depend on artifact
        // read order while reporting a number that looks settled.
        if (!sameRegionEvidence({
          kept,
          found: {
            tally,
            configuredProbers: reading.configuredProbers,
            heardProbers: reading.heardProbers,
          },
        },))
          throw new Error(
            `envelope ${tally.envelopeId} carries disagreeing probe copies `
              + 'across the records it served. Every record of a merged '
              + 'envelope carries the same tally and one roster probed them '
              + 'all, so keeping either copy would make this summary depend on '
              + 'the order artifacts were read.',
          );
        continue;
      }
      distinct.set(
        tally.envelopeId,
        {
          tally,
          configuredProbers: reading.configuredProbers,
          heardProbers: reading.heardProbers,
        },
      );
    }
  }

  /**
   * Distinct regions with their verdicts, in insertion order.
   */
  const judged = [...distinct.values(),].map(function toJudged(entry,) {
    return {
      ...entry,
      verdict: judgeRegionProbe({
        tally: entry.tally,
        configuredProbers: entry.configuredProbers,
      },),
    };
  },);

  /**
   * Counts regions whose verdict matches.
   *
   * @param wanted - verdict to count
   *
   * @returns Regions carrying it
   *
   * @example
   * ```ts
   * countVerdict({ wanted: 'majority-introduced', },);
   * ```
   */
  function countVerdict(
    { wanted, }: { readonly wanted: RegionProbeVerdict; },
  ): number {
    return judged.filter(function matches(entry,) {
      return entry.verdict === wanted;
    },)
      .length;
  }

  return {
    regions: judged.length,
    majorityIntroduced: countVerdict({ wanted: 'majority-introduced', },),
    minorityIntroduced: countVerdict({ wanted: 'minority-introduced', },),
    noneIntroduced: countVerdict({ wanted: 'none-introduced', },),
    corroborated: judged.reduce(
      function addAdded(
      sum,
      entry,
    ) {
      return sum
        + entry.tally
        .corroborated;
    },
      0,
    ),
    removalCorroborated: judged.reduce(
      function addDropped(
      sum,
      entry,
    ) {
      return sum
        + entry.tally
        .removalCorroborated;
    },
      0,
    ),
    contradicted: judged.reduce(
      function addRefuted(
      sum,
      entry,
    ) {
      return sum
        + entry.tally
        .contradicted;
    },
      0,
    ),
    unanchored: judged.reduce(
      function addLoose(
      sum,
      entry,
    ) {
      return sum
        + entry.tally
        .unanchored;
    },
      0,
    ),
    degradedRosterRegions: judged.filter(function wasShort(entry,) {
      return entry.heardProbers < entry.configuredProbers;
    },)
      .length,
  };
}

//endregion Probe telemetry
