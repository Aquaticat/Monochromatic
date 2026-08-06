//region Graded sheet reading
// Reading a human's filled-in detection sheet back into verdicts.
//
// Built for calibration: the plan of record is to pre-grade a round BLIND, hand
// the untouched sheet to the human, and derive an agreement rate from the two
// sets of grades afterwards. The pre-grades deliberately never appear ON the
// sheet. Printing them there would anchor the human toward agreeing, and the
// precision number that same sheet produces is the milestone gate, so the
// calibration would be bought by corrupting the measurement it calibrates
// against. Nothing is lost by keeping them apart, because the agreed plan only
// starts filtering items a round LATER anyway.
//
// The parsing rules come from the two sheets already graded, not from a format
// anyone specified. They differ from each other and both must be read:
//
//   ### 3. grade: Y  (Y = real defect ...)          round one, bare
//   ### 2. grade: N. <rationale>  (Y = ...)         round one, verdict then prose
//   ### 4. grade: [Y]  (Y = ...)                    round two, bracketed
//   ### 7. grade: [Y, <rationale>]  (Y = ...)       round two, bracketed with prose
//   ### 10. grade: [Not enough context to grade]    neither verdict
//
// That last shape is why a verdict letter is only a verdict when a delimiter
// follows it. "Not enough context to grade" begins with N, and reading it as a
// false positive would silently move a real measurement into the denominator on
// the strength of one letter.

/**
 * What a human decided about one sampled issue.
 *
 * @example
 * ```ts
 * const verdict: GradeVerdict = 'real-defect';
 * ```
 */
export type GradeVerdict =
  /**
   * Graded `Y`: a real translation defect.
   */
  | 'real-defect'
  /**
   * Graded `N`: a false positive.
   */
  | 'false-positive'
  /**
   * Left blank, or answered with something that is not a verdict. Kept as its
   * own state rather than folded into either: an item the grader declined to
   * score belongs in no precision denominator.
   */
  | 'unscored';

/**
 * One item read back off a graded sheet.
 *
 * @example
 * ```ts
 * const item: GradedItem = { index: 1, verdict: 'real-defect', note: '', };
 * ```
 */
export type GradedItem = {
  /**
   * 1-based position on the sheet, which is what a pre-grade is keyed by.
   */
  readonly index: number;

  /**
   * Verdict the grader recorded.
   */
  readonly verdict: GradeVerdict;

  /**
   * Free text the grader added, empty when they added none. Round one and round
   * two both carry rationale that nothing else reproduces, so it is preserved
   * rather than discarded once the verdict is extracted.
   */
  readonly note: string;
};

/**
 * Marker beginning a sheet item.
 */
const ITEM_PREFIX = '### ';

/**
 * Marker introducing the grade on a detection-sheet item.
 */
const GRADE_MARKER = 'grade:';

/**
 * Legend that follows every grade, and therefore bounds the grader's answer.
 */
const LEGEND_MARKER = '(Y = ';

/**
 * Characters that may follow a verdict letter and still leave it a verdict;
 * anything else means the letter merely began a word.
 */
const VERDICT_DELIMITERS = new Set(
  ',.;: ',
);

/**
 * Reads the grader's answer out of one item heading, with the legend and any
 * enclosing brackets removed.
 *
 * @param line - item heading line
 *
 * @returns Answer text, empty when the box was left unfilled
 *
 * @example
 * ```ts
 * const answer = extractAnswer({ line: '### 1. grade: [Y]  (Y = ...)', },);
 * ```
 */
