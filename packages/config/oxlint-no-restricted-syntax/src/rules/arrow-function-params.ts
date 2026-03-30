/**
 * Minimal node shape required by {@link extractParamsText}.
 *
 * Subset of `ArrowFunctionExpression` covering only the properties
 * needed for parameter text extraction.
 */
type ArrowParamsNode = {
  /** Whether the function is async. */
  async: boolean;
  /** Generic type parameter list, if present. */
  typeParameters?: unknown;
};

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
    fullText: string;
    node: ArrowParamsNode;
  },
): string {
  /** Skip `async ` prefix if present. */
  let start = 0;
  if (node.async) {
    const asyncMatch = fullText.match(/^async\s+/,);
    if (asyncMatch !== null)
      start = asyncMatch[0].length;
  }

  /**
   * Skip type parameters `<...>` if present.
   * Count angle bracket depth to handle nested generics.
   */
  if (node.typeParameters !== null && node.typeParameters !== undefined) {
    const tpText = fullText.slice(start,);
    if (tpText.startsWith('<',)) {
      let depth = 0;
      for (let i = 0; i < tpText.length; i++) {
        if (tpText[i] === '<')
          depth++;
        else if (tpText[i] === '>') {
          depth--;
          if (depth === 0) {
            start += i + 1;
            break;
          }
        }
      }
    }
  }

  /** Now find the balanced parenthesized params. */
  const rest = fullText.slice(start,);
  let depth = 0;
  let inString: string | null = null;

  for (let i = 0; i < rest.length; i++) {
    const ch = rest[i];

    if (inString !== null) {
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === inString)
        inString = null;
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
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

  /** Fallback: return the whole rest (should not happen for valid arrow functions). */
  return rest;
}
