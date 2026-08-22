import type { ArtifactConsolidateSliceV2, } from './artifact-v2-consolidate.ts';
import type { ArtifactContestSliceV2, } from './artifact-v2-contest.ts';
import type { ParsedArtifactV2, } from './artifact-v2-read-contract.ts';
import type { ArtifactComparisonRowV2, } from './artifact-v2-vocabulary.ts';

//region Would-ship vocabulary
// WHAT A READER WOULD SEE AT ONE SLICE, and no field holds it. Two deciding
// stages sit above the two lanes, each free to replace what the one below it
// left, and the artifact records what each stage DECIDED rather than what
// survived all of them. Deriving that is this file's whole job.
//
// NAMED "WOULD SHIP" RATHER THAN "SHIPPED", deliberately. No stage assembles a
// document out of these decisions, so nothing here has been published; this is
// what a publication would carry if one were built today. The founding defect
// of this family was `repairDisposition: 'shipped'`, a name that went on
// asserting a publication after the stage that performed it stopped being last.
// A name claiming less than it can prove is the correction.

/**
 * Which stage settled the wording a slice would contribute.
 *
 * ATTRIBUTION IS PART OF THE ANSWER, not a diagnostic beside it. A consumer
 * auditing one lane's work needs to know that a lane's wording reached the
 * page because that lane won, rather than because no other stage had anything
 * to say; those are different facts about the roster and read identically off
 * the text alone.
 *
 * @example
 * ```ts
 * const decidedBy: WouldShipDecider = 'consolidation';
 * ```
 */
export type WouldShipDecider =
  | 'consolidation'
  | 'contest'
  | 'lanes-agreed'
  | 'archive';

/**
 * Why a slice would contribute no wording at all.
 *
 * NEVER REPRESENTED AS AN EMPTY STRING, which is the trap this whole shape
 * exists to close. `standingTextFor` returns `''` at a declined contest, and
 * `ArtifactConsolidateShippedV2` documents that a consumer writing a bare per
 * slice `text` into a document would delete every declined slice outright. A
 * reading that carries no `text` key at all makes that unrepresentable rather
 * than warned against.
 *
 * @example
 * ```ts
 * const reason: WouldShipSilence = 'contest-declined-and-archive-silent';
 * ```
 */
export type WouldShipSilence =
  | 'contest-declined-and-archive-silent'
  | 'contest-unasked-and-archive-silent'
  | 'lanes-agreed-on-no-wording';

/**
 * What one slice would contribute to a document assembled today.
 *
 * @example
 * ```ts
 * const reading: WouldShipReading = { kind: 'nothing-ships', reason: 'lanes-agreed-on-no-wording', };
 * ```
 */
export type WouldShipReading =
  | {
    /**
     * This slice carries wording, and `decidedBy` names who settled it.
     */
    readonly kind: 'wording';

    /**
     * Exactly what a document would carry here, wrapped as the stage left it.
     */
    readonly text: string;

    /**
     * Stage whose decision survived every stage after it.
     */
    readonly decidedBy: WouldShipDecider;
  }
  | {
    /**
     * This slice carries nothing, and `reason` names which stage left it so.
     */
    readonly kind: 'nothing-ships';

    /**
     * Why nothing stands here.
     */
    readonly reason: WouldShipSilence;
  };

/**
 * Fields of a parsed artifact a reading is derived from.
 *
 * NARROWER THAN THE WHOLE ARTIFACT deliberately, so this file names its own
 * inputs rather than taking everything and reading three things. A whole
 * `ParsedArtifactV2` satisfies it unchanged, so consumers pass what they
 * already hold, and the types still come from the parsed contract: that is
 * what makes a key this file misspells a type error rather than an
 * `undefined` that reads as an answer.
 *
 * @example
 * ```ts
 * const source: WouldShipSource = parseSettledArtifactV2({ value, },);
 * ```
 */
export type WouldShipSource = Pick<
  ParsedArtifactV2,
  'comparison' | 'consolidation' | 'laneSelection'
>;

/**
 * One slice's reading, beside the index both lanes name it by.
 *
 * @example
 * ```ts
 * const slice: WouldShipSlice = { chunkIndex: 0, reading, };
 * ```
 */
export type WouldShipSlice = {
  /**
   * Slice this answers, matching its comparison row.
   */
  readonly chunkIndex: number;

  /**
   * What that slice would contribute.
   */
  readonly reading: WouldShipReading;
};

//endregion Would-ship vocabulary

//region Would-ship reader

/**
 * Raised when the lanes differ at a slice the contest record never answered.
 *
 * A CONTRADICTION IN THE ARTIFACT, not a state a run can reach. `contestEligibleIndexes`
 * makes every slice whose lane texts differ eligible, and the parser returns a
 * lane selection only once it agrees with the comparison it recomputed. Reading
 * such a slice as though the lanes agreed would pick one lane's wording with
 * nothing behind it, so it is refused instead.
 *
 * @example
 * ```ts
 * throw new UnansweredContestSliceError({ message: 'slice 3 differs across lanes and the contest names it nowhere', },);
 * ```
 */
