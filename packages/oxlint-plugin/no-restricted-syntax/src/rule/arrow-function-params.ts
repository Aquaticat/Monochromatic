import { isWhitespaceChar, } from '@monochromatic-dev/oxlint-plugin-shared/ts';

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
  if (!isWhitespaceChar(fullText.charAt(index,),))
    return 0;
  while (isWhitespaceChar(fullText.charAt(index,),))
    index += 1;
  return index;
}

/**
 * Extracts the parameter list text (including parentheses) from an arrow
 * function's source text.
 *
 * The arrow function source may start with `async ` (skipped via
 * {@link indexAfterAsyncPrefix}), then optional type parameters `<T>`, then
 * the parameter list `(...)`. This function finds the parenthesized
 * parameter list by scanning for balanced parentheses while ignoring string
 * content.
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
      for (let loopIndex = 0; loopIndex < tpText
        .length; loopIndex++) {
        if (tpText[loopIndex]
          === '<')
          depth++;
        else if (tpText[loopIndex]
          === '>') {
          depth--;
          if (depth === 0) {
            start += loopIndex + 1;
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
  const OUTSIDE_STRING = Symbol('scanner cursor outside any string literal',);
  /**
   * Active string-literal delimiter while scanning, or {@link OUTSIDE_STRING}
   * when not inside a string.
   */
  let inString: string | typeof OUTSIDE_STRING = OUTSIDE_STRING;

  for (let loopIndex = 0; loopIndex < rest
    .length; loopIndex++) {
    /**
     * Current character under the scanner cursor.
     */
    const ch = rest[loopIndex];

    if (inString !== OUTSIDE_STRING) {
      if (ch === '\\') {
        loopIndex++;
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
          loopIndex + 1,
        );
      }
    }
  }

  /**
   * Fallback: return the whole rest (should not happen for valid arrow functions).
   */
  return rest;
}
