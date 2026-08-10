//region Refine coverage
// Whether the naturalness lane was ABLE to speak, kept separate from what it
// did once it had.
//
// The refinement audit reports rewritten slices. A rewritten slice is the last
// link of a chain: the lane has to be offered a slice, a refiner has to answer,
// its answer has to survive the apply gate, and judges have to select it. Every
// earlier link failing produces the same reading at the end, zero, which is
// also what a run with nothing worth rewriting produces.
//
// That ambiguity is not hypothetical. On 2026-08-10 a pass settled five entries
// while its ONLY refiner lost every voice to schema-mismatch, four tries per
// slice, six slices. The refinement summary did not move and printed no note,
// because its total was non-zero from earlier runs, so a stage that had stopped
// working was indistinguishable from a stage nobody had asked to work.
//
// A single-model stage is where this matters most. Every other stage retries to
// a quorum and reports a degraded roster; a roster of one has no quorum to
// lose, so its failure has no shape of its own unless something counts it.

/**
 * Finding the refine stage writes once per slice it was offered.
 */
const CANDIDATES_PREFIX = 'refine-candidates (';

/**
 * Finding the refine stage writes when NO refiner answered for that slice.
 *
 * The heard count opens the finding, so a slice that lost every voice is
 * exactly one whose finding begins with a zero numerator. Matched by prefix
 * rather than by pattern: this is a fixed string the writer emits, and reading
 * it with a plain comparison keeps the reader honest about depending on the
 * writer's wording.
 */
const SILENT_PREFIX = `${CANDIDATES_PREFIX}0/`;

/**
 * What the lane was able to do across the artifacts read.
 *
 * @example
 * ```ts
 * const coverage: RefineCoverage = { slicesOffered: 101, slicesSilent: 6, entriesWithRewrites: 3, };
 * ```
 */
export type RefineCoverage = {
  /**
   * Slices the lane was offered, across every artifact.
   */
  readonly slicesOffered: number;

  /**
   * Offered slices where no refiner answered at all.
   */
  readonly slicesSilent: number;

  /**
   * Artifacts carrying at least one slice the lane rewrote.
   */
  readonly entriesWithRewrites: number;
};

/**
 * Counts what the naturalness lane managed across a run's artifacts.
 *
 * @param entries - per-artifact findings paired with whether that artifact
 * carried any rewritten slice
 *
 * @returns Counts distinguishing a lane nobody asked from a lane that could not
 * answer
 *
 * @example
 * ```ts
 * const coverage = summarizeRefineCoverage({ entries, },);
 * ```
 */
export function summarizeRefineCoverage(
  {
    entries,
  }: {
    readonly entries: readonly {
      readonly findings: readonly string[];
      readonly hasRewrites: boolean;
    }[];
  },
): RefineCoverage {
  /**
   * Every refine-stage finding across every artifact.
   */
  const findings = entries.flatMap(function toFindings(entry,) {
    return entry.findings
      .filter(function isCandidates(finding,) {
        return finding.startsWith(CANDIDATES_PREFIX,);
      },);
  },);

  return {
    slicesOffered: findings.length,
    slicesSilent: findings
      .filter(function wasSilent(finding,) {
        return finding.startsWith(SILENT_PREFIX,);
      },)
      .length,
    entriesWithRewrites: entries
      .filter(function hasRewrites(entry,) {
        return entry.hasRewrites;
      },)
      .length,
  };
}

//endregion Refine coverage
