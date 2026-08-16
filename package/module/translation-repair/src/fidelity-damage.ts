import type { ChunkPair, } from './chunk-document.ts';
import { deriveOmissionSeeds, } from './derive-seeds.ts';
import { applySeededErrors, } from './seeded-error.ts';

//region Fidelity damage
// The two constructed defects `#84` puts on the ballot, kept apart from the
// probe that runs them because WHICH DEFECT IS BUILT decides what the resulting
// number can be read to mean.
//
// A DELETION alone cannot answer the question. The damaged text is the clean
// text minus a sentence, so the complete candidate is also the LONGER one in
// every arrangement, and rotating the ballot cannot separate a roster that reads
// from one that prefers length. Measured over four entries the roster chose the
// complete text in all sixteen trials, which rules out keeping what it was
// handed and preferring a position, and leaves length untouched.
//
// AN INSERTION INVERTS THAT. A sentence taken from ANOTHER SLICE OF THE SAME
// DOCUMENT is spliced into the clean text: same translator, same register, same
// subject, genuinely fluent, and unsupported by the original this slice shows
// the judges. The correct answer becomes the SHORTER candidate, so a roster that
// passes both fixtures cannot be reading length.
//
// WHAT THE INSERTION STILL CANNOT PROMISE: the borrowed sentence states
// something the document says elsewhere, and a fact repeated across slices could
// be supported by this slice's original after all. The donor is taken as far
// from the damaged slice as the document allows, which makes that unlikely
// rather than impossible, and a judge that keeps the longer text for that reason
// is wrong about redundancy rather than about coverage.

/**
 * Which constructed defect a trial carries.
 *
 * @example
 * ```ts
 * const damageKind: FidelityDamageKind = 'insertion';
 * ```
 */
export type FidelityDamageKind = 'deletion' | 'insertion';

/**
 * One damaged twin, or the fact that this slice admits none.
 *
 * @example
 * ```ts
 * const attempt: DamageAttempt = deleteOneSentence({ cleanText, },);
 * ```
 */
export type DamageAttempt = {
  /**
   * A defect was planted.
   */
  readonly kind: 'damaged';

  /**
   * Which defect it is.
   */
  readonly damageKind: FidelityDamageKind;

  /**
   * Slice text carrying it.
   */
  readonly damagedText: string;

  /**
   * Characters the edit removed or added, so a trial can report how much text
   * separates the candidates.
   */
  readonly changedChars: number;
} | {
  /**
   * Nothing could be planted here. An ordinary property of a slice rather than
   * a failure: every sentence may be too short, or occur more than once, or the
   * donor may already be saying what this slice says.
   */
  readonly kind: 'undamageable';

  /**
   * Which of those it was, kept so a run that damages little says why.
   */
  readonly reason: string;
};

/**
 * Longest sentence a text admits as an unambiguous needle.
 *
 * @param text - passage to draw from
 *
 * @returns Sentence, or empty when the text admits none
 *
 * @example
 * ```ts
 * const sentence = anchorSentence({ text: cleanText, },);
 * ```
 */
function anchorSentence({ text, }: { readonly text: string; },): string {
  /**
   * Seed carrying that sentence, absent when every sentence is short or
   * repeated.
   */
  const seed = deriveOmissionSeeds({
    text,
    maxSeeds: 1,
  },)
    .at(0,);
  return seed?.needle ?? '';
}

/**
 * Removes one whole sentence, which is the coverage defect.
 *
 * @param cleanText - slice English as the archive holds it
 *
 * @returns Damaged twin and what it cost, or why none could be built
 *
 * @example
 * ```ts
 * const attempt = deleteOneSentence({ cleanText, },);
 * ```
 */
export function deleteOneSentence(
  { cleanText, }: { readonly cleanText: string; },
): DamageAttempt {
  /**
   * Sentence to remove.
   */
  const needle = anchorSentence({ text: cleanText, },);
  if (needle === '')
    return {
      kind: 'undamageable',
      reason: 'no sentence long enough and unique enough to delete',
    };

  /**
   * Slice with that sentence gone.
   */
  const seeded = applySeededErrors({
    text: cleanText,
    specs: [
      {
        id: 'fidelity/deletion',
        category: 'accuracy/omission',
        kind: 'deletion',
        needle,
        replacement: '',
      },
    ],
  },);
  if (seeded.seededText === cleanText)
    return {
      kind: 'undamageable',
      reason: 'deletion left the text unchanged',
    };
  return {
    kind: 'damaged',
    damageKind: 'deletion',
    damagedText: seeded.seededText,
    changedChars: needle.length,
  };
}

