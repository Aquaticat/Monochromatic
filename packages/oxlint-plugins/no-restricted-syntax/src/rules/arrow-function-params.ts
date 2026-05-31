/**
 * Minimal node shape required by {@link extractParamsText}.
 *
 * Subset of `ArrowFunctionExpression` covering only the properties
 * needed for parameter text extraction.
 */
type ArrowParamsNode = {
  /**
   * Whether the function is async.
   */
  readonly async: boolean;
  /**
   * Generic type parameter list, if present.
   */
  readonly typeParameters?: unknown;
};

/**
 * Async keyword that may prefix arrow function source text.
 */
const ASYNC_KEYWORD = 'async';

/**
 * Whitespace characters consumed after an async arrow-function prefix.
 */
const ASYNC_PREFIX_WHITESPACE = [
  ' ',
  '\t',
  '\n',
  '\r',
  '\f',
  '\v',
] as const;

/**
 * Checks whether a character is JavaScript whitespace for the async prefix scanner.
 *
 * The source text starts at an AST node boundary, so the scanner only needs
 * to consume the whitespace between `async` and the parameter/generic start.
 *
 * @param char - single character to inspect
 *
 * @returns whether character is whitespace
 *
 * @example
 * ```ts
 * isWhitespaceCharacter({ char: ' ' }); // true
 * ```
 */
function isWhitespaceCharacter({ char, }: { readonly char: string; },): boolean {
  return ASYNC_PREFIX_WHITESPACE.some(function isMatchingWhitespace(candidate,): boolean {
    return candidate === char;
  },);
}

/**
 * Finds the index after a leading async keyword and its following whitespace.
 *
 * @param fullText - source text of an async arrow function
 *
 * @returns first index after `async` whitespace, or zero when no prefix exists
 *
 * @example
 * ```ts
 * indexAfterAsyncPrefix({ fullText: 'async  (x) => x' }); // 7
 * ```
 */
function indexAfterAsyncPrefix({ fullText, }: { readonly fullText: string; },): number {
  if (!fullText.startsWith(ASYNC_KEYWORD,))
    return 0;
  /**
   * Cursor after the async keyword, advanced across following whitespace.
   */
  let index = ASYNC_KEYWORD.length;
  if (!isWhitespaceCharacter({ char: fullText[index]
    ?? '', },))
    return 0;
  while (isWhitespaceCharacter({ char: fullText[index]
    ?? '', },))
    index++;
  return index;
}

/**
 * Extracts the parameter list text (including parentheses) from an arrow
 * function's source text.
 *
 * The arrow function source may start with `async `, then optional type
 * parameters `<T>`, then the parameter list `(...)`. This function finds the
 * parenthesized parameter list by scanning for balanced parentheses while
 * ignoring string content.
 *
 * @param fullText - complete source text of the ArrowFunctionExpression node
 *
 * @param node - arrow function AST node, used for `async` flag and
 * `typeParameters` presence
 *
 * @returns parameter list text including surrounding parentheses
 *
 * @example
 * ```ts
 * const params = extractParamsText({
 *   fullText: 'async <T>(x: T): T => x',
 *   node: { async: true, typeParameters: { start: 6, end: 9 } },
 * });
 * // params === '(x: T)'
 * ```
 */
export function extractParamsText(
  {
    fullText,
    node,
  }: {
    readonly fullText: string;
    readonly node: ArrowParamsNode;
  },
): string {
  /**
   * Skip `async ` prefix if present.
   */
  let start = 0;
  if (node.async)
    start = indexAfterAsyncPrefix({ fullText, },);

  /**
   * Skip type parameters `<...>` if present.
   * Count angle bracket depth to handle nested generics.
   */
  if ((node.typeParameters
    !== null) && (node.typeParameters
      !== undefined)) {
    /**
     * Source slice starting at the first non-`async` character; inspected for a leading `<`.
     */
    const tpText = fullText.slice(start,);
    if (tpText.startsWith('<',)) {
      /**
       * Angle-bracket nesting counter so nested generics resolve before the params open.
       */
      let depth = 0;
      for (let i = 0; i < tpText
        .length; i++) {
        if (tpText[i]
          === '<')
          depth++;
        else if (tpText[i]
          === '>') {
          depth--;
          if (depth === 0) {
            start += i + 1;
            break;
          }
        }
      }
    }
  }

  /**
   * Now find the balanced parenthesized params.
   */
  const rest = fullText.slice(start,);
  /**
   * Parenthesis nesting counter; the params end when it returns to zero.
   */
  let depth = 0;
  /**
   * Genuine sentinel marking the scanner is outside any string literal; a unique `Symbol`, never `null`, so the cursor type carries no nullish union.
   */
  const OUTSIDE_STRING = Symbol('outside-string',);
  /**
   * Active string-literal delimiter while scanning, or {@link OUTSIDE_STRING}
   * when not inside a string.
   */
  let inString: string | typeof OUTSIDE_STRING = OUTSIDE_STRING;

  for (let i = 0; i < rest
    .length; i++) {
    /**
     * Current character under the scanner cursor.
     */
    const ch = rest[i];

    if (inString !== OUTSIDE_STRING) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === inString)
        inString = OUTSIDE_STRING;
      continue;
    }

    if ((ch === '"') || (ch === "'")
      || (ch === '`')) {
      inString = ch;
      continue;
    }

    if (ch === '(')
      depth++;
    else if (ch === ')') {
      depth--;
      if (depth === 0) {
        return rest.slice(
          0,
          i + 1,
        );
      }
    }
  }

  /**
   * Fallback: return the whole rest (should not happen for valid arrow functions).
   */
  return rest;
}
