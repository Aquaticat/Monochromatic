//region Non-translation finding
// The sentence a blocked document carries, in ONE place.
//
// WHY IT LIVES ALONE. Two callers build it: `repair-translation.ts` logs it when
// it decides to block, and `repair-blocked-exit.ts` writes it into the findings
// of the result that decision produces. They held two copies of the same
// template, which is how they came to disagree: a correction to one left the
// other saying something the code no longer did. A reader comparing a log line
// against an artifact finding is comparing two renderings of one fact, and they
// have to be one rendering.

/**
 * Sentence naming a non-translation block and the population it was decided
 * over.
 *
 * IT SAYS "EXAMINED SLICES" RATHER THAN "TARGET CHARS", and the distinction is
 * the whole reason this wording was revisited. Neither number counts the
 * translation: both are sums over the PREPARED SLICES, so a section the aligner
 * refused to pair produces no slice and lands in neither term. A document can
 * therefore be blocked on a majority of the part that was examined while its
 * unexamined bulk is ordinary translation, and a reader told "900 of 1100 target
 * chars" would have no way to know that.
 *
 * Decided 2026-08-16, question 7 answer B, in
 * `doc/decision/translation-repair-question-answers.md`: keep the slice
 * denominator, and stop calling it the document's. Reporting an entry as
 * unexaminable is a different behaviour that waits on `#96`.
 *
 * @param standingChars - characters under standing non-translation votes
 *
 * @param totalChars - characters across every prepared slice, which is what
 * both terms are measured against and is not the whole translation
 *
 * @returns Finding sentence, identical wherever it is reported
 *
 * @example
 * ```ts
 * const finding = nonTranslationDominanceFinding({ standingChars: 900, totalChars: 1_100, },);
 * ```
 */
export function nonTranslationDominanceFinding(
  {
    standingChars,
    totalChars,
  }: {
    readonly standingChars: number;
    readonly totalChars: number;
  },
): string {
  return `non-translation dominance (${String(standingChars,)} of ${
    String(totalChars,)
  } chars across examined slices, which is not the whole translation)`;
}

//endregion Non-translation finding
