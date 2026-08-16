import type { ChunkPair, } from './chunk-document.ts';
import { deriveOmissionSeeds, } from './derive-seeds.ts';
import {
  sharedNumber,
  unsupportedVariant,
} from './fidelity-alteration.ts';
import { spliceOutSentence, } from './fidelity-splice.ts';
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
// NEITHER OF THOSE SHOWS THE ORIGINAL WAS READ. A judge that never looks at the
// Chinese and simply prefers whichever English reads better passes both, since a
// deletion leaves a gap and a borrowed sentence is a non-sequitur. The third
// fixture, an ALTERATION, changes a number the original also states: same
// length, same fluency, and decidable only against the source.
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
export type FidelityDamageKind = 'deletion' | 'insertion' | 'alteration';

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
   * Slice with that sentence gone and the join left unmarked.
   *
   * NOT `applySeededErrors`, which cuts the sentence and leaves both separators:
   * that left a double space mid-paragraph and three consecutive newlines where
   * a whole paragraph went, either of which a judge can see without reading the
   * original. `spliceOutSentence` says why the shared primitive is not the place
   * to fix it.
   */
  const damagedText = spliceOutSentence({
    text: cleanText,
    needle,
  },);
  if (damagedText === cleanText)
    return {
      kind: 'undamageable',
      reason: 'deletion left the text unchanged',
    };
  if (damagedText.trim() === '')
    return {
      kind: 'undamageable',
      reason: 'deletion would leave the slice empty, which is a shape no translation takes',
    };
  return {
    kind: 'damaged',
    damageKind: 'deletion',
    damagedText,
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
 * @param donorTexts - English of other slices of the same document, FURTHEST
 * FIRST, of which the first usable one donates
 *
 * @returns Damaged twin and what it cost, or why none could be built
 *
 * @example
 * ```ts
 * const attempt = insertBorrowedSentence({ cleanText, donorTexts, },);
 * ```
 */
export function insertBorrowedSentence(
  {
    cleanText,
    donorTexts,
  }: {
    readonly cleanText: string;
    readonly donorTexts: readonly string[];
  },
): DamageAttempt {
  /**
   * Sentence to borrow, drawn the same way the deletion draws its own so both
   * fixtures move a comparable amount of text.
   *
   * THE FIRST USABLE DONOR RATHER THAN THE FURTHEST ONE FULL STOP. Measured on
   * the corpus, taking only the furthest slice refused fifteen of sixteen
   * attempts: the last slice of a memorial entry is often a short list, a
   * credit line or a single sentence, and none of those offers a borrowable
   * sentence. Refusing there would have sampled only documents that happen to
   * end in prose, which is a selection rule nobody chose. Order still carries
   * the preference, so the borrowed sentence is as far from the damaged slice
   * as the document allows.
   */
  const offered = donorTexts
    .map(function toSentence(donorText,) {
      return anchorSentence({ text: donorText, },);
    },);

  /**
   * First offered sentence this slice does not already carry, absent when every
   * donor is empty or repeats something here.
   */
  const usable = offered.find(function isUsable(sentence,) {
    if (sentence === '')
      return false;
    return !cleanText.includes(sentence,);
  },);

  /**
   * That sentence, or empty when no donor offered one.
   */
  const borrowed = usable ?? '';
  if (borrowed === '')
    return {
      kind: 'undamageable',
      reason: 'no other slice offers a sentence this one does not already carry',
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
 * English of every other slice, FURTHEST FIRST, which is where the insertion
 * fixture borrows its sentence.
 *
 * FURTHEST FIRST, because the borrowed sentence must be unsupported by the
 * damaged slice's own original. Neighbouring slices of a biography often restate
 * the same fact in different words, and a judge that kept the longer text on
 * those would be right about the document while the trial recorded it as wrong.
 * Ordering rather than selecting is what keeps that preference without letting
 * one unusable slice refuse the whole entry.
 *
 * @param slices - prepared slice pairs of one entry
 *
 * @param sliceIndex - slice being damaged, which cannot donate to itself
 *
 * @returns English of every other slice that carries some, furthest first
 *
 * @example
 * ```ts
 * const donorTexts = donorTextsFor({ slices, sliceIndex, },);
 * ```
 */
export function donorTextsFor(
  {
    slices,
    sliceIndex,
  }: {
    readonly slices: readonly ChunkPair[];
    readonly sliceIndex: number;
  },
): readonly string[] {
  return slices
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
    },)
    .toSorted(function byDistanceDescending(
      a,
      b,
    ): number {
      return b.distance - a.distance;
    },)
    .map(function toText(candidate,): string {
      return candidate.text;
    },);
}

/**
 * Changes a number the original also states, which is the fixture no amount of
 * reading the English can decide.
 *
 * @param cleanText - archive English for this slice
 *
 * @param sourceText - Chinese original for the same slice
 *
 * @returns Damaged twin and what it cost, or why none could be built
 *
 * @example
 * ```ts
 * const attempt = alterSharedNumber({ cleanText, sourceText, },);
 * ```
 */
export function alterSharedNumber(
  {
    cleanText,
    sourceText,
  }: {
    readonly cleanText: string;
    readonly sourceText: string;
  },
): DamageAttempt {
  /**
   * Number both sides carry, which the English states exactly once.
   */
  const original = sharedNumber({
    cleanText,
    sourceText,
  },);
  if (original === '')
    return {
      kind: 'undamageable',
      reason: 'no number long enough that both the original and this slice state exactly once',
    };

  /**
   * Same-shape number NEITHER side supports, so the damaged text asserts
   * something no reading of the original can back.
   */
  const variant = unsupportedVariant({
    original,
    cleanText,
    sourceText,
  },);
  if (variant === '')
    return {
      kind: 'undamageable',
      reason: 'every same-shape number already appears on one side or the other',
    };

  /**
   * Where the number sits, which is unique by construction.
   */
  const at = cleanText.indexOf(original,);

  /**
   * Slice stating the wrong number and nothing else changed.
   */
  const damagedText = cleanText.slice(
    0,
    at,
  )
    + variant
    + cleanText.slice(at + original.length,);
  return {
    kind: 'damaged',
    damageKind: 'alteration',
    damagedText,
    changedChars: original.length,
  };
}

//endregion Fidelity damage
