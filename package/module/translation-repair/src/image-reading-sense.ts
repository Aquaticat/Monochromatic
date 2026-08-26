//region Image reading sense
// WHETHER A MODEL'S READING OF A PICTURE IS ABOUT THE RIGHT PICTURE AT ALL.
//
// `#111` supplies the image so a transcribed passage has a source that can be
// checked, and falls back to protecting the block structurally "whenever an
// image's OCR doesn't make sense". The rule is written out in
// `doc/planning/when-an-image-reading-makes-no-sense.md`; this is that rule and
// nothing more.
//
// THE BRANCHES ARE NOT SYMMETRIC, and the asymmetry sets the threshold.
// Trusting a bad reading licenses replacing a human's careful transcription
// with something derived from a misreading, and the judges cannot tell, because
// the reading is the only evidence they are given about the picture. Falling
// back costs nothing that exists today: the block is protected and left alone,
// which is where every transcript already stands. So a reading has to earn its
// use, which is the opposite of how a defect detector should be tuned and
// follows from the costs rather than from taste.
//
// THIS DOES NOT JUDGE TRANSLATION QUALITY. Whether the reading renders the
// picture well is the judges' question and they are equipped for it. This
// decides only whether the reading is a reading at all.
//
// WHETHER IT IS THE RIGHT PICTURE IS DECIDED ELSEWHERE, in
// `reading-corroboration.ts`, by comparing the two readers' readings to each
// other. A clause here used to compare the reading against the transcript the
// archive already carried, and real traffic on 2026-08-19 measured it refusing
// correct readings: every reading of `Mio/7`'s two pictures was refused while
// the two readers agreed with each other at 0.967 and 1.000 character overlap.
// It also could not work in principle, since a reading comes back in the
// picture's language and the transcript is English, so the two can share only
// names, handles and numbers. What survives here is per-reading and needs no
// second text.

import { readsAsRefusal, } from './reading-refusal.ts';

/**
 * Shortest reading worth having, in characters after trimming.
 *
 * An image nobody could read comes back as an apology or as nothing, and both
 * are shorter than any transcript.
 */
export const MIN_READING_CHARS = 16;

/**
 * How much of a reading is examined for a refusal.
 *
 * A model that cannot read a picture says so immediately; one that says so
 * halfway through has read something.
 */
const REFUSAL_WINDOW_CHARS = 200;

/**
 * Wordings a model uses when it cannot read a picture, lowercased.
 *
 * A HEURISTIC, STATED AS ONE, and NO LONGER THE ONLY ONE. It catches a refusal
 * that opens with an apology however long the reply runs. It misses a refusal
 * worded unusually, which is not hypothetical: `There is no text visible in this
 * image.` and `No legible text is visible.` both slipped past this list by a
 * single word on 2026-08-19 and then corroborated each other. `readsAsRefusal`
 * in `reading-refusal.ts` covers that shape; this list covers the long ones it
 * does not reach.
 */
const REFUSAL_PHRASES: readonly string[] = [
  'i cannot',
  'i can\'t',
  'i am unable',
  'i\'m unable',
  'unable to read',
  'unable to see',
  'no text is visible',
  'no visible text',
  'the image is unclear',
  'cannot make out',
  'sorry, i',
];

/**
 * Whether a character is an ASCII letter.
 *
 * @param character - character to weigh
 *
 * @returns Whether it is a Latin letter
 *
 * @example
 * ```ts
 * const letter = isLatin({ character: 'a', },);
 * ```
 */
function isLatin({ character, }: { readonly character: string; },): boolean {
  return ((character >= 'a') && (character <= 'z'))
    || ((character >= 'A') && (character <= 'Z'));
}

/**
 * Whether a character is a digit.
 *
 * @param character - character to weigh
 *
 * @returns Whether it is a digit
 *
 * @example
 * ```ts
 * const digit = isDigit({ character: '4', },);
 * ```
 */
function isDigit({ character, }: { readonly character: string; },): boolean {
  return (character >= '0') && (character <= '9');
}

/**
 * Why a reading was refused, or that it was not.
 *
 * @example
 * ```ts
 * const verdict: ReadingVerdict = { kind: 'usable', };
 * ```
 */
export type ReadingVerdict = {
  readonly kind: 'usable';
} | {
  readonly kind: 'refused';

  /**
   * Which clause of the stated rule refused it, for a finding a reader can act
   * on rather than a bare rejection.
   */
  readonly clause: 'too-short' | 'reads-as-refusal';
};

/**
 * Whether what a model returned for a picture is a reading at all.
 *
 * PER-READING AND NOTHING MORE. Both clauses look only at the text in hand, so
 * this can screen a reading before any second one exists, which is what lets the
 * pair stage discard a refusal without paying for its partner.
 *
 * @param reading - what model returned for image
 *
 * @returns Whether reading may be used, and which clause refused it
 *
 * @example
 * ```ts
 * const verdict = readingMakesSense({ reading, },);
 * ```
 */
export function readingMakesSense(
  { reading, }: { readonly reading: string; },
): ReadingVerdict {
  /**
   * Reading without its surrounding whitespace.
   */
  const trimmed = reading.trim();
  if (trimmed.length < MIN_READING_CHARS) {
    return {
      kind: 'refused',
      clause: 'too-short',
    };
  }

  /**
   * Opening of the reading, lowercased, where a refusal announces itself.
   */
  const opening = trimmed.slice(
    0,
    REFUSAL_WINDOW_CHARS,
  )
    .toLowerCase();
  if (REFUSAL_PHRASES.some(function announced(phrase,): boolean {
    return opening.includes(phrase,);
  },)) {
    return {
      kind: 'refused',
      clause: 'reads-as-refusal',
    };
  }

  // The shape test, which the phrase list above cannot subsume: a refusal worded
  // in a way nobody wrote down still negates, still names the picture, and is
  // still a sentence rather than a passage. Placed second because the phrase
  // list reaches long apologies this one deliberately does not.
  if (readsAsRefusal({ reading: trimmed, },)) {
    return {
      kind: 'refused',
      clause: 'reads-as-refusal',
    };
  }

  return { kind: 'usable', };
}

//endregion Image reading sense
