/**
 * Regex-free text-scanning primitives shared across plugin handlers.
 *
 * Replaces inline regex calls in `correction-reminder`, `uncertainty`,
 * `bash-output-filter`, `terminal-title`, and `claude-spawn` handlers
 * with named, testable, character-level scans. The repo-wide oxlint rule
 * `no-restricted-syntax/require-regex-justification` pushes consumers
 * toward these helpers instead of inline regex.
 *
 * @module
 */

//region Character predicates

/**
 * Whether a one-character string is an ASCII digit `0`-`9`.
 *
 * @param c - one-character string to test
 *
 * @returns whether the character is in `0`-`9`
 *
 * @example
 * ```ts
 * isDigit('4'); // true
 * isDigit('a'); // false
 * ```
 */
function isDigit(c: string,): boolean {
  return (c >= '0') && (c <= '9');
}

/**
 * Whether a one-character string is an ASCII lowercase letter `a`-`z`.
 *
 * @param c - one-character string to test
 *
 * @returns whether the character is in `a`-`z`
 *
 * @example
 * ```ts
 * isLowerAlpha('a'); // true
 * isLowerAlpha('A'); // false
 * ```
 */
function isLowerAlpha(c: string,): boolean {
  return (c >= 'a') && (c <= 'z');
}

/**
 * Whether a one-character string is an ASCII uppercase letter `A`-`Z`.
 *
 * @param c - one-character string to test
 *
 * @returns whether the character is in `A`-`Z`
 *
 * @example
 * ```ts
 * isUpperAlpha('A'); // true
 * isUpperAlpha('a'); // false
 * ```
 */
function isUpperAlpha(c: string,): boolean {
  return (c >= 'A') && (c <= 'Z');
}

/**
 * Whether a one-character string is an ASCII alphanumeric (letter or digit).
 *
 * @param c - one-character string to test
 *
 * @returns whether the character is a letter or digit
 *
 * @example
 * ```ts
 * isAlphaNum('Z'); // true
 * isAlphaNum('_'); // false
 * ```
 */
function isAlphaNum(c: string,): boolean {
  return isLowerAlpha(c,) || isUpperAlpha(c,) || isDigit(c,);
}

/**
 * Whether a one-character string is a `\w` word character: alphanumeric or
 * underscore. Mirrors JavaScript regex `\w` for the ASCII subset.
 *
 * @param c - one-character string to test
 *
 * @returns whether the character is alphanumeric or `_`
 *
 * @example
 * ```ts
 * isWordChar('a'); // true
 * isWordChar('_'); // true
 * isWordChar('-'); // false
 * ```
 */
function isWordChar(c: string,): boolean {
  return isAlphaNum(c,) || (c === '_');
}

/**
 * Whether a one-character string is whitespace as defined by JavaScript
 * regex `\s`: space, tab, newline, carriage return, form feed, vertical tab.
 *
 * @param c - one-character string to test
 *
 * @returns whether the character is whitespace
 *
 * @example
 * ```ts
 * isWhitespace(' '); // true
 * isWhitespace('a'); // false
 * ```
 */
function isWhitespace(c: string,): boolean {
  return (c === ' ')
    || (c === '\t')
    || (c === '\n')
    || (c === '\r')
    || (c === '\f')
    || (c === '\v');
}

//endregion Character predicates

//region Splitting

/**
 * Splits a string into non-empty whitespace-separated tokens. Matches the
 * behaviour of `s.split(/\\s+/).filter(Boolean)` without the regex.
 *
 * @param s - input string to tokenise
 *
 * @returns ordered array of non-empty tokens
 *
 * @example
 * ```ts
 * splitWhitespace('  a\tb\nc  '); // ['a', 'b', 'c']
 * splitWhitespace(''); // []
 * ```
 */
