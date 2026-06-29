/**
 * Rule-specific oxlint diagnostic guidance configuration.
 *
 * This module owns the rule knowledge used by the generic output augmenter:
 * which diagnostics receive extra text, and whether that text is `help:` or
 * `note:` guidance.
 *
 * @module
 */

//region Guidance types

/**
 * Guidance text that should be emitted as or appended to `help:`.
 */
export type HelpDiagnosticGuidance = {
  /**
   * Human-readable help text.
   */
  readonly helpText: string;
};

/**
 * Guidance text that should be emitted as a separate `note:`.
 */
export type NoteDiagnosticGuidance = {
  /**
   * Human-readable note text.
   */
  readonly noteText: string;
};

/**
 * Fully resolved guidance for one oxlint diagnostic block.
 */
export type DiagnosticGuidance = HelpDiagnosticGuidance | NoteDiagnosticGuidance;

/**
 * Sentinel returned when no configured guidance matches a diagnostic header.
 */
export const NO_DIAGNOSTIC_GUIDANCE: unique symbol = Symbol('diagnostic_guidance_absent',);

/**
 * Guidance entry matched by both rule name and diagnostic header content.
 */
type ContextualGuidance = {
  /**
   * Oxlint rule name parsed from the diagnostic header.
   */
  readonly ruleName: string;
  /**
   * Plain-text diagnostic header fragment required for this entry to match.
   */
  readonly headerIncludes: string;
  /**
   * Guidance emitted when both rule name and header text match.
   */
  readonly guidance: DiagnosticGuidance;
};

//endregion Guidance types

//region Rule guidance

/**
 * Maps oxlint rule names to enhanced standalone `note:` guidance.
 *
 * @example
 * ```ts
 * RULE_NOTE_GUIDANCE['no-misused-promises'];
 * // 'Async callbacks silently drop ...'
 * ```
 */
export const RULE_NOTE_GUIDANCE: Record<string, string> = {
  'no-misused-promises': [
    'Async callbacks silently drop Promise rejections because the caller ignores the return value.',
    'Fix: make the outer listener synchronous, call `void (async function name() { try { ... } catch (e) { console.error(e); } })()` inside it.',
    'Adding `void` alone only silences the type error without handling rejections.',
  ]
    .join(' ',),
  'no-array-callback-reference': [
    'oxlint suggests wrapping the callback in an arrow function, but the local no-arrow-function lint rule rejects arrow functions.',
    'Fix: pass an inline named function expression, e.g. `items.map(function name(item,) { return f(item,); },)`; an inline expression is not a flagged reference, so the rule passes.',
    'For an existing reference such as `Number.parseInt`, wrap it with `unary` or `binary` from `@monochromatic-dev/module-function-arity` to cap the arity safely.',
  ]
    .join(' ',),
  'prefer-spread': [
    'On an array or arguments object this spread autofix is correct and needs no further action.',
    'On a string, the resulting `[...str]` then trips typescript/no-misused-spread because code-point spreading breaks grapheme clusters.',
    'Fix for strings: use a string API (`toLowerCase`/`toUpperCase` comparisons, `includes`, or `charAt` index scans) rather than Array.from, spread, or `for...of` over the string.',
    'When code-point iteration is genuinely required, keep the spread and add a scoped `oxlint-disable-next-line typescript/no-misused-spread` with justification.',
  ]
    .join(' ',),
};

/**
 * Maps oxlint rule names to enhanced text that should extend `help:` guidance.
 */
export const RULE_HELP_GUIDANCE: Record<string, string> = {
  'no-misused-spread': [
    'Spreading a string splits it into code points, which silently breaks grapheme clusters such as emoji and combining marks.',
    'Fix: use a string API instead. `str !== str.toLowerCase()` detects an uppercase letter; `[allowed,].some(function has(c,) { return str.includes(c,); },)` tests character membership; `str.charAt(i,)` inside a counted `for` loop scans by index.',
    'Do not switch to `Array.from(str)` or `for (const c of str)`: both share the grapheme problem, and unicorn/prefer-spread rewrites `Array.from` straight back into a spread.',
    'If code-point iteration is genuinely needed and grapheme-incorrectness is acceptable, add a scoped `oxlint-disable-next-line typescript/no-misused-spread -- <why code points, why graphemes are irrelevant here>`.',
  ]
    .join(' ',),
};

/**
 * Help text injected for `node/no-sync` diagnostics that flag `existsSync`.
 *
 * `existsSync` is often used as a pure existence probe, so the closest async
 * replacement is `access` from `node:fs/promises`. The Node.js docs warn not to
 * check access immediately before opening/reading/writing the same path because
 * that introduces a time-of-check/time-of-use race; in that case, use the file
 * operation directly and handle the resulting error.
 *
 * @example
 * ```text
 * help: use `access` from `node:fs/promises` instead of `existsSync` ...
 * ```
 */
export const EXISTS_SYNC_ACCESS_HELP = [
  'use `access` from `node:fs/promises` instead of `existsSync` when checking whether a path exists but not immediately opening, reading, or writing it.',
  'If the path is used immediately, call the file operation directly and handle `ENOENT`/`EEXIST` to avoid a time-of-check/time-of-use race.',
]
  .join(' ',);

/**
 * Guidance entries that depend on diagnostic message text as well as rule name.
 */
const CONTEXTUAL_GUIDANCE: readonly ContextualGuidance[] = [
  {
    ruleName: 'no-sync',
    headerIncludes: 'existsSync',
    guidance: {
      helpText: EXISTS_SYNC_ACCESS_HELP,
    },
  },
];

//endregion Rule guidance

//region Guidance resolution

/**
 * Resolves configured guidance for a parsed oxlint diagnostic header.
 *
 * Contextual guidance wins over rule-name-only guidance so specialised messages
 * can target one diagnostic variant without affecting the rest of the rule.
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
 * // { noteText: 'Async callbacks silently drop ...' }
 * ```
 */
export function resolveDiagnosticGuidance({
  ruleName,
  strippedHeaderLine,
}: {
  readonly ruleName: string;
  readonly strippedHeaderLine: string;
},): DiagnosticGuidance | typeof NO_DIAGNOSTIC_GUIDANCE {
  /**
   * Contextual entry matching both the parsed rule name and diagnostic message.
   */
  const contextualGuidance = CONTEXTUAL_GUIDANCE.find(
    function matchesContextualGuidance(entry: ContextualGuidance,): boolean {
      return (entry.ruleName === ruleName)
        && strippedHeaderLine.includes(entry.headerIncludes,);
    },
  );
  if (contextualGuidance !== undefined)
    return contextualGuidance.guidance;

  /**
   * Rule-name-only help text, when this rule extends oxlint's help guidance.
   */
  const helpGuidance = RULE_HELP_GUIDANCE[ruleName];
  if (helpGuidance !== undefined) {
    return {
      helpText: helpGuidance,
    };
  }

  /**
   * Rule-name-only note text, when this rule has standalone advice.
   */
  const noteGuidance = RULE_NOTE_GUIDANCE[ruleName];
  if (noteGuidance === undefined)
    return NO_DIAGNOSTIC_GUIDANCE;

  return {
    noteText: noteGuidance,
  };
}

//endregion Guidance resolution
