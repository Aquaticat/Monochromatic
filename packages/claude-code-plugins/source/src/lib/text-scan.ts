/**
 * Regex-free text-scanning primitives shared across plugin handlers.
 *
 * Replaces inline regex calls in `correction-reminder`, `uncertainty`,
 * `bash-output-filter`, `terminal-title`, and `claude-spawn` handlers
 * with named, testable, character-level scans. The repo-wide oxlint rule
 * `no-restricted-syntax/no-regex` pushes consumers
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
  /** Emitted tokens; each is sliced out whole, so no per-character copy accumulates. */
  const tokens: string[] = [];
  // Single forward pass; whitespace advances one char, a non-whitespace run is
  // sliced out in one piece. `idx` jumps over each token, so the stride varies.
  for (let idx = 0; idx < s.length;) {
    if (isWhitespace(s.charAt(idx,),)) {
      idx += 1;
      continue;
    }
    /** Inclusive start of the current non-whitespace token. */
    const start = idx;
    /** Exclusive end of the token, advanced to the next whitespace or end of input. */
    let end = idx + 1;
    while ((end < s.length) && (!isWhitespace(s.charAt(end,),))) {
      end += 1;
    }
    tokens.push(s.slice(
      start,
      end,
    ),);
    idx = end;
  }
  return tokens;
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
    readonly haystack: string;
    readonly phrase: string;
    readonly index: number;
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
    readonly haystack: string;
    readonly phrase: string;
  },
): boolean {
  if (phrase.length === 0)
    return false;
  /** Lower-cased haystack for case-insensitive lookup. */
  const lowerHay = haystack.toLowerCase();
  /** Lower-cased phrase for case-insensitive lookup. */
  const lowerPhrase = phrase.toLowerCase();

  // Walk every `indexOf` match in order; the cursor advances by one past each
  // hit (monotonic, no rescan of earlier text) until a word-bounded match is
  // found or the matches are exhausted.
  for (
    let idx = lowerHay.indexOf(
      lowerPhrase,
      0,
    );
    idx !== (-1);
    idx = lowerHay.indexOf(
      lowerPhrase,
      idx + 1,
    )
  ) {
    if (boundariesSatisfied({
      haystack: lowerHay,
      phrase: lowerPhrase,
      index: idx,
    },)) {
      return true;
    }
  }

  return false;
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
    readonly haystack: string;
    readonly phrases: readonly string[];
  },
): { phrase: string; } | undefined {
  for (const phrase of phrases) {
    if (containsWordBoundedPhrase({
      haystack,
      phrase,
    },)) {
      return { phrase, };
    }
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
    readonly text: string;
    readonly openDelim: string;
    readonly closeDelim: string;
    readonly disallowedInside?: string;
  },
): string {
  /** Output segments, joined once at the end so the accumulator is never recopied per span. */
  const parts: string[] = [];
  /** Cursor; advances monotonically past each emitted or stripped span. */
  let idx = 0;
  // Walk each opener in order. The remainder from `idx` is flushed once after
  // the loop, covering both terminal cases: no further opener, and an unmatched
  // opener (which breaks out without consuming the rest).
  for (
    let openIdx = text.indexOf(
      openDelim,
      0,
    );
    openIdx !== (-1);
    openIdx = text.indexOf(
      openDelim,
      idx,
    )
  ) {
    /** Search start for the matching close delimiter (must skip the entire opener). */
    const closeSearchStart = openIdx + openDelim.length;
    /** Index of the closing delimiter, or `-1` when the opener is unmatched. */
    const closeIdx = text.indexOf(
      closeDelim,
      closeSearchStart,
    );
    if (closeIdx === (-1))
      break;
    /** Span between the delimiters (exclusive of both ends). */
    const inside = text.slice(
      closeSearchStart,
      closeIdx,
    );
    if ((disallowedInside !== undefined) && inside.includes(disallowedInside,)) {
      // Disallowed char inside: keep the opener verbatim and resume just past it
      // instead of treating it as a strip start.
      parts.push(text.slice(
        idx,
        closeSearchStart,
      ),);
      idx = closeSearchStart;
    }
    else {
      // Strip the delimited span: emit up to the opener, resume past the close.
      parts.push(text.slice(
        idx,
        openIdx,
      ),);
      idx = closeIdx + closeDelim.length;
    }
  }
  parts.push(text.slice(idx,),);
  /** Joined output; bound to a name so the helper-function shape suppresses the root `let idx`. */
  const result = parts.join('',);
  return result;
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
    readonly text: string;
    readonly prefix: string;
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