function splitWhitespace(s: string,): string[] {
  /**
   * Recursive walker that emits tokens between whitespace runs without using `let`.
   *
   * @param idx - current scan position in the input string
   *
   * @param current - characters accumulated for the in-progress token
   *
   * @param acc - tokens emitted so far
   *
   * @returns final ordered list of non-empty tokens
   *
   * @example
   * ```ts
   * walk({ idx: 0, current: '', acc: [] }); // ['a', 'b'] for input 'a b'
   * ```
   */
  function walk(
    {
      idx,
      current,
      acc,
    }: {
      idx: number;
      current: string;
      acc: readonly string[];
    },
  ): readonly string[] {
    if (idx >= s.length) {
      return current === ''
        ? acc
        : [
          ...acc,
          current,
        ];
    }
    /** Current character under inspection during the walk. */
    const ch = s.charAt(idx,);
    if (isWhitespace(ch,)) {
      return walk({
        idx: idx + 1,
        current: '',
        acc: current === ''
          ? acc
          : [
            ...acc,
            current,
          ],
      },);
    }
    return walk({
      idx: idx + 1,
      current: current + ch,
      acc,
    },);
  }

  return [...walk({
    idx: 0,
    current: '',
    acc: [],
  },),];
}

//endregion Splitting

//region Word-boundary phrase lookup

/**
 * Whether placing `phrase` at `index` in `haystack` would satisfy the
 * `\b<phrase>\b` boundary semantics on both sides. The boundary applies only
 * when the phrase's leading or trailing character is itself a word char; a
 * phrase that starts or ends with punctuation passes the boundary check on
 * that side automatically (mirroring regex `\b` behaviour).
 *
 * @param haystack - text being scanned
 *
 * @param phrase - phrase whose boundary is being checked
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
    haystack: string;
    phrase: string;
    index: number;
  },
): boolean {
  /** Character immediately before the candidate occurrence; empty string when at the start of `haystack`. */
  const before = (index === 0)
    ? ''
    : haystack.charAt(index - 1,);
  /** Position one past the candidate phrase's last character. */
  const afterIdx = index + phrase.length;
  /** Character immediately after the candidate occurrence; empty string when at the end of `haystack`. */
  const after = (afterIdx >= haystack.length)
    ? ''
    : haystack.charAt(afterIdx,);
  /** First character of `phrase`; empty string is impossible here because callers guard length. */
  const firstChar = phrase.charAt(0,);
  /** Last character of `phrase`; equal to `firstChar` for length-1 phrases. */
  const lastChar = phrase.at(-1,) ?? '';
  /** Whether the start boundary holds (phrase starts with a word char, neighbour is not a word char). */
  const startBoundaryOk = isWordChar(firstChar,)
    ? ((before === '') || (!isWordChar(before,)))
    : true;
  /** Whether the end boundary holds (phrase ends with a word char, neighbour is not a word char). */
  const endBoundaryOk = isWordChar(lastChar,)
    ? ((after === '') || (!isWordChar(after,)))
    : true;
  return startBoundaryOk && endBoundaryOk;
}

/**
 * Whether `haystack` contains `phrase` flanked by word boundaries on both
 * sides, case-insensitively. Mirrors regex `\b<phrase>\b/i` semantics
 * without invoking the regex engine.
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
    haystack: string;
    phrase: string
  },
): boolean {
  if (phrase.length === 0)
    return false;
  /** Lower-cased haystack for case-insensitive lookup. */
  const lowerHay = haystack.toLowerCase();
  /** Lower-cased phrase for case-insensitive lookup. */
  const lowerPhrase = phrase.toLowerCase();

  /**
   * Recursive scan over `indexOf` matches, checking boundaries at each hit.
   *
   * @param idx - position in `lowerHay` from which to start searching
   *
   * @returns whether a word-bounded match was found at or after `idx`
   *
   * @example
   * ```ts
   * checkFrom(0); // true when the phrase appears word-bounded anywhere in the haystack
   * ```
   */
  function checkFrom(idx: number,): boolean {
    /** Index of the next candidate match, or `-1` when exhausted. */
    const next = lowerHay.indexOf(
      lowerPhrase,
      idx,
    );
    if (next === (-1))
      return false;
    if (boundariesSatisfied({
      haystack: lowerHay,
      phrase: lowerPhrase,
      index: next,
    },))
      return true;
    return checkFrom(next + 1,);
  }

  return checkFrom(0,);
}

