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

//region Seat report
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
 * Renders one seat's standing over the rounds it produced.
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
 * for (const line of seatReportLines({ seat: 'EDITOR', roster, perSlice, produced, answered, },))
 *   console.log(line,);
 * ```
 */
export function seatReportLines(
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
    ...rankStandings({ standings, },).map(function rendered(standing,): string {
      return `  ${standingLine({ standing, },)}`;
    },),
    ...coverageGapLines({ coverage, },).map(function indented(line,): string {
      return `  ${line}`;
    },),
  ];
}

//endregion Seat report
