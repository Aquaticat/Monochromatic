/**
 * Oxlint output augmentation with enhanced diagnostic guidance.
 *
 * Some oxlint rules produce technically correct but misleading diagnostic messages.
 * For example, `typescript/no-misused-promises` tells users to add `void`
 * when the real fix is ensuring Promise rejections are handled.
 *
 * This module provides pure functions that scan oxlint text output,
 * detect specific rule diagnostics, and inject actionable `note:` lines
 * with better guidance.
 *
 * @module
 */

//region Character predicates

/** ASCII code 27 (0x1B) for the ESC byte that opens every ANSI control sequence; named to satisfy `no-magic-numbers`. */
const ESC_CODE_POINT = 0x1B;
/** ESC byte string; located via `indexOf(ESC_CHAR, ...)` instead of a regex. */
const ESC_CHAR = String.fromCodePoint(ESC_CODE_POINT,);

/**
 * Tests whether `c` is an ASCII digit (`0`-`9`).
 *
 * @param c - single character
 *
 * @returns whether `c` is an ASCII digit
 *
 * @example
 * ```ts
 * isAsciiDigit('7'); // true
 * isAsciiDigit('a'); // false
 * ```
 */
function isAsciiDigit(c: string,): boolean {
  return (c >= '0') && (c <= '9');
}

/**
 * Tests whether `c` is an ASCII letter (`a`-`z` or `A`-`Z`).
 *
 * @param c - single character
 *
 * @returns whether `c` is an ASCII letter
 *
 * @example
 * ```ts
 * isAsciiLetter('a'); // true
 * isAsciiLetter('1'); // false
 * ```
 */
function isAsciiLetter(c: string,): boolean {
  return ((c >= 'a') && (c <= 'z'))
    || ((c >= 'A') && (c <= 'Z'));
}

/**
 * Tests whether `c` qualifies as a `\w` word char (alphanumeric or `_`).
 *
 * @param c - single character
 *
 * @returns whether `c` is a word char
 *
 * @example
 * ```ts
 * isWordChar('_'); // true
 * isWordChar('-'); // false
 * ```
 */
function isWordChar(c: string,): boolean {
  return isAsciiLetter(c,) || isAsciiDigit(c,) || (c === '_');
}

/**
 * Tests whether `c` is permitted inside an oxlint rule name (`[\w-]`).
 *
 * @param c - single character
 *
 * @returns whether `c` may appear inside a rule name
 *
 * @example
 * ```ts
 * isRuleNameChar('-'); // true
 * isRuleNameChar('('); // false
 * ```
 */
function isRuleNameChar(c: string,): boolean {
  return isWordChar(c,) || (c === '-');
}

/**
 * Tests whether `c` is `\s` whitespace (space, tab, newline, return,
 * form feed, vertical tab).
 *
 * @param c - single character
 *
 * @returns whether `c` is whitespace
 *
 * @example
 * ```ts
 * isWhitespace(' '); // true
 * isWhitespace('x'); // false
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

//region ANSI handling

/**
 * Returns the length of a valid ANSI CSI sequence starting at
 * `text[start]`, or `-1` when no valid sequence begins there.
 *
 * Mirrors the shape of `/\x1B\[\d+(?:;\d+)*m/` with a linear scan:
 * after `ESC[`, accept one or more digits, optionally followed by
 * `;<digits>` runs, ending at `m`.
 *
 * @param text - input string
 *
 * @param start - cursor at the candidate ESC byte
 *
 * @returns matched length, or `-1` for no match
 *
 * @example
 * ```ts
 * ansiEscapeLength({ text: '\x1B[31m', start: 0 }); // 5
 * ansiEscapeLength({ text: 'plain', start: 0 });    // -1
 * ```
 */
function ansiEscapeLength({
  text,
  start,
}: {
  text: string;
  start: number;
},): number {
  if (text.charAt(start,) !== ESC_CHAR)
    return -1;
  if (text.charAt(start + 1,) !== '[')
    return -1;

  /**
   * Walks zero or more digits, then dispatches on the next char.
   * `m` ends the sequence; `;` requires another digit run.
   *
   * @param idx - cursor inside the digit run
   *
   * @returns matched length, or `-1` for no match
   */
  function afterDigits(idx: number,): number {
    /** Current char at the cursor; drives the state transition. */
    const c = text.charAt(idx,);
    if (isAsciiDigit(c,))
      return afterDigits(idx + 1,);
    if (c === 'm')
      return (idx - start) + 1;
    if (c === ';')
      return digitRun(idx + 1,);
    return -1;
  }

  /**
   * Requires at least one digit at `idx`, then delegates to {@link afterDigits}.
   *
   * @param idx - cursor at the expected first digit
   *
   * @returns matched length, or `-1` for no match
   */
  function digitRun(idx: number,): number {
    if (!isAsciiDigit(text.charAt(idx,),))
      return -1;
    return afterDigits(idx + 1,);
  }

  return digitRun(start + 2,);
}

