import { quoteBlockCount, } from './markdown-blocks.ts';

//region Quote preservation
// A REPLACEMENT MAY NOT LEAVE THE DOCUMENT WITH FEWER QUOTED PASSAGES THAN THE
// ARCHIVE HAD.
//
// WHY THIS QUESTION RATHER THAN THE OTHER ONE. The harm is that a lane writing
// from the source alone deletes English the source cannot account for, and the
// obvious response is to work out which passages those are. That turns out not
// to be decidable cheaply: translation changes bytes by construction, so no
// exact match distinguishes an unpaired passage from an ordinary translated
// one, and deciding it properly is what the aligner already does. Measured
// against the nine transcripts known in the corpus, a structural rule anchored
// on shared markup reaches two of them, and fails three separate ways on the
// rest.
//
// DELETION, ON THE OTHER HAND, IS DECIDABLE FROM THE TWO TEXTS ALONE. Measured
// over both settled pools on 2026-08-18:
//
//   flagged pool   4 of 64 shipped replacements drop a whole quote block
//                  all four in the translate lane
//   natural pool   0 of 69
//
// Four hits, every one a passage a reader would want back, and no false
// positive in sixty-nine natural rows.
//
// THE COUNTER-CASE THAT KEEPS THIS HONEST. Deleting is not always wrong: on one
// entry the repair lane removed a paragraph of translator invention with nine
// separate accepted findings against it, and that was correct. It was not a
// blockquote, so this guard would not have stopped it. The guard is deliberately
// narrow for that reason: it protects the shape transcripts and quoted letters
// take, and says nothing about prose.

/**
 * Whether a replacement would leave fewer quoted passages than the archive has.
 *
 * @param incumbentText - archive wording being replaced
 *
 * @param shippedText - wording the lane wants to put there
 *
 * @returns Whether a quoted passage would be lost
 *
 * @example
 * ```ts
 * const lost = dropsQuotedPassage({ incumbentText, shippedText, },);
 * ```
 */
export function dropsQuotedPassage(
  {
    incumbentText,
    shippedText,
  }: {
    readonly incumbentText: string;
    readonly shippedText: string;
  },
): boolean {
  return quoteBlockCount({ text: shippedText, },) < quoteBlockCount({ text: incumbentText, },);
}

/**
 * Names a quote-loss refusal in scorecard-stable wording.
 *
 * PARALLEL TO THE ALIGNMENT REFUSAL, so a run's findings read the same way
 * whichever guard kept the archive, and so a corpus-wide count can separate
 * them.
 *
 * @param chunkIndex - slice refused
 *
 * @param incumbentText - archive wording that was kept
 *
 * @param shippedText - wording that was refused
 *
 * @returns One finding line
 *
 * @example
 * ```ts
 * const finding = quoteLossRefusalFinding({ chunkIndex, incumbentText, shippedText, },);
 * ```
 */
export function quoteLossRefusalFinding(
  {
    chunkIndex,
    incumbentText,
    shippedText,
  }: {
    readonly chunkIndex: number;
    readonly incumbentText: string;
    readonly shippedText: string;
  },
): string {
  return `translate-refused-quote-loss (slice ${String(chunkIndex,)}: archive carries ${
    String(quoteBlockCount({ text: incumbentText, },),)
  } quoted passages, replacement carries ${
    String(quoteBlockCount({ text: shippedText, },),)
  })`;
}

//endregion Quote preservation
