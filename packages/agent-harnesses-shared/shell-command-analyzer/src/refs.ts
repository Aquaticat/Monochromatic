/**
 * Raw reference and path helpers shared by shell command analysis consumers.
 *
 * @module
 */

//region Identifier helpers

/**
 * Whether character starts POSIX-like shell identifier.
 *
 * @param c - one-character string to inspect
 *
 * @returns whether character can start variable name
 *
 * @example
 * ```ts
 * isIdentifierStart('_');
 * ```
 */
function isIdentifierStart(c: string,): boolean {
  return ((c >= 'A') && (c <= 'Z'))
    || ((c >= 'a') && (c <= 'z'))
    || (c === '_');
}

/**
 * Whether character continues POSIX-like shell identifier.
 *
 * @param c - one-character string to inspect
 *
 * @returns whether character can continue variable name
 *
 * @example
 * ```ts
 * isIdentifierContinue('7');
 * ```
 */
function isIdentifierContinue(c: string,): boolean {
  return isIdentifierStart(c,)
    || ((c >= '0') && (c <= '9'));
}

//endregion Identifier helpers

//region Param reference extraction

/**
 * Read identifier from `source` starting at `start`.
 *
 * @param params - source text and start offset
 *
 * @returns identifier text plus next offset, or undefined when no identifier starts there
 *
 * @example
 * ```ts
 * readIdentifier({ source: 'API_KEY}', start: 0 });
 * ```
 */
function readIdentifier(
  {
    source,
    start,
  }: {
    readonly source: string;
    readonly start: number;
  },
): {
  readonly name: string;
  readonly next: number
} | undefined {
  if (!isIdentifierStart(source.charAt(start,),))
    return undefined;

  /**
   * Cursor advanced across identifier continuation characters.
   */
  let cursor = start + 1;
  while (isIdentifierContinue(source.charAt(cursor,),))
    cursor += 1;

  return {
    name: source.slice(
      start,
      cursor,
    ),
    next: cursor,
  };
}

/**
 * Extract `$VAR` and `${VAR}` references with a linear raw-text scan.
 *
 * This intentionally runs before parsing so malformed commands still surface
 * possible secret variable references to guardrails.
 *
 * @param command - raw shell command string
 *
 * @returns unique variable names found in source order
 *
 * @example
 * ```ts
 * extractParamRefs('curl $API_KEY ${TOKEN}');
 * // ['API_KEY', 'TOKEN']
 * ```
 */
function extractParamRefs(command: string,): string[] {
  /**
   * Ordered set of references discovered during scan.
   */
  const refs = new Set<string>();

  for (let cursor = 0; cursor < command.length; cursor += 1) {
    if (command.charAt(cursor,) !== '$')
      continue;
    if (command.charAt(cursor + 1,) === '$') {
      cursor += 1;
      continue;
    }
    if (command.charAt(cursor + 1,) === '(')
      continue;
    if (command.charAt(cursor + 1,) === '{') {
      /**
       * Identifier after `${`.
       */
      const braced = readIdentifier({
        source: command,
        start: cursor + '${'.length,
      },);
      if ((braced !== undefined) && (command.charAt(braced.next,) === '}')) {
        refs.add(braced.name,);
        cursor = braced.next;
      }
      continue;
    }
    /**
     * Identifier after bare `$`.
     */
    const simple = readIdentifier({
      source: command,
      start: cursor + '$'.length,
    },);
    if (simple !== undefined) {
      refs.add(simple.name,);
      cursor = simple.next - 1;
    }
  }

  return [...refs,];
}

//endregion Param reference extraction

//region Path heuristics

/**
 * Heuristic for path-like shell words.
 *
 * @param value - shell word value to inspect
 *
 * @returns whether value looks like filesystem path
 *
 * @example
 * ```ts
 * looksLikePath('./src/index.ts');
 * ```
 */
function looksLikePath(value: string,): boolean {
  return value.startsWith('/',)
    || value.startsWith('./',)
    || value.startsWith('../',)
    || value.startsWith('~',)
    || value.includes('/',)
    || value.startsWith('.',);
}

//endregion Path heuristics

export {
  extractParamRefs,
  looksLikePath,
};