/**
 * Strips ANSI escape codes from a string for reliable text matching.
 *
 * Invalid ESC bytes (e.g. non-CSI escapes) are preserved so the caller
 * can still see them; only `\x1B[<digits>(;<digits>)*m` sequences are
 * stripped.
 *
 * @param text - string potentially containing ANSI escape sequences
 *
 * @returns plain text with all ANSI codes removed
 *
 * @example
 * ```ts
 * stripAnsi('\x1B[31merror\x1B[0m');
 * // 'error'
 * ```
 */
export function stripAnsi(text: string,): string {
  /**
   * Recursive walker emitting non-escape chunks.
   *
   * @param idx - cursor into `text`
   *
   * @param acc - accumulated output chunks
   *
   * @returns chunks to join
   */
  function walk({
    idx,
    acc,
  }: {
    idx: number;
    acc: readonly string[];
  },): readonly string[] {
    /** Position of the next ESC byte; `-1` means no further ANSI sequences. */
    const escIdx = text.indexOf(
      ESC_CHAR,
      idx,
    );
    if (escIdx === (-1)) {
      return [
        ...acc,
        text.slice(idx,),
      ];
    }
    /** Length of the ANSI sequence at `escIdx`, or `-1` when invalid. */
    const escLen = ansiEscapeLength({
      text,
      start: escIdx,
    },);
    if (escLen === (-1)) {
      return walk({
        idx: escIdx + 1,
        acc: [
          ...acc,
          text.slice(
            idx,
            escIdx + 1,
          ),
        ],
      },);
    }
    return walk({
      idx: escIdx + escLen,
      acc: [
        ...acc,
        text.slice(
          idx,
          escIdx,
        ),
      ],
    },);
  }
  return walk({
    idx: 0,
    acc: [],
  },)
    .join('',);
}

//endregion ANSI handling

//region Rule guidance: enhanced messages for specific lint rules

/**
 * Maps oxlint rule names to enhanced guidance text.
 *
 * Each entry provides actionable advice that supplements
 * the rule's built-in `help:` message. The guidance focuses on the
 * underlying problem rather than the type-level symptom.
 *
 * @example
 * ```ts
 * RULE_GUIDANCE['no-misused-promises'];
 * // 'Async callbacks silently drop ...'
 * ```
 */
export const RULE_GUIDANCE: Record<string, string> = {
  'no-misused-promises': [
    'Async callbacks silently drop Promise rejections because the caller ignores the return value.',
    'Fix: make the outer listener synchronous, call `void (async function name() { try { ... } catch (e) { console.error(e); } })()` inside it.',
    'Adding `void` alone only silences the type error without handling rejections.',
  ]
    .join(' ',),
};

//endregion Rule guidance

//region Diagnostic detection

/**
 * Walks consecutive whitespace chars starting at `idx`, returning the
 * first non-whitespace position (or `text.length`).
 *
 * @param text - input string
 *
 * @param idx - cursor at the candidate whitespace
 *
 * @returns first non-whitespace position
 *
 * @example
 * ```ts
 * skipWhitespace({ text: '   x', idx: 0 }); // 3
 * skipWhitespace({ text: 'x', idx: 0 });    // 0
 * ```
 */
function skipWhitespace({
  text,
  idx,
}: {
  text: string;
  idx: number;
},): number {
  if (idx >= text.length)
    return idx;
  if (!isWhitespace(text.charAt(idx,),))
    return idx;
  return skipWhitespace({
    text,
    idx: idx + 1,
  },);
}

/**
 * Walks consecutive rule-name chars starting at `idx`, returning the
 * exclusive end of the run.
 *
 * @param text - input string
 *
 * @param idx - cursor at the candidate rule-name char
 *
 * @returns exclusive end of the rule-name run
 *
 * @example
 * ```ts
 * skipRuleNameChars({ text: 'no-magic-numbers)', idx: 0 }); // 16
 * skipRuleNameChars({ text: ')', idx: 0 });                 // 0
 * ```
 */
function skipRuleNameChars({
  text,
  idx,
}: {
  text: string;
  idx: number;
},): number {
  if (idx >= text.length)
    return idx;
  if (!isRuleNameChar(text.charAt(idx,),))
    return idx;
  return skipRuleNameChars({
    text,
    idx: idx + 1,
  },);
}

