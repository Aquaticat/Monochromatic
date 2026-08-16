/**
 * Rule-specific oxlint diagnostic guidance configuration.
 *
 * This module owns the rule knowledge used by the generic output augmenter:
 * which diagnostics receive extra text.
 *
 * @module
 */

//region Guidance types

/**
 * Rule guidance plus optional generic diagnostic-header match conditions.
 */
export type RuleGuidance = {
  /**
   * Guidance text appended to oxlint help output.
   */
  readonly guidance: string;
  /**
   * Header fragments that must all appear before this guidance applies.
   */
  readonly headerIncludes?: readonly string[];
};

/**
 * Sentinel returned when no configured guidance matches a diagnostic header.
 */
export const NO_DIAGNOSTIC_GUIDANCE: unique symbol = Symbol('diagnostic_guidance_absent',);

//endregion Guidance types

//region Rule guidance

/**
 * Maps oxlint rule names to enhanced guidance text.
 *
 * @example
 * ```ts
 * RULE_GUIDANCE['no-misused-promises']?.guidance;
 * // 'Async callbacks silently drop ...'
 * ```
 */
export const RULE_GUIDANCE: Record<string, RuleGuidance> = {
  'no-misused-promises': {
    guidance: [
      'Async callbacks silently drop Promise rejections because the caller ignores the return value.',
      'Fix: make the outer listener synchronous, call `void (async function name() { try { ... } catch (e) { console.error(e); } })()` inside it.',
      'Adding `void` alone only silences the type error without handling rejections.',
    ]
      .join(' ',),
  },
  'no-non-null-assertion': {
    guidance: [
      'Repository policy: preserve fail-loud semantics.',
      'Replace `value!` with `nonNullishOrThrow(value,)` from `@monochromatic-dev/module-or-throw/ts`.',
      'Do not use optional chaining unless a missing value is intentionally accepted.',
    ]
      .join(' ',),
  },
  'no-array-callback-reference': {
    guidance: [
      'Direct callback references let array iterator methods pass value, index, and source collection into functions that may not expect them.',
      'Fix: pass an inline named function expression, e.g. `items.map(function name(item,) { return f(item,); },)`.',
      'For an existing reference such as `Number.parseInt`, wrap it with `unary` or `binary` from `@monochromatic-dev/module-function-arity` to cap the arity safely.',
    ]
      .join(' ',),
  },
  'prefer-spread': {
    guidance: [
      'On an array or arguments object this spread autofix is correct and needs no further action.',
      'On a string, the resulting `[...str]` then trips typescript/no-misused-spread because code-point spreading breaks grapheme clusters.',
      'Fix for strings: use a string API (`toLowerCase`/`toUpperCase` comparisons, `includes`, or `charAt` index scans) rather than Array.from, spread, or `for...of` over the string.',
      'When code-point iteration is genuinely required, keep the spread and add a scoped `oxlint-disable-next-line typescript/no-misused-spread` with justification.',
    ]
      .join(' ',),
  },
  'no-misused-spread': {
    guidance: [
      'Spreading a string splits it into code points, which silently breaks grapheme clusters such as emoji and combining marks.',
      'Fix: use a string API instead. `str !== str.toLowerCase()` detects an uppercase letter; `[allowed,].some(function has(c,) { return str.includes(c,); },)` tests character membership; `str.charAt(i,)` inside a counted `for` loop scans by index.',
      'Do not switch to `Array.from(str)` or `for (const c of str)`: both share the grapheme problem, and unicorn/prefer-spread rewrites `Array.from` straight back into a spread.',
      'If code-point iteration is genuinely needed and grapheme-incorrectness is acceptable, add a scoped `oxlint-disable-next-line typescript/no-misused-spread -- <why code points, why graphemes are irrelevant here>`.',
    ]
      .join(' ',),
  },
  'no-sync': {
    guidance: [
      'use `access` from `node:fs/promises` instead of `existsSync` when checking whether a path exists but not immediately opening, reading, or writing it.',
      'If the path is used immediately, call the file operation directly and handle `ENOENT`/`EEXIST` to avoid a time-of-check/time-of-use race.',
    ]
      .join(' ',),
    headerIncludes: [
      'existsSync',
    ],
  },
};

//endregion Rule guidance

//region Guidance resolution

/**
 * Resolves configured guidance for a parsed oxlint diagnostic header.
 *
 * Some rule guidance is guarded by a diagnostic header fragment so specialised
 * messages can target one diagnostic variant without affecting the rest of the rule.
 *
 * @param ruleName - rule parsed from the diagnostic header
 *
 * @param strippedHeaderLine - ANSI-stripped diagnostic header line
 *
 * @returns configured guidance, or {@link NO_DIAGNOSTIC_GUIDANCE} when none applies
 *
 * @example
 * ```ts
 * resolveDiagnosticGuidance({
 *   ruleName: 'no-misused-promises',
 *   strippedHeaderLine: 'x typescript-eslint(no-misused-promises): Promise-returning function.',
 * });
 * // 'Async callbacks silently drop ...'
 * ```
 */
export function resolveDiagnosticGuidance({
  ruleName,
  strippedHeaderLine,
}: {
  readonly ruleName: string;
  readonly strippedHeaderLine: string;
},): string | typeof NO_DIAGNOSTIC_GUIDANCE {
  /**
   * Guidance entry, when this rule has configured advice.
   */
  const ruleGuidance = RULE_GUIDANCE[ruleName];
  if (ruleGuidance === undefined)
    return NO_DIAGNOSTIC_GUIDANCE;

  if (ruleGuidance.headerIncludes !== undefined) {
    for (const headerFragment of ruleGuidance.headerIncludes) {
      if (!strippedHeaderLine.includes(headerFragment,))
        return NO_DIAGNOSTIC_GUIDANCE;
    }
  }

  return ruleGuidance.guidance;
}

//endregion Guidance resolution
