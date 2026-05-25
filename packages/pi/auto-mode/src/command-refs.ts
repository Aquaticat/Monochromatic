/**
 * Command reference extraction and path heuristics.
 *
 * Two helpers used at parse time and at flag time:
 * - `extractParamRefs`: pre-scan a raw command for `$VAR`/`${VAR}`
 *   references that shell-quote may otherwise drop.
 * - `looksLikePath`: cheap predicate for "is this token a path?",
 *   used by both `command-parser` (to associate operands with a
 *   command) and `signals` (to decide whether a path-signal applies).
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
  /** Separate from `simplePattern` because `${VAR}` has no surrounding-character constraints. */
  // oxlint-disable-next-line no-restricted-syntax/no-regex -- shell parameter reference grammar (`${VAR}` form); the character class is the exact POSIX identifier rule. Input is bounded command string; no nested quantifiers means linear matching.
  const bracedPattern = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/gu;
  /** Negative lookbehind/lookahead skip `$$` (escape) and `${`/`$(` (substitutions/subshells), which need different handling. */
  // oxlint-disable-next-line no-restricted-syntax/no-regex -- shell parameter reference grammar (`$VAR` form with negative lookbehind/lookahead for $$/${/$( disambiguation); the boundary conditions need lookarounds to be expressed without false positives. Input is bounded command string; no nested quantifiers.
  const simplePattern = /(?<!\$)\$([A-Za-z_][A-Za-z0-9_]*)(?![{(])/gu;

  /** Captured variable names from `${VAR}` matches; `undefined` capture groups are filtered out. */
  const bracedRefs = [...cmd.matchAll(bracedPattern,),]
    .map(
      function pickCapture(m,) {
        return m[1];
      },
    )
    .filter(
      function isDefined(s,): s is string {
        return s !== undefined;
      },
    );
  /** Captured variable names from bare `$VAR` matches. */
  const simpleRefs = [...cmd.matchAll(simplePattern,),]
    .map(
      function pickCapture(m,) {
        return m[1];
      },
    )
    .filter(
      function isDefined(s,): s is string {
        return s !== undefined;
      },
    );

  return [...new Set([
    ...bracedRefs,
    ...simpleRefs,
  ],),];
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
    s.startsWith('/',)
      || s
      .startsWith('./',)
      || s
      .startsWith('../',)
      || s
      .startsWith('~',)
      || s
      .includes('/',)
      || s
      .startsWith('.',)
  );
}

//endregion

export {
  extractParamRefs,
  looksLikePath,
};
