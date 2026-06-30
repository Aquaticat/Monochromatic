import { JsoncParseError, } from './errors.ts';

//region Whitespace

/**
 * Characters JSON treats as insignificant whitespace.
 */
const JSON_WHITESPACE = new Set([
  ' ',
  '\t',
  '\n',
  '\r',
],);

/**
 * Tests whether a character is JSON whitespace.
 *
 * @param char - Single character to test.
 *
 * @returns `true` for space, tab, newline, or carriage return.
 *
 * @example
 * ```ts
 * isJsonWhitespace(' '); // => true
 * ```
 */
export function isJsonWhitespace(char: string,): boolean {
  return JSON_WHITESPACE.has(char,);
}

//endregion Whitespace

//region Scalars

/**
 * Result of scanning a scalar token: the decoded value, the original source
 * slice, and the offset just past the token.
 */
export type ScalarScan<T,> = {
  value: T;
  raw: string;
  end: number;
};

/**
 * Scans a double-quoted string starting at `index` (which must point at the
 * opening quote), respecting backslash escapes. The decoded value is recovered
 * with `JSON.parse` over the raw slice so the JSON grammar, not a hand-rolled
 * escape table, defines the decoding.
 *
 * @param source - Full JSONC source.
 *
 * @param index - Offset of the opening quote.
 *
 * @returns Decoded string, raw quoted slice, and end offset.
 *
 * @throws {@link JsoncParseError} when the string is never closed.
 *
 * @example
 * ```ts
 * scanString({ source: '"a\\n"', index: 0 });
 * // => { value: 'a\n', raw: '"a\\n"', end: 5 }
 * ```
 */
export function scanString({
  source,
  index,
}: {
  source: string;
  index: number;
},): ScalarScan<string> {
  // Cursor walk: advance past escapes, stop at the unescaped closing quote.
  let cursor = index + 1;
  while (cursor < source.length) {
    /**
     * Character under the cursor on this step.
     */
    const char = source[cursor];
    if (char === '\\') {
      cursor += 2;
      continue;
    }
    if (char === '"') {
      /**
       * Offset just past the closing quote.
       */
      const end = cursor + 1;
      /**
       * Original quoted slice, including both quotes.
       */
      const raw = source.slice(index, end,);
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- raw is a complete JSON string literal, so JSON.parse yields a string
      return {
        value: JSON.parse(raw,) as string,
        raw,
        end,
      };
    }
    cursor += 1;
  }
  throw new JsoncParseError({
    message: 'unterminated string',
    offset: index,
  },);
}

/**
 * Characters that may appear inside a JSON number token.
 */
const NUMBER_CHARS = new Set([
  '-',
  '+',
  '.',
  'e',
  'E',
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
],);

/**
 * Scans a JSON number starting at `index`. Consumes the maximal run of
 * number characters, then validates and decodes it with `JSON.parse`, which
 * rejects malformed runs such as `1.2.3` or a leading-zero integer.
 *
 * @param source - Full JSONC source.
 *
 * @param index - Offset of the number's first character.
 *
 * @returns Decoded number, raw slice, and end offset.
 *
 * @throws {@link JsoncParseError} when the run is not a valid JSON number.
 *
 * @example
 * ```ts
 * scanNumber({ source: '1.5,', index: 0 });
 * // => { value: 1.5, raw: '1.5', end: 3 }
 * ```
 */
export function scanNumber({
  source,
  index,
}: {
  source: string;
  index: number;
},): ScalarScan<number> {
  // Cursor walk: consume the run of number characters.
  let cursor = index;
  while (cursor < source.length) {
    /**
     * Character under the cursor.
     */
    const char = source[cursor];
    if ((char === undefined) || !NUMBER_CHARS.has(char,))
      break;
    cursor += 1;
  }

  /**
   * Raw slice spanning the consumed number run.
   */
  const raw = source.slice(index, cursor,);
  /**
   * Decoded number; `JSON.parse` throws on a malformed run.
   */
  let value: number;
  try {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a valid JSON number slice parses to a number
    value = JSON.parse(raw,) as number;
  }
  catch {
    throw new JsoncParseError({
      message: `invalid number ${JSON.stringify(raw,)}`,
      offset: index,
    },);
  }
  return {
    value,
    raw,
    end: cursor,
  };
}

/**
 * Tests whether `keyword` appears in `source` exactly at `index`.
 *
 * @param source - Full JSONC source.
 *
 * @param index - Offset to test at.
 *
 * @param keyword - Literal keyword to match (`true`, `false`, or `null`).
 *
 * @returns `true` when the keyword starts at the offset.
 *
 * @example
 * ```ts
 * matchKeyword({ source: 'true,', index: 0, keyword: 'true' }); // => true
 * ```
 */
export function matchKeyword({
  source,
  index,
  keyword,
}: {
  source: string;
  index: number;
  keyword: string;
},): boolean {
  return source.startsWith(keyword, index,);
}

//endregion Scalars

//region Comments

/**
 * Result of scanning a comment: its body (delimiters stripped, untrimmed) and
 * the offset just past it.
 */
export type CommentScan = {
  text: string;
  end: number;
};

/**
 * Scans a `//` line comment starting at `index` (which must point at the first
 * slash). The body runs to the next newline or end of input; the newline itself
 * is not consumed.
 *
 * @param source - Full JSONC source.
 *
 * @param index - Offset of the first slash.
 *
 * @returns Comment body and end offset.
 *
 * @example
 * ```ts
 * scanLineComment({ source: '// hi\n', index: 0 });
 * // => { text: ' hi', end: 5 }
 * ```
 */
export function scanLineComment({
  source,
  index,
}: {
  source: string;
  index: number;
},): CommentScan {
  /**
   * Offset of the terminating newline, or -1 when the comment runs to EOF.
   */
  const newline = source.indexOf('\n', index,);
  /**
   * Offset just past the comment body.
   */
  const end = (newline === (-1))
    ? source.length
    : newline;
  return {
    text: source.slice(index + 2, end,),
    end,
  };
}

/**
 * Scans a `/* *\/` block comment starting at `index` (which must point at the
 * slash). The body runs to the first `*\/`; C-family block comments do not
 * nest, so the first close wins.
 *
 * @param source - Full JSONC source.
 *
 * @param index - Offset of the opening slash.
 *
 * @returns Comment body and end offset.
 *
 * @throws {@link JsoncParseError} when the block is never closed.
 *
 * @example
 * ```ts
 * scanBlockComment({ source: '/* a *\/', index: 0 });
 * // => { text: ' a ', end: 7 }
 * ```
 */
export function scanBlockComment({
  source,
  index,
}: {
  source: string;
  index: number;
},): CommentScan {
  /**
   * Offset of the closing delimiter, searched from just past the opener.
   */
  const close = source.indexOf('*/', index + 2,);
  if (close === (-1))
    throw new JsoncParseError({
      message: 'unterminated block comment',
      offset: index,
    },);
  return {
    text: source.slice(index + 2, close,),
    end: close + 2,
  };
}

//endregion Comments
