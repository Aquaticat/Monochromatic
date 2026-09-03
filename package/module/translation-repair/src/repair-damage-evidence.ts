import type { RegionDefectTally, } from './introduced-defect-screen.ts';

//region Repair damage evidence
// WHAT THE LANE CONTEST IS SHOWN of the introduced-defect probe: the
// corroborated claims of added damage against the repair lane's text, as
// evidence lines, so the judges that choose between the lanes see what the
// probe saw. Nothing acts on the claims; the probe stays in shadow mode
// (`introduced-defect-probe.ts`), and the judges weigh them as they weigh the
// passages.
//
// MEASURED ON 2026-09-03 over the four landings that carried the probe: ten
// regions with a corroborated claim, six true (three of them the tense rule,
// which the contest that chose the damaged lane 7 of 7 never saw), three false
// (two misparse 我方才知道 as "our side", one calls 十几 "fifteen") and one
// borderline. That precision is why the claims are shown and not obeyed.
// Record: `doc/planning/translation-repair-roster-calibration-2026-09-01.md`.

/**
 * What one probed chunk contributes: its slice and its screened regions.
 *
 * Structural rather than the lane's whole outcome type, so a test can feed
 * this from a fixture and the pass from the lane result alike.
 *
 * @example
 * ```ts
 * const chunk: ProbedChunk = { sliceIndex: 3, introducedDefects: { regions: [], }, };
 * ```
 */
export type ProbedChunk = {
  /**
   * Slice this chunk's text ships at.
   */
  readonly sliceIndex: number;

  /**
   * Probe report, absent where the chunk changed nothing and nothing was probed.
   */
  readonly introducedDefects?: {
    readonly regions: readonly RegionDefectTally[];
  };
};

/**
 * Renders one corroborated claim as a line a judge can check against the
 * ORIGINAL.
 *
 * @param modelId - prober that made the claim
 *
 * @param category - defect class in the prober's words, may be empty
 *
 * @param evidence - wording quoted from the repair text
 *
 * @param reason - why the prober says the archive rendering lacked it
 *
 * @returns One line
 *
 * @example
 * ```ts
 * const line = claimLine({ modelId: 'minimax-m3', category: 'tense', evidence: 'is', reason: 'the page holds past tense', },);
 * ```
 */
function claimLine(
  {
    modelId,
    category,
    evidence,
    reason,
  }: {
    readonly modelId: string;
    readonly category: string;
    readonly evidence: string;
    readonly reason: string;
  },
): string {
  /**
   * Category as written, or a placeholder when the prober gave none.
   */
  const kind = (category === '') ? 'unspecified' : category;
  return `- ${modelId} [${kind}] quotes "${evidence}": ${reason}`;
}

/**
 * Lines one probed chunk's corroborated claims make, none where nothing was
 * probed or nothing was corroborated.
 *
 * @param chunk - probed chunk
 *
 * @returns Lines in region and claim order
 *
 * @example
 * ```ts
 * const lines = corroboratedLinesOf({ chunk, },);
 * ```
 */
function corroboratedLinesOf({ chunk, }: { readonly chunk: ProbedChunk; },): readonly string[] {
  /**
   * Screened regions, none where the chunk was never probed.
   */
  const regions = chunk.introducedDefects
    ?.regions
    ?? [];
  return regions
    .flatMap(function linesOfRegion(region,): readonly string[] {
      return region.claims
        .filter(function isCorroborated(claim,): boolean {
          return claim.admissibility === 'corroborated';
        },)
        .map(function toLine(claim,): string {
          return claimLine({
            modelId: claim.modelId,
            category: claim.category,
            evidence: claim.evidence,
            reason: claim.reason,
          },);
        },);
    },);
}

/**
 * Collects, per slice, the corroborated added-damage claims against the repair
 * lane's text.
 *
 * ONLY CORROBORATED CLAIMS: a claim whose quote the differential confirmed as
 * added by the edit. Contradicted, unanchored, pre-existing and dropped-content
 * claims stay in the record and out of the judges' sight, since the first two
 * failed a deterministic check and the last two are not about added damage.
 *
 * @param lane - repair lane result, read for its probed chunks
 *
 * @returns Lines keyed by slice, absent for slices with no corroborated claim
 *
 * @example
 * ```ts
 * const bySlice = damageClaimLinesBySlice({ lane: lanes.repair, },);
 * ```
 */
export function damageClaimLinesBySlice(
  { lane, }: { readonly lane: { readonly chunks: readonly ProbedChunk[]; }; },
): ReadonlyMap<number, readonly string[]> {
  return lane.chunks
    .reduce(
      function collect(
        bySlice: Map<number, readonly string[]>,
        chunk: ProbedChunk,
      ): Map<number, readonly string[]> {
        /**
         * Lines this chunk's corroborated claims make.
         */
        const lines = corroboratedLinesOf({ chunk, },);
        if (lines.length === 0)
          return bySlice;
        bySlice.set(
          chunk.sliceIndex,
          [
            ...(bySlice.get(chunk.sliceIndex,) ?? []),
            ...lines,
          ],
        );
        return bySlice;
      },
      new Map<number, readonly string[]>(),
    );
}

//endregion Repair damage evidence
