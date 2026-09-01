import { producerModelIds, } from '../candidate-select-model.ts';
import {
  coverageGapLines,
  readStandingCoverage,
  type SeatAnswers,
} from '../producer-silence.ts';
import { producerStandings, } from '../producer-standing.ts';
import {
  rankStandings,
  standingLine,
} from '../producer-standing-report.ts';
import type { RosterModelId, } from '../roster-id.ts';
import type { SelectionRound, } from '../self-preference.ts';

//region Standing report
// ONE SEAT'S STANDING, RENDERED AS LINES rather than printed, so the report can
// be read by a test without capturing the console. `editor-calibrate.ts` is an
// entry module and prints what this returns; it moved here when that file
// reached the line budget.

/**
 * Every model holding a stake in any candidate one seat's rounds judged.
 *
 * @internal
 *
 * @param perSlice - that seat's rounds, grouped by the slice that bought them
 *
 * @returns Model ids, repeats included, in the order the slates carried them
 *
 * @example
 * ```ts
 * const wrote = judgedAuthors({ perSlice, },);
 * ```
 */
export function judgedAuthors(
  { perSlice, }: { readonly perSlice: readonly (readonly SelectionRound[])[]; },
): readonly RosterModelId[] {
  return perSlice
    .flat()
    .flatMap(function slateAuthors(round,): readonly RosterModelId[] {
      return round
        .producers
        .flatMap(function stakeholders(producer,): readonly RosterModelId[] {
          return producerModelIds(producer,);
        },);
    },);
}

/**
 * Renders one seat's counts per slice, so a reader can bootstrap over slices.
 *
 * SLICES ARE THE INDEPENDENT UNIT, NOT BALLOTS. Every ballot in a round was
 * cast over one slate and every round on a slice was cut from one passage, so
 * the pooled share's ballot-level error understates how far a standing moves
 * between runs: a four-slice standing moved one model from 52.2 to 26.7 to
 * 10.0 percent across identical runs. A bootstrap over whole slices needs each
 * slice's counts, and the pooled table throws them away. These lines keep them
 * in sample order, so each pairs with its slice progress line by position, and
 * they carry votes, ballots and candidates rather than a share, for the reason
 * the pooled line carries its denominator.
 *
 * @internal
 *
 * @param perSlice - that seat's rounds, grouped by the slice that bought them
 *
 * @returns One line per slice that bought a round, none for the rest
 *
 * @example
 * ```ts
 * for (const line of sliceStandingLines({ perSlice, },))
 *   console.log(line,);
 * ```
 */
export function sliceStandingLines(
  { perSlice, }: { readonly perSlice: readonly (readonly SelectionRound[])[]; },
): readonly string[] {
  return perSlice.flatMap(function sliceLine(
    rounds,
    index,
  ): readonly string[] {
    if (rounds.length === 0)
      return [];

    /**
     * Per-model counts over this slice alone, best first.
     */
    const cells = rankStandings({ standings: producerStandings({ rounds, },), },)
      .map(function cell(standing,): string {
        return `${standing.modelId} ${String(standing.disinterestedVotes,)}/${
          String(standing.disinterestedBallots,)
        } over ${String(standing.candidates,)}`;
      },);

    return [
      `  slice ${String(index + 1,)}: ${String(rounds.length,)} rounds; ${cells.join('; ',)}`,
    ];
  },);
}

/**
 * Renders one seat's standing over the rounds it produced, then the same
 * counts per slice.
 *
 * @internal
 *
 * @param seat - what the standing is about, for the heading
 *
 * @param roster - seats the run filled, which the coverage is read against
 *
 * @param perSlice - that seat's rounds, grouped by the slice that bought them
 *
 * @param produced - models known to have written a candidate, judged or not
 *
 * @param answered - who the seat heard, or that it does not record that
 *
 * @returns Report lines carrying their own indentation, heading first
 *
 * @example
 * ```ts
 * for (const line of standingReportLines({ seat: 'EDITOR', roster, perSlice, produced, answered, },))
 *   console.log(line,);
 * ```
 */
export function standingReportLines(
  {
    seat,
    roster,
    perSlice,
    produced,
    answered,
  }: {
    readonly seat: string;
    readonly roster: readonly RosterModelId[];
    readonly perSlice: readonly (readonly SelectionRound[])[];
    readonly produced: readonly RosterModelId[];
    readonly answered: SeatAnswers;
  },
): readonly string[] {
  /**
   * Every round this seat produced, across every slice.
   */
  const rounds = perSlice.flat();

  /**
   * Slices that produced any round at all.
   */
  const contributed = perSlice.filter(function paidIn(slice,): boolean {
    return slice.length > 0;
  },);

  /**
   * Heading every report starts with.
   */
  const heading = `\n${seat} standing over ${String(rounds.length,)} judged rounds, `
    + `from ${String(contributed.length,)} of ${String(perSlice.length,)} slices`;

  if (rounds.length === 0) {
    return [
      heading,
      '  NO ROUNDS. This seat judged nothing across the sample, so it has no standing. '
        + 'For the editor seat that means no slice carried an ACCEPTED issue: critics can '
        + 'raise claims and the panel can adjudicate them and the lane still report '
        + '"nothing to edit", which is what one live slice did. For the refiner seat it '
        + 'means the naturalness lane proposed nothing. Draw more slices.',
    ];
  }

  /**
   * Rows of the table, one per model somebody voted on.
   */
  const standings = producerStandings({ rounds, },);

  /**
   * Which of the seated models this table actually describes.
   *
   * NAMED RATHER THAN OMITTED. `producerStandings` carries a row only for a
   * model somebody voted on, so a model whose provider was out of budget
   * vanishes, and absence there reads exactly like a model that wrote and
   * lost. During a provider outage that is half the roster.
   */
  const coverage = readStandingCoverage({
    roster,
    standings,
    produced,
    answered,
  },);

  return [
    heading,
    ...rankStandings({ standings, },)
      .map(function rendered(standing,): string {
        return `  ${standingLine({ standing, },)}`;
      },),
    ...coverageGapLines({ coverage, },)
      .map(function indented(line,): string {
        return `  ${line}`;
      },),
    ...sliceStandingLines({ perSlice, },),
  ];
}

//endregion Standing report
