//region Assembly repetition
// DAMAGE THAT IS ONLY VISIBLE IN THE WHOLE DOCUMENT, which every per-slice
// instrument in this package is structurally blind to.
//
// `#66` measured the introduced-defect probe against two defects known to have
// shipped and it named neither. One was an ordinary miss. The other,
// `lintong`'s duplicated farewell, could not have been caught by that probe at
// any setting: it compares one edited region against itself before the edit,
// and the duplication is inside no single region. Slice 3 kept wording it was
// not asked to remove, slice 2 wrote a fresh rendering of the same thing, and
// each edit is defensible alone. Only the assembled document shows it.
//
// NO MODEL, NO ROSTER, NO QUOTA. The comparison that makes this decidable is
// the ARCHIVE, which `#96` decided to store in the artifact and `#128` wired in.
// A phrase the archive says once and the shipped document says twice is a
// repetition this pipeline introduced. That is a fact about two strings.
//
// WHY THE ARCHIVE IS THE BASELINE RATHER THAN A RULE ABOUT PROSE. Real writing
// repeats: refrains, names, deliberate echoes. A standalone "says it twice"
// check would fire on all of them. Counting against the archive asks the only
// question worth asking, which is whether the pipeline ADDED a repetition, and
// it inherits the author's own judgement about acceptable repetition for free.

/**
 * Shortest phrase worth reporting, in words.
 *
 * Below four words the matches are ordinary English collocations rather than
 * passages, and every document produces them by the dozen.
 */
const MIN_PHRASE_WORDS = 4;

/**
 * Letters a word needs before it counts as carrying content.
 *
 * Function words are short and they cluster, so a run of them says nothing
 * about whether a passage repeated.
 */
const CONTENT_WORD_LETTERS = 5;

/**
 * Content words a phrase needs before it is worth reporting.
 *
 * MEASURED RATHER THAN CHOSEN, on the five settled artifacts. Counting by words
 * alone, this returned five findings, and their content-word counts separate
 * them sharply: the duplication `#66` established by reading `lintong`'s
 * finished text carries THREE content words in 33 characters, while two of the
 * others carry ZERO and ONE. Six words with no word longer than four letters is
 * an ordinary English collocation that any two paragraphs may share, not a
 * passage a document said twice.
 *
 * WHAT TWO ACTUALLY COSTS, measured rather than predicted, because the first
 * version of this comment guessed and guessed wrong. It takes the five findings
 * to two: `lintong`'s documented duplication survives at 3 content words, and
 * `saurikissa`'s translate-lane repeat survives at 3. Dropped are two runs of
 * function words at 0 and 1, and `dogesir_`'s invented-and-repeated passage,
 * which carries only 1 content word in 21 characters.
 *
 * DROPPING `dogesir_` IS ACCEPTED rather than worked around. A five-word phrase
 * with one substantial word is short enough that two paragraphs sharing it is
 * unremarkable, and a stage emitting on every run should be quiet enough that a
 * finding means something. If document-scale damage is later found that this
 * threshold hid, lower it and say so here.
 */
const MIN_CONTENT_WORDS = 2;

/**
 * Longest phrase considered, in words.
 *
 * A longer repeat is still reported, because a maximal match is grown from its
 * shorter parts rather than searched for directly, and any repeat this long is
 * already unmistakable.
 */
const MAX_PHRASE_WORDS = 12;

/**
 * One passage the shipped document repeats more than the archive did.
 *
 * @example
 * ```ts
 * const finding: RepetitionFinding = { phrase: 'the same thing twice', archiveCount: 1, shippedCount: 2, };
 * ```
 */
export type RepetitionFinding = {
  /**
   * Repeated wording, normalised to single spaces.
   */
  readonly phrase: string;

  /**
   * Times the archive said it, which may be zero for wording the pipeline wrote.
   */
  readonly archiveCount: number;

  /**
   * Times the shipped document says it.
   */
  readonly shippedCount: number;
};