/**
 * Splices a sentence borrowed from elsewhere in the document into the clean
 * text, which is the addition defect and the one whose correct answer is the
 * SHORTER candidate.
 *
 * @param cleanText - slice English as the archive holds it
 *
 * @param donorText - English of a different slice of the same document
 *
 * @returns Damaged twin and what it cost, or why none could be built
 *
 * @example
 * ```ts
 * const attempt = insertBorrowedSentence({ cleanText, donorText, },);
 * ```
 */
export function insertBorrowedSentence(
  {
    cleanText,
    donorText,
  }: {
    readonly cleanText: string;
    readonly donorText: string;
  },
): DamageAttempt {
  /**
   * Sentence to borrow, drawn the same way the deletion draws its own so both
   * fixtures move a comparable amount of text.
   */
  const borrowed = anchorSentence({ text: donorText, },);
  if (borrowed === '')
    return {
      kind: 'undamageable',
      reason: 'donor slice offers no sentence long enough and unique enough to borrow',
    };
  if (cleanText.includes(borrowed,))
    return {
      kind: 'undamageable',
      reason: 'borrowed sentence already appears in this slice, so it would add nothing',
    };

  /**
   * Sentence the borrowed one is placed after, which must occur exactly once
   * for the splice point to be defined.
   */
  const anchor = anchorSentence({ text: cleanText, },);
  if (anchor === '')
    return {
      kind: 'undamageable',
      reason: 'no sentence long enough and unique enough to splice after',
    };

  /**
   * Slice carrying the borrowed sentence.
   */
  const seeded = applySeededErrors({
    text: cleanText,
    specs: [
      {
        id: 'fidelity/insertion',
        category: 'accuracy/addition',
        kind: 'insertion',
        needle: anchor,
        // Led by a space so the splice reads as the next sentence of the same
        // paragraph rather than as a run-on.
        replacement: ` ${borrowed}`,
      },
    ],
  },);
  if (seeded.seededText === cleanText)
    return {
      kind: 'undamageable',
      reason: 'insertion left the text unchanged',
    };
  return {
    kind: 'damaged',
    damageKind: 'insertion',
    damagedText: seeded.seededText,
    changedChars: borrowed.length,
  };
}

/**
 * English of the slice furthest from the one being damaged, which is where the
 * insertion fixture borrows its sentence.
 *
 * FURTHEST RATHER THAN ADJACENT, because the borrowed sentence must be
 * unsupported by the damaged slice's own original. Neighbouring slices of a
 * biography often restate the same fact in different words, and a judge that
 * kept the longer text on those would be right about the document while the
 * trial recorded it as wrong.
 *
 * @param slices - prepared slice pairs of one entry
 *
 * @param sliceIndex - slice being damaged, which cannot donate to itself
 *
 * @returns English of the donor, empty when the entry has no other slice
 *
 * @example
 * ```ts
 * const donorText = donorTextFor({ slices, sliceIndex, },);
 * ```
 */
export function donorTextFor(
  {
    slices,
    sliceIndex,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly sliceIndex: number;
  },
): string {
  /**
   * Every other slice that carries English, paired with its distance.
   */
  const candidates = slices
    .map(function toCandidate(
      slice,
      index,
    ): {
      readonly distance: number;
      readonly text: string;
    } {
      /**
       * English this slice carries, EMPTY on an insertion anchor rather than
       * absent: both members of `DocumentChunk` declare `text`, and an anchor
       * names a boundary where text is not.
       */
      const carried = slice.target
        .text;
      return {
        distance: Math.abs(index - sliceIndex,),
        text: carried,
      };
    },)
    .filter(function isUsable(candidate,): boolean {
      return (candidate.distance > 0) && (candidate.text !== '');
    },);

  /**
   * Furthest of them, ties going to the earlier slice because `reduce` keeps
   * what it has on an equal distance.
   */
  const furthest = candidates.reduce(
    function byDistance(
      best,
      candidate,
    ) {
      return (candidate.distance > best.distance) ? candidate : best;
    },
    {
      distance: 0,
      text: '',
    },
  );
  return furthest.text;
}

//endregion Fidelity damage