export class UnansweredContestSliceError extends Error {
  /**
   * Builds the failure naming the slice the contest record skipped.
   *
   * @param message - which slice differs and what the record says about it
   *
   * @example
   * ```ts
   * throw new UnansweredContestSliceError({ message: 'slice 3 differs across lanes and the contest names it nowhere', },);
   * ```
   */
  public constructor({ message, }: { readonly message: string; },) {
    super(message,);
    this.name = 'UnansweredContestSliceError';
  }
}

/**
 * Names what the archive holds here, or that it holds nothing.
 *
 * THE ARCHIVE IS THE INCUMBENT, which is what makes this the floor rather than
 * an empty string. This pipeline repairs an English translation that already
 * exists, so a slice no later stage displaced still carries whatever the
 * archive published. That is a different question from the consolidation's
 * `no-standing-text`, which asks what a slate must beat and correctly answers
 * "nothing" on a decline.
 *
 * @param row - comparison row carrying the archive's own English
 *
 * @param silence - why nothing displaced the archive, used when it is empty too
 *
 * @returns Archive wording, or a named absence
 *
 * @example
 * ```ts
 * const reading = archiveStandsOr({ row, silence: 'contest-declined-and-archive-silent', },);
 * ```
 */
function archiveStandsOr(
  {
    row,
    silence,
  }: {
    readonly row: ArtifactComparisonRowV2;
    readonly silence: WouldShipSilence;
  },
): WouldShipReading {
  if ((row.incumbentKind === 'present') && (row.incumbentText !== ''))
    return {
      kind: 'wording',
      text: row.incumbentText,
      decidedBy: 'archive',
    };

  return {
    kind: 'nothing-ships',
    reason: silence,
  };
}

/**
 * What the third rendering contributes at one slice.
 *
 * A NAMED ABSENCE RATHER THAN `undefined`, for the reason the union it feeds
 * carries: this stage contributing nothing is a state to read, not a value
 * missing. `ArtifactConsolidateShippedV2` makes the same choice one level
 * below, and collapsing it here would put the trap back one call deeper.
 *
 * @example
 * ```ts
 * const contribution: ConsolidationContribution = { kind: 'replaced-nothing', };
 * ```
 */
type ConsolidationContribution =
  | {
    /**
     * This stage settled wording here, and it replaces whatever stood.
     */
    readonly kind: 'wording';

    /**
     * Exactly what it settled, wrapped as the stage left it.
     */
    readonly text: string;
  }
  | {
    /**
     * This stage replaced nothing here, so whatever stood still stands.
     */
    readonly kind: 'replaced-nothing';
  };

/**
 * Names the consolidation's wording at one slice, or that it contributed none.
 *
 * ONLY ONE TERMINAL YIELDS TEXT. `shipped` carries a `text` key exactly where
 * the terminal reads `consolidated`; every other terminal, including the three
 * the slate split into and the retired spelling four settled entries still
 * carry, leaves a bare `unchanged`. Testing the shape rather than enumerating
 * terminals is what keeps a terminal added later from silently yielding text.
 *
 * @param artifact - parsed artifact whose consolidation is being read
 *
 * @param chunkIndex - slice to answer for
 *
 * @returns Consolidated wording, or a stated absence when it replaced nothing
 *
 * @example
 * ```ts
 * const text = consolidatedWordingAt({ artifact, chunkIndex: 0, },);
 * ```
 */
function consolidatedWordingAt(
  {
    artifact,
    chunkIndex,
  }: {
    readonly artifact: WouldShipSource;
    readonly chunkIndex: number;
  },
): ConsolidationContribution {
  /**
   * What this artifact says about its third rendering, across all three states.
   */
  const { consolidation, } = artifact;
  if (consolidation.kind !== 'settled')
    return { kind: 'replaced-nothing', };

  /**
   * Record this stage left for the slice, absent where it was never eligible.
   */
  const slice = consolidation
    .slices
    .find(function namesIt(candidate: ArtifactConsolidateSliceV2,): boolean {
      return candidate.chunkIndex === chunkIndex;
    },);
  if (slice === undefined)
    return { kind: 'replaced-nothing', };

  /**
   * Wording this slice contributes, or a named absence saying it contributes none.
   */
  const { shipped, } = slice;
  if (shipped.kind !== 'consolidated')
    return { kind: 'replaced-nothing', };

  return {
    kind: 'wording',
    text: shipped.text,
  };
}