/**
 * Finds the first phrase from `phrases` that occurs in `haystack` flanked by
 * word boundaries, case-insensitively. Returns `undefined` when no phrase
 * matches.
 *
 * @param haystack - text to scan
 *
 * @param phrases - candidate phrase list, ordered by detection priority
 *
 * @returns matching phrase wrapped in `{ phrase }`, or `undefined`
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
    haystack: string;
    phrases: readonly string[];
  },
): { phrase: string; } | undefined {
  for (const phrase of phrases) {
    if (containsWordBoundedPhrase({
      haystack,
      phrase,
    },))
      return { phrase, };
  }
  return undefined;
}

//endregion Word-boundary phrase lookup

//region Delimiter stripping

/**
 * Removes substrings bounded by matching open/close delimiters from `text`.
 * Iterates left-to-right; for each open delimiter found, removes through the
 * next close delimiter. Unmatched openers are left in place.
 *
 * When `disallowedInside` is provided, any disallowed character inside the
 * delimiter span cancels the strip for that occurrence (used by callers that
 * want quoted-string strips bounded by newlines).
 *
 * @param text - input text
 *
 * @param openDelim - opening delimiter literal
 *
 * @param closeDelim - closing delimiter literal
 *
 * @param disallowedInside - optional character that aborts the strip when
 *   present inside the candidate span
 *
 * @returns text with each matched delimiter span removed
 *
 * @example
 * ```ts
 * stripBetweenDelims({ text: 'a `code` b', openDelim: '`', closeDelim: '`' });
 * // => 'a  b'
 * ```
 */
function stripBetweenDelims(
  {
    text,
    openDelim,
    closeDelim,
    disallowedInside,
  }: {
    text: string;
    openDelim: string;
    closeDelim: string;
    disallowedInside?: string;
  },
): string {
  /**
   * Recursive walker that accumulates a stripped output without `let`.
   *
   * @param idx - current scan position in the input string
   *
   * @param acc - output string built up so far
   *
   * @returns final stripped output once `idx` runs past the end
   *
   * @example
   * ```ts
   * walk({ idx: 0, acc: '' }); // 'a  b' for text 'a `code` b'
   * ```
   */
  function walk(
    {
      idx,
      acc,
    }: {
      idx: number;
      acc: string;
    },
  ): string {
    /** Index of next opening delimiter from `idx`, or `-1` when none remains. */
    const openIdx = text.indexOf(
      openDelim,
      idx,
    );
    if (openIdx === (-1))
      return acc + text.slice(idx,);
    /** Search start for the matching close delimiter (must skip the entire opener). */
    const closeSearchStart = openIdx + openDelim.length;
    /** Index of the closing delimiter, or `-1` when the opener is unmatched. */
    const closeIdx = text.indexOf(
      closeDelim,
      closeSearchStart,
    );
    if (closeIdx === (-1))
      return acc + text.slice(idx,);
    /** Span between the delimiters (exclusive of both ends). */
    const inside = text.slice(
      closeSearchStart,
      closeIdx,
    );
    if ((disallowedInside !== undefined) && inside.includes(disallowedInside,)) {
      // Skip just past this opener and resume searching; this preserves the
      // opener verbatim instead of treating it as a strip start.
      return walk({
        idx: closeSearchStart,
        acc: acc + text.slice(
          idx,
          closeSearchStart,
        ),
      },);
    }
    return walk({
      idx: closeIdx + closeDelim.length,
      acc: acc + text.slice(
        idx,
        openIdx,
      ),
    },);
  }

  return walk({
    idx: 0,
    acc: '',
  },);
}

/**
 * Removes lines from `text` whose first non-whitespace character starts with
 * `prefix`. Lines that do not match remain unchanged, including their
 * trailing newlines. Matches the behaviour of stripping markdown blockquote
 * lines without regex.
 *
 * @param text - input text containing one or more newline-separated lines
 *
 * @param prefix - prefix literal that flags a line for removal
 *
 * @returns text with matching lines removed
 *
 * @example
 * ```ts
 * stripLinesStartingWith({ text: 'a\n> quote\nb', prefix: '>' });
 * // => 'a\nb'
 * ```
 */
function stripLinesStartingWith(
  {
    text,
    prefix,
  }: {
    text: string;
    prefix: string
  },
): string {
  return text
    .split('\n',)
    .filter(function keepLine(line,): boolean {
      return !line.trimStart().startsWith(prefix,);
    },)
    .join('\n',);
}

//endregion Delimiter stripping

export {
  containsAnyOfWordBounded,
  containsWordBoundedPhrase,
  isAlphaNum,
  isDigit,
  isLowerAlpha,
  isUpperAlpha,
  isWhitespace,
  isWordChar,
  splitWhitespace,
  stripBetweenDelims,
  stripLinesStartingWith,
};