function extractAnswer({ line, }: { readonly line: string; },): string {
  /**
   * Where the grade begins.
   */
  const start = line.indexOf(GRADE_MARKER,);
  if (start === (-1))
    return '';

  /**
   * Everything after the marker, with the trailing legend cut off. The legend
   * is last on the line, so the LAST occurrence bounds the answer even when a
   * rationale quotes the legend's own wording.
   */
  const afterMarker = line.slice(start + GRADE_MARKER.length,);

  /**
   * Where the legend starts within that, or the end when it is absent.
   */
  const legendAt = afterMarker.lastIndexOf(LEGEND_MARKER,);

  /**
   * Grader's answer, still possibly bracketed.
   */
  const answer = (legendAt === (-1)
    ? afterMarker
    : afterMarker.slice(
      0,
      legendAt,
    ))
    .trim();

  if (answer.startsWith('[',) && answer.endsWith(']',))
    return answer.slice(
      1,
      -1,
    )
      .trim();
  return answer;
}

/**
 * Whether an answer opens with a given verdict letter used as a verdict.
 *
 * @param answer - grader's answer
 *
 * @param letter - verdict letter to test
 *
 * @returns True when the letter stands alone or is followed by a delimiter
 *
 * @example
 * ```ts
 * const isYes = opensWithVerdict({ answer: 'Y, but softer', letter: 'Y', },);
 * ```
 */
function opensWithVerdict(
  {
    answer,
    letter,
  }: {
    readonly answer: string;
    readonly letter: string;
  },
): boolean {
  if (!answer.startsWith(letter,))
    return false;
  if (answer.length === letter.length)
    return true;
  return VERDICT_DELIMITERS.has(answer.charAt(letter.length,),);
}

/**
 * Drops the punctuation and spacing separating a verdict letter from the prose
 * after it.
 *
 * A linear scan rather than a pattern: the rule is "skip while the character is
 * a delimiter", and the delimiter set is already named.
 *
 * @param text - answer remainder after the verdict letter
 *
 * @returns Remainder with leading delimiters and surrounding space removed
 *
 * @example
 * ```ts
 * const note = trimLeadingDelimiters({ text: ', anchored to the wrong text', },);
 * ```
 */
function trimLeadingDelimiters({ text, }: { readonly text: string; },): string {
  for (let index = 0; index < text.length; index += 1)
    if (!VERDICT_DELIMITERS.has(text.charAt(index,),))
      return text.slice(index,)
        .trim();
  return '';
}

/**
 * Classifies one grader answer into a verdict and its remaining prose.
 *
 * @param answer - grader's answer, unbracketed
 *
 * @returns Verdict and the note that followed it
 *
 * @example
 * ```ts
 * const read = readAnswer({ answer: 'N, anchored to the wrong text', },);
 * ```
 */
function readAnswer({ answer, }: { readonly answer: string; },): {
  readonly verdict: GradeVerdict;
  readonly note: string;
} {
  for (const [
    letter,
    verdict,
  ] of [
    [
      'Y',
      'real-defect',
    ],
    [
      'N',
      'false-positive',
    ],
  ] as const)
    if (opensWithVerdict({
      answer,
      letter,
    },))
      return {
        verdict,
        note: trimLeadingDelimiters({ text: answer.slice(letter.length,), },),
      };

  // Everything else, including an untouched `[ ]` box and answers like
  // "Not enough context to grade", is deliberately not a verdict.
  return {
    verdict: 'unscored',
    note: answer,
  };
}

/**
 * Reads every graded item off a filled detection sheet.
 *
 * @param text - sheet as the grader left it
 *
 * @returns Items in sheet order
 *
 * @example
 * ```ts
 * const items = parseGradedSheet({ text: await readFile(path, 'utf8',), },);
 * ```
 */
export function parseGradedSheet(
  { text, }: { readonly text: string; },
): readonly GradedItem[] {
  return text.split('\n',)
    .filter(function isItemHeading(line,) {
      return line.startsWith(ITEM_PREFIX,)
        && line.includes(GRADE_MARKER,);
    },)
    .map(function toItem(
      line,
      position,
    ): GradedItem {
      /**
       * Verdict and note read off this heading.
       */
      const read = readAnswer({ answer: extractAnswer({ line, },), },);
      return {
        index: position + 1,
        verdict: read.verdict,
        note: read.note,
      };
    },);
}

//endregion Graded sheet reading