/**
 * Tests whether every char in `[start, end)` is non-whitespace.
 *
 * @param text - input string
 *
 * @param start - inclusive start
 *
 * @param end - exclusive end
 *
 * @returns whether the range is non-empty and contains no whitespace
 *
 * @example
 * ```ts
 * allNonWhitespaceBetween({ text: 'abc def', start: 0, end: 3 }); // true
 * allNonWhitespaceBetween({ text: 'a c', start: 0, end: 3 });     // false
 * ```
 */
function allNonWhitespaceBetween({
  text,
  start,
  end,
}: {
  text: string;
  start: number;
  end: number;
},): boolean {
  if (start >= end)
    return true;
  if (isWhitespace(text.charAt(start,),))
    return false;
  return allNonWhitespaceBetween({
    text,
    start: start + 1,
    end,
  },);
}

/**
 * Attempts to parse an oxlint diagnostic header anchored at the `x` or
 * `!` punctuation char.
 *
 * Mirrors `/[x!]\s+\S+\(([\w-]+)\)\s*:/` (anchored at the punctuation):
 * whitespace, plugin name, `(`, rule name, `)`, optional whitespace, `:`.
 *
 * @param text - input string (typically ANSI-stripped)
 *
 * @param punctIdx - cursor at the candidate `x` or `!`
 *
 * @returns captured rule name, or `null` when no match
 *
 * @example
 * ```ts
 * matchHeaderAt({ text: 'x foo(bar): baz', punctIdx: 0 }); // 'bar'
 * matchHeaderAt({ text: 'x foo: baz', punctIdx: 0 });      // null
 * ```
 */
function matchHeaderAt({
  text,
  punctIdx,
}: {
  text: string;
  punctIdx: number;
},): string | null {
  if (!isWhitespace(text.charAt(punctIdx + 1,),))
    return null;

  /** Cursor past the run of whitespace following the punctuation. */
  const afterWs = skipWhitespace({
    text,
    idx: punctIdx + 2,
  },);

  /** Position of the `(` that opens the rule name; bounds the plugin-name run. */
  const openParen = text.indexOf(
    '(',
    afterWs,
  );
  if ((openParen === (-1)) || (openParen === afterWs))
    return null;
  if (
    !allNonWhitespaceBetween({
      text,
      start: afterWs,
      end: openParen,
    },)
  ) {
    return null;
  }

  /** Cursor at the first char inside the parens; rule name starts here. */
  const ruleStart = openParen + 1;
  /** Exclusive end of the rule-name char run. */
  const ruleEnd = skipRuleNameChars({
    text,
    idx: ruleStart,
  },);
  if (ruleEnd === ruleStart)
    return null;

  if (text.charAt(ruleEnd,) !== ')')
    return null;

  /** Cursor past optional whitespace after `)`; the next char must be `:`. */
  const afterRule = skipWhitespace({
    text,
    idx: ruleEnd + 1,
  },);
  if (text.charAt(afterRule,) !== ':')
    return null;

  return text.slice(
    ruleStart,
    ruleEnd,
  );
}

/**
 * Returns the position of the next `x` or `!` at or after `idx`, or
 * `-1` when neither remains in `text`.
 *
 * @param text - input string
 *
 * @param idx - cursor to begin searching from
 *
 * @returns position of the next candidate punctuation char, or `-1`
 *
 * @example
 * ```ts
 * findNextPunctChar({ text: '  x foo', idx: 0 }); // 2
 * findNextPunctChar({ text: 'abc', idx: 0 });     // -1
 * ```
 */
function findNextPunctChar({
  text,
  idx,
}: {
  text: string;
  idx: number;
},): number {
  /** Next `x` at or after `idx`, or `-1` when absent. */
  const xIdx = text.indexOf(
    'x',
    idx,
  );
  /** Next `!` at or after `idx`, or `-1` when absent. */
  const bangIdx = text.indexOf(
    '!',
    idx,
  );
  if (xIdx === (-1))
    return bangIdx;
  if (bangIdx === (-1))
    return xIdx;
  return Math.min(
    xIdx,
    bangIdx,
  );
}

/**
 * Extracts the rule name from an oxlint diagnostic header line.
 *
 * Handles ANSI color codes by stripping them before matching.
 *
 * @param line - single line of oxlint output, possibly with ANSI codes
 *
 * @returns rule name (e.g. `no-misused-promises`), or null if not a diagnostic header
 *
 * @example
 * ```ts
 * extractRuleName('  x typescript-eslint(no-misused-promises): Promise-returning ...');
 * // 'no-misused-promises'
 *
 * extractRuleName('  92 |   const form = ...');
 * // null
 * ```
 */
