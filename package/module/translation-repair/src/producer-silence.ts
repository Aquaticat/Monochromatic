import type { ProducerStanding, } from './producer-standing.ts';
import type { RosterModelId, } from './roster-id.ts';

//region Producer silence
// WHO IS MISSING FROM A STANDING TABLE, and which of the two reasons it is.
//
// `producerStandings` counts ballots, so it carries a row only for a model that
// wrote a candidate somebody voted on. Every other seated model vanishes, and an
// absent row reads exactly like a model that wrote and lost. Twice that has been
// the wrong reading: a provider out of credit takes half the roster off the
// table, and a slate where every producer proposed the same wording ships
// without a ballot being cast over it.
//
// THE TWO REASONS CALL FOR DIFFERENT ACTIONS, which is why they are separated
// rather than reported as one absence. A model that wrote nothing is evidence
// nobody has bought yet, and re-running those seats buys it. A model that wrote
// text nobody voted on has already been paid for, and only more slices separate
// it from a model that lost.
//
// SEATED ROSTER IN, so this file names no roster of its own. Both calibrations
// pass the seats they filled, and a table describing seats a run never filled is
// refused rather than reported.

/**
 * Roster models a standing table does and does not describe.
 *
 * THE THREE STATES ARE DISJOINT AND COVER THE SEATED ROSTER, so a reader can
 * add the lengths and check the total against the seats a run filled.
 *
 * @example
 * ```ts
 * const { judged, wroteUnjudged, neverWrote, } = readStandingCoverage({ roster, standings, produced, },);
 * ```
 */
export type StandingCoverage = {
  /**
   * Models the standing table carries a row for.
   */
  readonly judged: readonly RosterModelId[];

  /**
   * Models that produced text no disinterested judge ever voted on.
   */
  readonly wroteUnjudged: readonly RosterModelId[];

  /**
   * Models no candidate of which reached any slate.
   */
  readonly neverWrote: readonly RosterModelId[];
};

/**
 * Raised when a standing or a slate names a model the run never seated.
 *
 * @example
 * ```ts
 * throw new UnseatedStandingError({ modelIds: ['minimax-m3',], },);
 * ```
 */
export class UnseatedStandingError extends Error {
  /**
   * Declares this message safe to forward: it names model ids.
   */
  readonly messageNamesOnly: true = true;

  /**
   * @param modelIds - models named by the evidence and absent from the roster
   */
  public constructor(
    { modelIds, }: { readonly modelIds: readonly RosterModelId[]; },
  ) {
    super(
      `evidence names ${modelIds.join(', ',)}, which this run never seated, so the table `
        + 'describes a roster other than the one measured and its shares compare nothing',
    );
    this.name = 'UnseatedStandingError';
  }
}

/**
 * Splits a seated roster by what the standing table can say about each model.
 *
 * @param roster - seats this run filled
 *
 * @param standings - what the ballot tally produced
 *
 * @param produced - models known to have written a candidate, judged or not;
 * a caller that cannot tell passes what it can see, and everything it cannot
 * falls into `neverWrote`
 *
 * @returns Seated roster split three ways
 *
 * @throws {@link UnseatedStandingError} when a standing or a produced model was
 * never seated, since coverage of one roster cannot be read off another
 *
 * @example
 * ```ts
 * const coverage = readStandingCoverage({ roster: RUN_ROSTER, standings, produced, },);
 * ```
 */
export function readStandingCoverage(
  {
    roster,
    standings,
    produced,
  }: {
    readonly roster: readonly RosterModelId[];
    readonly standings: readonly ProducerStanding[];
    readonly produced: readonly RosterModelId[];
  },
): StandingCoverage {
  /**
   * Seats this run filled, for membership tests.
   */
  const seated = new Set(roster,);

  /**
   * Models the standing table carries a row for.
   */
  const judged = new Set(standings.map(function toModelId(standing,): RosterModelId {
    return standing.modelId;
  },),);

  /**
   * Models known to have written something, whether or not it was judged.
   */
  const wrote = new Set(produced,);

  /**
   * Models the evidence names that no seat was filled with.
   */
  const unseated = [
    ...judged,
    ...wrote,
  ].filter(function wasNotSeated(modelId,): boolean {
    return !seated.has(modelId,);
  },);

  // BOTH INPUTS ARE CHECKED AGAINST THE SEATS, because either one naming an
  // unseated model means the table and the roster came from different runs, and
  // reporting coverage across those would compare shares nothing shares.
  if (unseated.length > 0)
    throw new UnseatedStandingError({ modelIds: unseated, },);

  return {
    judged: roster.filter(function hasRow(modelId,): boolean {
      return judged.has(modelId,);
    },),
    wroteUnjudged: roster.filter(function wroteOnly(modelId,): boolean {
      return wrote.has(modelId,) && (!judged.has(modelId,));
    },),
    neverWrote: roster.filter(function stayedSilent(modelId,): boolean {
      return (!wrote.has(modelId,)) && (!judged.has(modelId,));
    },),
  };
}

/**
 * Renders what the standing table leaves out, one line per reason.
 *
 * PRINTS NOTHING WHERE THERE IS NOTHING TO SAY, so a run with the whole roster
 * on the table carries no note claiming completeness it would then have to
 * keep true.
 *
 * @param coverage - seated roster split three ways
 *
 * @returns Report lines, empty where every seated model was judged
 *
 * @example
 * ```ts
 * for (const line of coverageGapLines({ coverage, },))
 *   console.log(`  ${line}`,);
 * ```
 */
export function coverageGapLines(
  { coverage, }: { readonly coverage: StandingCoverage; },
): readonly string[] {
  /**
   * Models that wrote and drew no ballot, rendered for the line.
   */
  const unvoted = coverage
    .wroteUnjudged
    .join(', ',);

  /**
   * Models that wrote nothing, rendered the same way.
   */
  const silent = coverage
    .neverWrote
    .join(', ',);

  /**
   * Seats the table describes, which is the numerator the silent line needs.
   */
  const described = coverage
    .judged
    .length;

  /**
   * Seats the coverage was read over, summed back from its three parts.
   */
  const seats = described
    + coverage
      .wroteUnjudged
    .length
    + coverage
      .neverWrote
    .length;

  return [
    ...((unvoted === '')
      ? []
      : [
        `WROTE AND WAS NEVER VOTED ON: ${unvoted}. Their text reached a slate and no `
        + 'disinterested ballot was cast over it, which is what a slice where every producer '
          + 'proposed the same wording does: it ships unjudged. The table says nothing about them '
          + 'either way, and more slices are what would.',
      ]),
    ...((silent === '')
      ? []
      : [
        `WROTE NOTHING AT ALL: ${silent}. No candidate of theirs reached any slate, so the table `
        + `covers ${String(described,)} of ${String(seats,)} seats. A provider out of budget, a `
          + 'refused sheet and a call that timed out all look like this from here; the run log '
          + 'names which. Re-run these seats before reading the table as a comparison of the '
          + 'roster.',
      ]),
  ];
}

//endregion Producer silence
