/**
 * Uncertainty detection engine for Claude Code response text.
 *
 * Provides pattern matching against hedging and uncertain language markers,
 * with stripping of non-prose regions (code blocks, inline code, blockquotes,
 * quoted strings) to reduce false positives.
 *
 * @module
 */

//region Patterns

/**
 * Patterns that indicate uncertain or hedging language in prose.
 * Each pattern matches word boundaries to avoid partial-word false positives.
 *
 * Organized by category:
 * - Modal hedges: probably, maybe, perhaps, possibly, likely, presumably
 * - Epistemic hedges: I think, I believe, I assume, I suspect, I imagine, I guess, I suppose
 * - Conditional hedges: might be, could be, should be (when hedging rather than prescriptive)
 * - Uncertainty markers: not sure, not certain, not entirely sure, hard to say, difficult to tell
 * - Approximation markers: if I recall, if I remember, from what I recall
 * - Comparative hedges: Xer than most, worse/more/less than most (confident-shaped comparative invoking an unverified population)
 */
const UNCERTAINTY_PATTERNS: readonly RegExp[] = [
  /\bprobably\b/i,
  /\bmaybe\b/i,
  /\bmay be\b/i,
  /\bmay only be\b/i,
  /\bworth testing\b/i,
  /\bperhaps\b/i,
  /\bpossibly\b/i,
  /\bpresum(?:ably|e)\b/i,
  /\bi think\b/i,
  /\bi believe\b/i,
  /\bi assume\b/i,
  /\bi suspect\b/i,
  /\bi imagine\b/i,
  /\bi guess\b/i,
  /\bi suppose\b/i,
  /\bmight be\b/i,
  /\bcould be\b/i,
  /\bshould be\b/i,
  /\bnot (?:entirely )?sure\b/i,
  /\bnot certain\b/i,
  /\bhard to (?:say|tell)\b/i,
  /\bdifficult to (?:say|tell)\b/i,
  /\bif i (?:recall|remember)\b/i,
  /\bfrom what i (?:recall|remember)\b/i,
  /\bas far as i (?:know|can tell)\b/i,
  /\blikely\b/i,
  /\wer than most\b/i,
  /\b(?:worse|more|less) than most\b/i,
];

//endregion

//region Stripping

/**
 * Strips fenced code blocks from text to avoid matching uncertainty words inside code.
 * Matches triple-backtick blocks with optional language tags.
 *
 * @param text - raw message text that may contain fenced code blocks
 *
 * @returns text with all fenced code blocks replaced by empty strings
 *
 * @example
 * ```ts
 * stripCodeBlocks('text ```js\nmaybe();\n``` more text')
 * // => 'text  more text'
 * ```
 */
function stripCodeBlocks(text: string,): string {
  return text.replaceAll(
    /```[\s\S]*?```/g,
    '',
  );
}

/**
 * Strips inline code spans from text to avoid matching uncertainty words inside code.
 *
 * @param text - text that may contain inline code spans
 *
 * @returns text with all inline code spans replaced by empty strings
 *
 * @example
 * ```ts
 * stripInlineCode('use `maybe` function')
 * // => 'use  function'
 * ```
 */
