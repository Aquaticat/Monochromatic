/**
 * Command reference extraction and path heuristics.
 *
 * Extracted from command-parser.ts to stay within the line limit.
 *
 * @module
 */

//region Param reference extraction

/**
 * Pre-scan a raw command string for `$VAR` and `${VAR}` references.
 *
 * Catches references that may be lost during shell-quote parsing
 * (e.g. inside command substitutions or malformed syntax).
 *
 * @param cmd - the raw command string
 *
 * @returns array of unique variable names found
 *
 * @example
 * ```typescript
 * extractParamRefs("curl $API_KEY"); // ["API_KEY"]
 * ```
 */
function extractParamRefs(
  cmd: string,
): string[] {
  const refs: string[] = [];

  // Match ${VAR} references
  const bracedPattern = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;
  let bracedMatch: RegExpExecArray | null = bracedPattern.exec(cmd);
  while (bracedMatch !== null) {
    if (bracedMatch[1] !== undefined) {
      refs.push(bracedMatch[1]);
    }
    bracedMatch = bracedPattern.exec(cmd);
  }

  // Match $VAR references (not preceded by $ and not followed by { or ()
  const simplePattern = /(?<!\$)\$([A-Za-z_][A-Za-z0-9_]*)(?![{(])/g;
  let simpleMatch: RegExpExecArray | null = simplePattern.exec(cmd);
  while (simpleMatch !== null) {
    if (simpleMatch[1] !== undefined) {
      refs.push(simpleMatch[1]);
    }
    simpleMatch = simplePattern.exec(cmd);
  }

  return [...new Set(refs)];
}

//endregion

//region Path heuristics

/**
 * Heuristic: does this string look like a file path?
 *
 * Matches paths starting with `/`, `./`, `../`, `~`,
 * containing `/`, or starting with `.` (dotfiles).
 *
 * @param s - the string to test
 *
 * @returns `true` if the string looks like a file path
 *
 * @example
 * ```typescript
 * looksLikePath("/etc/passwd"); // true
 * looksLikePath("--verbose"); // false
 * ```
 */
function looksLikePath(
  s: string,
): boolean {
  return (
    s.startsWith("/") ||
    s.startsWith("./") ||
    s.startsWith("../") ||
    s.startsWith("~") ||
    s.includes("/") ||
    s.startsWith(".")
  );
}

//endregion

export {
  extractParamRefs,
  looksLikePath,
};