/**
 * Names what an uncontested slice contributes, where both lanes offer one wording.
 *
 * AGREEMENT NEEDS NO DECIDER, which is why this case has its own name rather
 * than falling through to the archive. `contestEligibleIndexes` makes a slice
 * eligible exactly where the lane texts differ, so a slice the contest never
 * saw is one where they match, and that matching wording is what stands.
 *
 * @param row - comparison row whose lane texts agree
 *
 * @returns Agreed wording, or a named absence when both lanes offer none
 *
 * @example
 * ```ts
 * const reading = lanesAgreedOn({ row, },);
 * ```
 */
function lanesAgreedOn(
  { row, }: { readonly row: ArtifactComparisonRowV2; },
): WouldShipReading {
  if (row.repairText !== row.translateText)
    throw new UnansweredContestSliceError({
      message: `slice ${String(row.chunkIndex,)} differs across lanes and the contest names it nowhere`,
    },);

  // AN AGREED EMPTY STRING IS A DECISION, not an absence to be filled from the
  // archive. It covers a gap neither lane wrote into and text both lanes
  // removed, and reviving the archive under either would republish wording the
  // lanes agreed to drop.
  if (row.repairText === '')
    return {
      kind: 'nothing-ships',
      reason: 'lanes-agreed-on-no-wording',
    };

  return {
    kind: 'wording',
    text: row.repairText,
    decidedBy: 'lanes-agreed',
  };
}

/**
 * Reads what one slice would contribute to a document assembled today.
 *
 * WALKS THE DECIDERS IN REVERSE ORDER OF WHEN THEY RAN, taking the first that
 * has something to say, because each stage was free to replace what the one
 * below it left. Reading any single stage's record answers a narrower question:
 * the repair lane's ledger claimed `replacement-shipped` at 6 rows of which 0
 * reached the page, since the contest had already chosen another lane at 5 and
 * the consolidation then overrode 4.
 *
 * @param artifact - parsed artifact, so a wrong key is a type error rather than
 * an `undefined` that reads as an answer
 *
 * @param row - comparison row to answer for
 *
 * @returns Wording this slice would carry, or a named reason it would carry none
 *
 * @throws {@link UnansweredContestSliceError} when the lanes differ at a slice
 * the contest record never answered
 *
 * @example
 * ```ts
 * const reading = wouldShipTextFor({ artifact, row, },);
 * ```
 */
export function wouldShipTextFor(
  {
    artifact,
    row,
  }: {
    readonly artifact: WouldShipSource;
    readonly row: ArtifactComparisonRowV2;
  },
): WouldShipReading {
  /**
   * Third rendering's wording, absent wherever it replaced nothing.
   */
  const consolidated = consolidatedWordingAt({
    artifact,
    chunkIndex: row.chunkIndex,
  },);
  if (consolidated.kind === 'wording')
    return {
      kind: 'wording',
      text: consolidated.text,
      decidedBy: 'consolidation',
    };

  /**
   * Which lane ships, or that nobody has been asked over this entry yet.
   */
  const { laneSelection, } = artifact;
  if (laneSelection.kind !== 'contested')
    return archiveStandsOr({
      row,
      silence: 'contest-unasked-and-archive-silent',
    },);

  /**
   * What the roster settled here, absent where this slice was never eligible.
   */
  const contested = laneSelection
    .slices
    .find(function namesIt(candidate: ArtifactContestSliceV2,): boolean {
      return candidate.chunkIndex === row.chunkIndex;
    },);
  if (contested === undefined)
    return lanesAgreedOn({ row, },);

  /**
   * Whether a lane carried the voices, and which one.
   */
  const { verdict, } = contested;
  if (verdict.kind === 'lane-won')
    return {
      kind: 'wording',
      text: (verdict.lane === 'repair') ? row.repairText : row.translateText,
      decidedBy: 'contest',
    };

  // NEITHER LANE CARRIED THE ROOM, whether because the voices split or because
  // too few arrived. No lane displaced the archive, so the archive stands.
  return archiveStandsOr({
    row,
    silence: 'contest-declined-and-archive-silent',
  },);
}

/**
 * Reads every slice of one artifact in comparison-row order.
 *
 * @param artifact - parsed artifact to read whole
 *
 * @returns One reading per comparison row, in the order the rows carry
 *
 * @throws {@link UnansweredContestSliceError} when any slice's lanes differ and
 * the contest record never answered it
 *
 * @example
 * ```ts
 * const slices = wouldShipTextPerSlice({ artifact, },);
 * ```
 */
export function wouldShipTextPerSlice(
  { artifact, }: { readonly artifact: WouldShipSource; },
): readonly WouldShipSlice[] {
  return artifact
    .comparison
    .map(function readIt(row: ArtifactComparisonRowV2,): WouldShipSlice {
      return {
        chunkIndex: row.chunkIndex,
        reading: wouldShipTextFor({
          artifact,
          row,
        },),
      };
    },);
}

//endregion Would-ship reader
