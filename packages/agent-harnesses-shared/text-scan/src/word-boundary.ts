/**
 * Regex-free word-boundary phrase lookup helpers.
 *
 * @module
 */

import { isWordChar, } from './characters.ts';

//region Sentinels

/**
 * Sentinel returned by {@link containsAnyOfWordBounded} when no phrase matches.
 *
 * A unique symbol rather than `undefined`: absence is a real scan outcome, so
 * callers narrow on identity without widening successful matches to nullish.
 */
const PHRASE_NOT_FOUND: unique symbol = Symbol('text-scan/phrase-not-found',);

//endregion Sentinels

//region Boundary checks

/**
 * Whether placing `phrase` at `index` in `haystack` satisfies word-boundary semantics.
 *
 * The boundary applies only when the phrase's leading or trailing character is
 * itself a word char. A phrase that starts or ends with punctuation passes the
 * boundary check on that side automatically, mirroring JavaScript regex `\b` behavior.
 *
 * @param haystack - text being scanned
 *
 * @param phrase - phrase whose boundary is checked
 *
 * @param index - position in `haystack` where `phrase` begins
 *
 * @returns whether both word boundaries are satisfied
 *
 * @example
 * ```ts
 * boundariesSatisfied({ haystack: 'foo bar', phrase: 'bar', index: 4 }); // true
 * boundariesSatisfied({ haystack: 'foobar', phrase: 'bar', index: 3 }); // false
 * ```
 */
function boundariesSatisfied(
  {
    haystack,
    phrase,
    index,
  }: {
    readonly haystack: string;
    readonly phrase: string;
    readonly index: number;
  },
): boolean {
  /**
   * Character immediately before candidate occurrence, empty when at start.
   */
  const before = (index === 0)
    ? ''
    : haystack.charAt(index - 1,);
  /**
   * Position one past candidate phrase's last character.
   */
  const afterIndex = index + phrase.length;
  /**
   * Character immediately after candidate occurrence, empty when at end.
   */
  const after = (afterIndex >= haystack.length)
    ? ''
    : haystack.charAt(afterIndex,);
  /**
   * First character of `phrase`; empty string is impossible because callers guard length.
   */
  const firstChar = phrase.charAt(0,);
  /**
   * Last character of `phrase`; equal to `firstChar` for length-one phrases.
   */
  const lastChar = phrase.at(-1,)
    ?? '';
  /**
   * Whether start boundary holds when phrase starts with a word char.
   */
  const startBoundaryOk = isWordChar(firstChar,)
    ? ((before === '') || (!isWordChar(before,)))
    : true;
  /**
   * Whether end boundary holds when phrase ends with a word char.
   */
  const endBoundaryOk = isWordChar(lastChar,)
    ? ((after === '') || (!isWordChar(after,)))
    : true;

  return startBoundaryOk && endBoundaryOk;
}

/**
 * Whether `haystack` contains `phrase` flanked by word boundaries on both sides.
 *
 * The scan is case-insensitive and mirrors `\b<phrase>\b` semantics without
 * invoking the regular expression engine.
 *
 * @param haystack - text to scan
 *
 * @param phrase - phrase to look up
 *
 * @returns whether a word-bounded occurrence is present
 *
 * @example
 * ```ts
 * containsWordBoundedPhrase({ haystack: 'I think so', phrase: 'I think' }); // true
 * containsWordBoundedPhrase({ haystack: 'Methinks', phrase: 'think' }); // false
 * ```
 */
function containsWordBoundedPhrase(
  {
    haystack,
    phrase,
  }: {
    readonly haystack: string;
    readonly phrase: string;
  },
): boolean {
  if (phrase.length === 0)
    return false;

  /**
   * Lower-cased haystack for case-insensitive lookup.
   */
  const lowerHaystack = haystack.toLowerCase();
  /**
   * Lower-cased phrase for case-insensitive lookup.
   */
  const lowerPhrase = phrase.toLowerCase();

  for (
    let cursorIndex = lowerHaystack.indexOf(
      lowerPhrase,
      0,
    );
    cursorIndex !== (-1);
    cursorIndex = lowerHaystack.indexOf(
      lowerPhrase,
      cursorIndex + 1,
    )
  ) {
    if (boundariesSatisfied({
      haystack: lowerHaystack,
      phrase: lowerPhrase,
      index: cursorIndex,
    },)) {
      return true;
    }
  }

  return false;
}

/**
 * Finds first phrase that occurs in `haystack` flanked by word boundaries.
 *
 * @param haystack - text to scan
 *
 * @param phrases - candidate phrase list ordered by detection priority
 *
 * @returns matching phrase wrapped in `{ phrase }`, or {@link PHRASE_NOT_FOUND}
 *
 * @example
 * ```ts
 * containsAnyOfWordBounded({
 *   haystack: 'maybe later',
 *   phrases: ['probably', 'maybe', 'perhaps'],
 * });
 * // => { phrase: 'maybe' }
 * ```
 */
function containsAnyOfWordBounded(
  {
    haystack,
    phrases,
  }: {
    readonly haystack: string;
    readonly phrases: readonly string[];
  },
): { phrase: string; } | typeof PHRASE_NOT_FOUND {
  for (const phrase of phrases) {
    if (containsWordBoundedPhrase({
      haystack,
      phrase,
    },)) {
      return { phrase, };
    }
  }
  return PHRASE_NOT_FOUND;
}

//endregion Boundary checks

export {
  containsAnyOfWordBounded,
  containsWordBoundedPhrase,
  PHRASE_NOT_FOUND,
};
