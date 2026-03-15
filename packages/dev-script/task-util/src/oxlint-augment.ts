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

//region ANSI handling

/**
 * Pattern matching ANSI escape sequences used for terminal colors and formatting.
 *
 * Uses `\u001B` hex escape instead of `\u001B` to satisfy `no-control-regex`
 * while remaining functionally identical.
 *
 * @example
 * ```ts
 * '\u001B[31merror\u001B[0m'.replace(ANSI_PATTERN, '');
 * // 'error'
 * ```
 */
// oxlint-disable-next-line no-control-regex -- intentional ANSI escape sequence matching
const ANSI_PATTERN = /\u001B\[\d+(?:;\d+)*m/g;

/**
 * Strips ANSI escape codes from a string for reliable text matching.
 *
 * @param text - string potentially containing ANSI escape sequences
 *
 * @returns plain text with all ANSI codes removed
 *
 * @example
 * ```ts
 * stripAnsi('\u001B[31merror\u001B[0m');
 * // 'error'
 * ```
 */
export function stripAnsi(text: string,): string {
  return text.replace(ANSI_PATTERN, '',);
}

//endregion ANSI handling

//region Rule guidance -- enhanced messages for specific lint rules

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
    'For bun:test `describe($, ...)` where `$` is async, pass `$.name` instead -- bun only reads the `.name` property.',
  ].join(' ',),
};

//endregion Rule guidance

//region Diagnostic detection

/**
 * Pattern matching oxlint diagnostic header lines.
 *
 * Oxlint uses `x` for errors and `!` for warnings,
 * followed by `plugin(rule-name): message`.
 *
 * @example
 * ```ts
 * DIAGNOSTIC_HEADER_PATTERN.exec('  x typescript-eslint(no-misused-promises): Promise-returning function ...');
 * // match[1] === 'no-misused-promises'
 * ```
 */
const DIAGNOSTIC_HEADER_PATTERN = /[x!]\s+\S+\(([\w-]+)\)\s*:/;

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
  const match = DIAGNOSTIC_HEADER_PATTERN.exec(stripAnsi(line,),);
  if (match === null)
    return null;
  return match[1] ?? null;
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

  const lines = output.split('\n',);
  const result: string[] = [];

  /** Rule name from the current diagnostic block, null when unmatched. */
  let activeGuidance: string | null = null;

  /** Whether guidance has been injected for the current diagnostic block. */
  let injected = false;

  for (const line of lines) {
    const ruleName = extractRuleName(line,);
    if (ruleName !== null) {
      activeGuidance = RULE_GUIDANCE[ruleName] !== undefined ? ruleName : null;
      injected = false;
    }

    // Inject after help line when guidance is pending
    if (activeGuidance !== null && !injected && isHelpLine(line,)) {
      result.push(line,);
      result.push(formatGuidanceLine(RULE_GUIDANCE[activeGuidance] ?? '',),);
      injected = true;
      continue;
    }

    // Inject before blank line (end of diagnostic) if no help line was found
    if (activeGuidance !== null && !injected && stripAnsi(line,).trim() === '') {
      result.push(formatGuidanceLine(RULE_GUIDANCE[activeGuidance] ?? '',),);
      injected = true;
      activeGuidance = null;
    }

    result.push(line,);
  }

  // Handle trailing diagnostic with no blank line at end
  if (activeGuidance !== null && !injected)
    result.push(formatGuidanceLine(RULE_GUIDANCE[activeGuidance] ?? '',),);

  return result.join('\n',);
}

//endregion Output augmentation