function stripInlineCode(text: string,): string {
  return text.replaceAll(
    /`[^`]+`/g,
    '',
  );
}

/**
 * Strips quoted lines (blockquotes) from text to avoid matching uncertainty words
 * that Claude is quoting from source material.
 *
 * @param text - text that may contain markdown blockquotes
 *
 * @returns text with all blockquote lines removed
 *
 * @example
 * ```ts
 * stripBlockquotes('normal line\n> probably a quote\nanother line')
 * // => 'normal line\nanother line'
 * ```
 */
function stripBlockquotes(text: string,): string {
  return text.replaceAll(
    /^>.*$/gm,
    '',
  );
}

/**
 * Strips inline quoted strings (both double and single quotes) from text
 * to avoid matching uncertainty words that Claude is quoting verbatim.
 *
 * Handles both `"quoted"` and `'quoted'` styles. Does not match across newlines.
 *
 * @param text - text that may contain inline quoted strings
 *
 * @returns text with all inline quoted strings replaced by empty strings
 *
 * @example
 * ```ts
 * stripQuotedStrings('the word "maybe" appears here')
 * // => 'the word  appears here'
 * ```
 */
function stripQuotedStrings(text: string,): string {
  return text
    .replaceAll(
      /"[^"\n]+"/g,
      '',
    )
    .replaceAll(
      /'[^'\n]+'/g,
      '',
    );
}

/**
 * Prepares message text for uncertainty scanning by removing regions
 * where uncertain language is expected or acceptable
 * (code blocks, inline code, blockquotes, quoted strings).
 *
 * Stripping order matters: fenced code blocks first (largest spans),
 * then inline code, then blockquotes, then quoted strings.
 *
 * @param text - raw assistant message text
 *
 * @returns cleaned text ready for pattern matching
 *
 * @example
 * ```ts
 * const prose = stripNonProseRegions('Look at ```js\nmaybe()\n``` and "perhaps"');
 * ```
 */
function stripNonProseRegions(text: string,): string {
  return stripQuotedStrings(stripBlockquotes(stripInlineCode(stripCodeBlocks(text,),),),);
}

//endregion

//region Detection

/**
 * Result of scanning text for uncertainty markers.
 */
type UncertaintyMatch = {
  /** First matched uncertain phrase. */
  phrase: string;

  /** Pattern that triggered the match. */
  pattern: RegExp;
};

/**
 * Result of scanning text for trailing questions directed at the user.
 */
type QuestionMatch = {
  /** Sentence ending with `?` that was detected. */
  sentence: string;
};

/**
 * Scans prose text for the first uncertainty marker match.
 *
 * @param prose - text with code blocks and quotes already stripped
 *
 * @returns match details if uncertain language was found, `undefined` otherwise
 *
 * @example
 * ```ts
 * const match = findUncertainty('This probably works');
 * // => { phrase: 'probably', pattern: /.../ }
 * ```
 */
function findUncertainty(prose: string,): UncertaintyMatch | undefined {
  for (const pattern of UNCERTAINTY_PATTERNS) {
    const match = pattern.exec(prose,);
    if (match !== null) {
      return {
        phrase: match[0],
        pattern,
      };
    }
  }
  return undefined;
}

/** Maximum characters from the end of the message to scan for trailing questions. */
const TRAILING_QUESTION_SCAN_LENGTH = 500;

/**
 * Detects sentences ending with `?` near the end of the assistant message.
 *
 * Only checks the last 500 characters of prose to target trailing questions
 * directed at the user (not rhetorical questions buried in explanations).
 * Skips sentences that start with common rhetorical/conditional patterns.
 *
 * @param prose - text with code blocks and quotes already stripped
 *
 * @returns match details if a trailing question was found, `undefined` otherwise
 *
 * @example
 * ```ts
 * const match = findTrailingQuestion('I finished the refactor. Want me to run the tests?');
 * // => { sentence: 'Want me to run the tests?' }
 * ```
 */
function findTrailingQuestion(prose: string,): QuestionMatch | undefined {
  const tail = prose.slice(-TRAILING_QUESTION_SCAN_LENGTH,);

  const questionPattern = /(?:^|[.!?]\s+)([A-Z][^.!?]*\?)\s*$/;
  const match = questionPattern.exec(tail,);

  if (match === null)
    return undefined;

  const sentence = match[1] ?? match[0];

  const rhetoricalPrefixes = [
    /^what if\b/i,
    /^why does\b/i,
    /^why would\b/i,
    /^how does\b/i,
    /^have you ever\b/i,
  ];
  for (const prefix of rhetoricalPrefixes) {
    if (prefix.test(sentence,))
      return undefined;
  }

  return { sentence, };
}

//endregion

export {
  findTrailingQuestion,
  findUncertainty,
  stripNonProseRegions,
};

export type {
  QuestionMatch,
  UncertaintyMatch,
};
