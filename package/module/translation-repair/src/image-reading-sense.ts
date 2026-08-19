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

import { topLevelBlocks, } from './markdown-blocks.ts';

/**
 * Shortest reading worth having, in characters after trimming.
 *
 * An image nobody could read comes back as an apology or as nothing, and both
 * are shorter than any transcript.
 */
const MIN_READING_CHARS = 16;

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
 * A HEURISTIC, STATED AS ONE. It misses a refusal worded unusually, and the
 * anchor clause catches most of what it misses, since an apology shares no
 * anchors with a transcript.
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
 * Shortest Latin word that counts as an anchor.
 */
const MIN_ANCHOR_WORD = 4;

/**
 * Shortest run of digits that counts as an anchor.
 */
const MIN_ANCHOR_DIGITS = 2;

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
 * Parts of a transcription that survive translation and paraphrase.
 *
 * A DATE, A USERNAME, A VERSION, AN ADDRESS. Two readings of one picture share
 * these even when every sentence around them is worded differently, and two
 * readings of different pictures share none of them.
 *
 * NO REGEX, per `RG1`: the rule is "runs of letters, runs of digits", which one
 * linear pass states directly.
 *
 * @param text - reading or transcript to read
 *
 * @returns Distinct anchors, lowercased
 *
 * @example
 * ```ts
 * const anchors = readingAnchors({ text: 'Bilibili UID: 2119605209', },);
 * ```
 */
export function readingAnchors({ text, }: { readonly text: string; },): ReadonlySet<string> {
  /**
   * Anchors found so far.
   */
  const found = new Set<string>();

  /**
   * Run being accumulated, and what kind it is.
   */
  const run = {
    text: '',
    digits: false,
  };

  /**
   * Closes the current run, keeping it when it is long enough to be an anchor.
   */
  function close(): void {
    if (run.text === '')
      return;

    /**
     * How long a run of this kind has to be.
     */
    const floor = run.digits ? MIN_ANCHOR_DIGITS : MIN_ANCHOR_WORD;

    /**
     * The run itself, measured once.
     */
    const { text: accumulated, } = run;
    if (accumulated.length >= floor)
      found.add(accumulated.toLowerCase(),);
    run.text = '';
  }

  for (const character of text) {
    if (isDigit({ character, },)) {
      if (!run.digits)
        close();
      run.digits = true;
      run.text += character;
      continue;
    }
    if (isLatin({ character, },)) {
      if (run.digits)
        close();
      run.digits = false;
      run.text += character;
      continue;
    }
    close();
  }
  close();

  return found;
}

/**
 * How many anchors two texts share.
 *
 * @param left - one text
 *
 * @param right - the other
 *
 * @returns Count of anchors present in both
 *
 * @example
 * ```ts
 * const shared = sharedAnchorCount({ left, right, },);
 * ```
 */
export function sharedAnchorCount(
  {
    left,
    right,
  }: {
    readonly left: string;
    readonly right: string;
  },
): number {
  /**
   * Anchors of the second text, to test the first against.
   */
  const other = readingAnchors({ text: right, },);

  /**
   * Anchors present in both.
   */
  const shared = [...readingAnchors({ text: left, },),]
    .filter(function inBoth(anchor,): boolean {
      return other.has(anchor,);
    },);
  return shared.length;
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

  return { kind: 'usable', };
}

/**
 * Transcript blocks an archive passage carries, joined.
 *
 * A TRANSCRIPT IS WRITTEN AS A BLOCKQUOTE in every case measured, which is the
 * same shape `quote-preservation.ts` guards, so both read the passage the same
 * way rather than disagreeing about what a transcript is.
 *
 * @param text - archive passage
 *
 * @returns Its quoted blocks joined, empty when it carries none
 *
 * @example
 * ```ts
 * const transcript = quotedTranscript({ text: slice.target.text, },);
 * ```
 */
export function quotedTranscript({ text, }: { readonly text: string; },): string {
  /**
   * Blocks of the passage that are quotations.
   */
  const quotes = topLevelBlocks({ text, },)
    .filter(function isQuote(block,): boolean {
      return block.startsWith('>',);
    },);
  return quotes.join('\n\n',);
}

//endregion Image reading sense