/**
 * Splits text into words, collapsing every run of whitespace.
 *
 * LINE STRUCTURE IS DELIBERATELY DISCARDED. `#122` wraps shipped text
 * semantically, so the same sentence carries different newlines before and
 * after the pipeline runs, and a comparison that kept them would report every
 * rewrapped paragraph as a change.
 *
 * PUNCTUATION RIDES ON ITS TOKEN, deliberately. Splitting it off would make
 * `soon.` and `soon,` the same word, which merges a sentence ending with one
 * continuing, and the repeats this looks for are whole passages rather than
 * near-matches. The cost is that a passage repeated with different closing
 * punctuation is two phrases; the benefit is that nothing is reported as
 * repeated which is not repeated verbatim.
 *
 * @param text - document or passage
 *
 * @returns Words in order
 *
 * @example
 * ```ts
 * const words = wordsOf({ text: 'the kitten dozes', },);
 * ```
 */
export function wordsOf({ text, }: { readonly text: string; },): readonly string[] {
  /**
   * Words closed so far.
   */
  const words: string[] = [];

  /**
   * Characters of the word being read.
   */
  let held = '';

  // A SINGLE LINEAR PASS rather than a split on a whitespace pattern, per `RG1`:
  // the rule is "break on whitespace", which an index scan states directly, and
  // this runs in O(n) with no backtracking to reason about on document-sized
  // input.
  for (const character of text) {
    if (character.trim() === '') {
      if (held !== '')
        words.push(held,);
      held = '';
      continue;
    }
    held += character;
  }
  if (held !== '')
    words.push(held,);
  return words;
}

/**
 * Whether a phrase carries enough substantial words to be worth reporting.
 *
 * Letters are counted with an index scan rather than a pattern, per `RG1`: the
 * rule is "how many letters does this word have", which a scan states directly.
 *
 * @param phrase - candidate repeated wording
 *
 * @returns Whether it clears {@link MIN_CONTENT_WORDS}
 *
 * @example
 * ```ts
 * const worth = carriesContent({ phrase: 'the tabby waits by the gate', },);
 * ```
 */
function carriesContent({ phrase, }: { readonly phrase: string; },): boolean {
  /**
   * Words long enough to carry meaning rather than grammar.
   *
   * LENGTH RATHER THAN A LETTER COUNT, and the reason is a rule conflict rather
   * than a preference. Counting letters needs the word walked character by
   * character, and this package's linters refuse both spellings of that:
   * spreading a string is refused for splitting graphemes, and `Array.from` is
   * refused in favour of spread. `LN1` says an apparent conflict gets a
   * structural answer rather than one rule's surface reshaped to quiet the
   * other, so the character walk goes away.
   *
   * WHAT IT COSTS is punctuation counting toward length, so a four-letter word
   * carrying a comma reads as five. Measured on the five settled artifacts this
   * changes nothing: the same two findings survive and the same three are
   * dropped.
   */
  const substantial = phrase
    .split(' ',)
    .filter(function longEnough(word,): boolean {
      return word.length >= CONTENT_WORD_LETTERS;
    },);

  return substantial.length >= MIN_CONTENT_WORDS;
}


/**
 * Counts every phrase of one length in a word list.
 *
 * @param words - words to walk
 *
 * @param length - phrase length in words
 *
 * @returns Occurrence count per phrase
 *
 * @example
 * ```ts
 * const counts = countPhrases({ words, length: 4, },);
 * ```
 */
export function countPhrases(
  {
    words,
    length,
  }: {
    readonly words: readonly string[];
    readonly length: number;
  },
): ReadonlyMap<string, number> {
  /**
   * Occurrences seen so far, by phrase.
   */
  const counts = new Map<string, number>();
  for (let at = 0; (at + length) <= words.length; at += 1) {
    /**
     * This window, as one comparable string.
     */
    const phrase = words
      .slice(
        at,
        at + length,
      )
      .join(' ',);

    /**
     * Times this phrase has been seen before now.
     */
    const seen = counts.get(phrase,) ?? 0;
    counts.set(
      phrase,
      seen + 1,
    );
  }
  return counts;
}

