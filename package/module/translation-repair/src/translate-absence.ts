//region Translate absence
// What the translate lane does when there is no incumbent to fall back on.
//
// Every fallback in the stage ships the translation that is already there. That
// is the right answer for a slice the archive HAS translated: leaving a passage
// as it stands is the state the run began in, while shipping text no judge
// vetted is a new claim about the archive. For a slice the archive has NOT
// translated, the same fallback ships nothing at all, reports a settled slice,
// and the run reads as having delivered a translation it never produced.
//
// A MODE RATHER THAN AN INFERENCE. Absence is decided once, from the target
// chunk being an insertion anchor, and travels as a discriminant. Reading it
// off `incumbentText === ''` would conflate two different slices: an anchor,
// where a rendering belongs and none exists, and a content span that genuinely
// holds nothing but whitespace, where the archive's own wording is the blank.
//
// AN ERROR RATHER THAN A RESULT, because there is no honest result to build.
// The stage returns the text that ships plus who produced it, and in this case
// nothing ships and nobody produced it; every field would have to be invented.
// The driver above catches this, records the slice as unfilled, and leaves the
// archive's gap exactly as it found it, so one refused anchor costs its own
// slice rather than the entry.

/**
 * Whether a slice has a translation to fall back on.
 *
 * @example
 * ```ts
 * const incumbentKind: IncumbentKind = isInsertionChunk(slice.target,) ? 'absent' : 'present';
 * ```
 */
export type IncumbentKind =
  /**
   * Archive holds a translation for this slice, which stands unless judges
   * prefer something else.
   */
  | 'present'
  /**
   * Archive holds none, so there is nothing to fall back on and the slice is
   * either filled by this run or left as the gap it is.
   */
  | 'absent';

/**
 * Why a slice with no incumbent could not be filled.
 *
 * @example
 * ```ts
 * const reason: TranslateAbsenceReason = 'no-candidate';
 * ```
 */
export type TranslateAbsenceReason =
  /**
   * Nothing usable was proposed: every translator was silent, blank, or lost
   * its voice, and there is no incumbent to stand in their place.
   */
  | 'no-candidate'
  /**
   * Judges could not settle on one candidate.
   */
  | 'declined-indecision'
  /**
   * Judges rejected every candidate they were shown.
   */
  | 'declined-rejection'
  /**
   * Selection returned text that says nothing, for a source that does.
   */
  | 'blank-selection';

/**
 * Raised when a slice with no incumbent produced no translation to write.
 *
 * CARRIES ITS FINDINGS, because the work that led here is real evidence: which
 * translators were heard, what collapsed, what the judges counted. Thrown away
 * with the exception, that evidence would leave a run reporting an unfilled
 * passage with nothing to say about why.
 *
 * @example
 * ```ts
 * throw new TranslateAbsenceError({ reason: 'no-candidate', findings, },);
 * ```
 */
export class TranslateAbsenceError extends Error {
  /**
   * Why the slice could not be filled.
   */
  public readonly reason: TranslateAbsenceReason;

  /**
   * What the stage had gathered before it gave up.
   */
  public readonly findings: readonly string[];

  /**
   * Builds the refusal with the evidence the stage had collected.
   *
   * @param reason - why nothing could be written
   *
   * @param findings - stage findings up to this point, kept for the record
   *
   * @example
   * ```ts
   * throw new TranslateAbsenceError({ reason: 'declined-indecision', findings, },);
   * ```
   */
  public constructor(
    {
      reason,
      findings,
    }: {
      readonly reason: TranslateAbsenceReason;
      readonly findings: readonly string[];
    },
  ) {
    super(
      `slice has no translation in the archive and produced none (${reason}), `
        + 'so there is nothing to write and nothing to fall back on',
    );
    this.name = 'TranslateAbsenceError';
    this.reason = reason;
    this.findings = findings;
  }
}

/**
 * Reports whether a winning text says nothing about a source that says
 * something.
 *
 * Asked of the SOURCE rather than of the winner alone, because a rendering of
 * nothing is nothing: it is only a defect where there was a passage to render.
 *
 * @param winner - text selection chose
 *
 * @param sourceText - original that text is meant to render
 *
 * @returns Whether shipping it would delete a passage
 *
 * @example
 * ```ts
 * const empty = blankAgainst({ winner: outcome.value.text, sourceText, },);
 * ```
 */
export function blankAgainst(
  {
    winner,
    sourceText,
  }: {
    readonly winner: string;
    readonly sourceText: string;
  },
): boolean {
  /**
   * Whether the winner says anything at all.
   */
  const saysNothing = winner.trim()
    === '';

  /**
   * Whether there was something to render.
   */
  const sourceSaysSomething = sourceText.trim()
    !== '';

  return saysNothing && sourceSaysSomething;
}

/**
 * Names an unfilled slice the way every other stage finding is named.
 *
 * @param reason - why nothing could be written
 *
 * @returns Finding in scorecard-stable wording
 *
 * @example
 * ```ts
 * const finding = absenceFinding({ reason: 'no-candidate', },);
 * ```
 */
export function absenceFinding(
  { reason, }: { readonly reason: TranslateAbsenceReason; },
): string {
  return `translate-unfilled (${reason})`;
}

//endregion Translate absence
