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
 * Applies the majority rule to one region.
 *
 * The denominator is the CONFIGURED roster, never the heard one. Under
 * retry-to-quorum a six-model roster can settle with three heard, and counting
 * a majority of THOSE would let two probers speak for six. Unheard voices count
 * as non-confirming, which is the conservative direction for a probe whose
 * false positives discard correct repairs.
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
   * Corroborated claims on this region.
   */
  const upheld = corroboratedCount({ tally, },);
  if (upheld === 0)
    return 'none-introduced';
  return ((upheld * 2) > configuredProbers)
    ? 'majority-introduced'
    : 'minority-introduced';
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
  const distinct = new Map<string, {
    readonly tally: RegionDefectTally;
    readonly configuredProbers: number;
    readonly heardProbers: number;
  }>();
  for (const reading of readings) {
    for (const tally of reading.regions) {
      if (distinct.has(tally.envelopeId,))
        continue;
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