/**
 * Names passages the shipped document repeats more often than the archive did.
 *
 * MAXIMAL MATCHES ONLY. A repeated twelve-word passage also repeats as nine
 * four-word ones, and reporting all of them would bury the finding in its own
 * substrings. Lengths are walked longest first and a shorter phrase contained
 * in one already reported is dropped.
 *
 * @param archiveText - translation as it stood before the pipeline ran, from
 * the artifact's stored archive
 *
 * @param shippedText - assembled document a lane produced
 *
 * @returns Introduced repetitions, longest first
 *
 * @example
 * ```ts
 * const findings = findIntroducedRepetitions({ archiveText, shippedText, },);
 * ```
 */
export function findIntroducedRepetitions(
  {
    archiveText,
    shippedText,
  }: {
    readonly archiveText: string;
    readonly shippedText: string;
  },
): readonly RepetitionFinding[] {
  /**
   * Archive as a word list, so phrase counting sees the same units on both
   * sides.
   */
  const archiveWords = wordsOf({ text: archiveText, },);

  /**
   * {@inheritDoc archiveWords}
   */
  const shippedWords = wordsOf({ text: shippedText, },);

  /**
   * Findings so far, longest first, used to suppress their own substrings.
   */
  const found: RepetitionFinding[] = [];

  for (let length = MAX_PHRASE_WORDS; length >= MIN_PHRASE_WORDS; length -= 1) {
    /**
     * Every phrase of this length in the shipped document.
     */
    const shipped = countPhrases({
      words: shippedWords,
      length,
    },);

    /**
     * Every phrase of this length in the archive.
     */
    const archive = countPhrases({
      words: archiveWords,
      length,
    },);

    for (const [phrase, shippedCount,] of shipped) {
      if (shippedCount < 2)
        continue;

      /**
       * Times the archive said the same thing, zero when it never did.
       */
      const archiveCount = archive.get(phrase,) ?? 0;

      // The archive's own repetition is the author's, not ours. Only an
      // INCREASE is something this pipeline did.
      if (shippedCount <= archiveCount)
        continue;
      if (!carriesContent({ phrase, },))
        continue;
      if (found.some(function contains(longer,): boolean {
        return longer.phrase
          .includes(phrase,);
      },))
        continue;
      found.push({
        phrase,
        archiveCount,
        shippedCount,
      },);
    }
  }

  return found;
}

/**
 * Renders introduced repetitions as scorecard-stable findings.
 *
 * THE PHRASE ITSELF IS NOT IN THE FINDING, and that is deliberate. Findings are
 * short tokens that get counted and compared across runs, and a passage of
 * corpus prose inside one would make every tally depend on the text it happened
 * to find. The shape is enough to locate it: rerun the check over the artifact
 * and the phrase is right there.
 *
 * @param archiveText - translation as it stood before the lane ran
 *
 * @param shippedText - assembled document the lane produced
 *
 * @returns One finding per introduced repetition, longest first
 *
 * @example
 * ```ts
 * const findings = repetitionFindings({ archiveText, shippedText, },);
 * ```
 */
export function repetitionFindings(
  {
    archiveText,
    shippedText,
  }: {
    readonly archiveText: string;
    readonly shippedText: string;
  },
): readonly string[] {
  return findIntroducedRepetitions({
    archiveText,
    shippedText,
  },)
    .map(function toFinding(found,): string {
      return `introduced-repetition (${
        String(found.phrase
          .split(' ',)
          .length,)
      } words, archive ${String(found.archiveCount,)}, shipped ${String(found.shippedCount,)})`;
    },);
}

//endregion Assembly repetition