export function extractRuleName(line: string,): string | null {
  /** ANSI-stripped working copy; the matcher operates on plain text. */
  const stripped = stripAnsi(line,);

  /**
   * Recursive scan: try {@link matchHeaderAt} at every `x`/`!` occurrence
   * and return the first captured rule name.
   *
   * @param idx - cursor for the next candidate search
   *
   * @returns captured rule name, or `null`
   */
  function tryFrom(idx: number,): string | null {
    /** Next candidate `x` or `!` position; `-1` ends the search. */
    const next = findNextPunctChar({
      text: stripped,
      idx,
    },);
    if (next === (-1))
      return null;
    /** Header-match attempt anchored at the candidate; `null` retries from `next + 1`. */
    const result = matchHeaderAt({
      text: stripped,
      punctIdx: next,
    },);
    if (result !== null)
      return result;
    return tryFrom(next + 1,);
  }

  return tryFrom(0,);
}

/**
 * Tests whether a line is a `help:` line from an oxlint diagnostic.
 *
 * @param line - single line of oxlint output, possibly with ANSI codes
 *
 * @returns true when the line contains a `help:` prefix
 *
 * @example
 * ```ts
 * isHelpLine('  help: Expected void return type.');
 * // true
 * ```
 */
export function isHelpLine(line: string,): boolean {
  return stripAnsi(line,).trimStart().startsWith('help:',);
}

//endregion Diagnostic detection

//region Output augmentation

/** Indentation prefix for injected note lines, matching oxlint's `help:` alignment. */
const NOTE_PREFIX = '  ';

/**
 * Formats a guidance entry into an indented `note:` line for terminal output.
 *
 * @param guidance - guidance text from {@link RULE_GUIDANCE}
 *
 * @returns formatted note line ready to inject into oxlint output
 *
 * @example
 * ```ts
 * formatGuidanceLine('Wrap async logic in try/catch.');
 * // '  note: Wrap async logic in try/catch.'
 * ```
 */
export function formatGuidanceLine(guidance: string,): string {
  return `${NOTE_PREFIX}note: ${guidance}`;
}

/**
 * Augments oxlint text output with enhanced guidance for specific rules.
 *
 * Scans diagnostic headers for rule names in {@link RULE_GUIDANCE}
 * and injects a `note:` line after the diagnostic's `help:` line
 * (or before the next blank line if no `help:` line exists).
 *
 * Preserves all original output including ANSI codes and formatting.
 *
 * @param output - raw oxlint stdout or stderr text
 *
 * @returns augmented text with guidance notes injected
 *
 * @example
 * ```ts
 * const augmented = augmentOxlintOutput([
 *   '  x typescript-eslint(no-misused-promises): Promise-returning function ...',
 *   '   ,-[src/client.ts:93:30]',
 *   '   `----',
 *   '  help: Expected void return type.',
 *   '',
 * ].join('\n'));
 * // Contains '  note: Async callbacks silently drop ...'
 * ```
 */
export function augmentOxlintOutput(output: string,): string {
  if (output.length === 0)
    return '';

  /** Source output split per line so each diagnostic's header, body, and trailing blank can be inspected individually. */
  const lines = output.split('\n',);
  /** Output buffer assembled in order; guidance lines are spliced in alongside the originals. */
  const result: string[] = [];

  /* oxlint-disable no-restricted-syntax/no-function-root-let -- multi-statement state machine: activeGuidance and injected are mutated by four branches across loop iterations, with side effects on `result`. */
  /** Rule name from the current diagnostic block, null when unmatched. */
  let activeGuidance: string | null = null;
  /** Whether guidance has been injected for the current diagnostic block. */
  let injected = false;
  /* oxlint-enable no-restricted-syntax/no-function-root-let */

  for (const line of lines) {
    /** Rule name extracted from the current line when it matches a diagnostic header; otherwise null. */
    const ruleName = extractRuleName(line,);
    if (ruleName !== null) {
      activeGuidance = (RULE_GUIDANCE[ruleName] !== undefined) ? ruleName : null;
      injected = false;
    }

    // Inject after help line when guidance is pending
    if ((activeGuidance !== null) && (!injected) && isHelpLine(line,)) {
      result.push(line,);
      result.push(formatGuidanceLine(RULE_GUIDANCE[activeGuidance] ?? '',),);
      injected = true;
      continue;
    }

    // Inject before blank line (end of diagnostic) if no help line was found
    if ((activeGuidance !== null) && (!injected) && (stripAnsi(line,).trim() === '')) {
      result.push(formatGuidanceLine(RULE_GUIDANCE[activeGuidance] ?? '',),);
      injected = true;
      activeGuidance = null;
    }

    result.push(line,);
  }

  // Handle trailing diagnostic with no blank line at end
  if ((activeGuidance !== null) && (!injected))
    result.push(formatGuidanceLine(RULE_GUIDANCE[activeGuidance] ?? '',),);

  return result.join('\n',);
}

//endregion Output augmentation
