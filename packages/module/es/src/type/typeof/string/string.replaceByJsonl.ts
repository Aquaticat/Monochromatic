import type { UnknownRecord, } from 'type-fest';
import type { MaybeAsyncIterable, } from '../../../iterable.basic';
import type { Logged, } from '../../custom/object/logged/logged.basic';
import type { Jsonl, } from '../../custom/string/jsonl/jsonl.basic';
import { getDefaultLogger, } from './log';

/**
 * Rule definition for string replacement operations.
 * Supports both literal string and regex patterns with optional line filtering and replacement modes.
 *
 * @example
 * ```ts
 * // Basic string replacement
 * const basicRule: ReplacementRule = {
 *   patternString: 'old',
 *   replacement: 'new'
 * };
 *
 * // Regex pattern with replaceAll
 * const regexRule: ReplacementRule = {
 *   patternString: '/\\d+/',
 *   replacement: 'NUM',
 *   replaceAll: true
 * };
 *
 * // Line-specific replacement
 * const lineRule: ReplacementRule = {
 *   patternString: 'error',
 *   replacement: 'warning',
 *   lines: { start: 0, end: 5 }
 * };
 * ```
 */
type ReplacementRule = {
  /** When true, replaces all occurrences instead of just the first one */
  readonly replaceAll?: true;
  /**
   * Pattern to search for. If matches /^\/.*\/$/, will be created as RegExp with g,m,v flags.
   * Otherwise treated as literal string for exact matching.
   */
  readonly patternString: string;
  /** Literal replacement string to substitute for matches */
  readonly replacement: string;
  /**
   * Optional line range constraint. When specified, only applies replacement within these lines.
   * Line numbers are zero-indexed and inclusive on both ends.
   */
  readonly lines?: {
    /** Starting line number (inclusive, zero-indexed) */
    readonly start: number;
    /** Ending line number (inclusive, zero-indexed) */
    readonly end: number;
  };
};

// stringReplaceByReplacementRules({str: '', rules: []}) // ''

// stringReplaceByReplacementRules({str: 'a', rules: [{replaceAll: true, patternString: 'a', replacement: 'b'}]}) // 'b' logs warning "replaceAll specified but only one instance found, replaced one"

// stringReplaceByReplacementRules({str: 'a', rules: [{patternString: 'a', replacement: 'b'}]}) // 'b'

// stringReplaceByReplacementRules({str: 'aa', rules: [{patternString: 'a', replacement: 'b'}]}) // 'ba' logs warning "multiple instances found but replaceAll not specified, replaced one"

// stringReplaceByReplacementRules({str: 'ab', rules: [{patternString: 'a', replacement: 'b'},{patternString: 'bb', replacement: 'c'}]}); // 'c' logs warning `rule ${JSON.stringify(rule)} targeted some or all of the same lines as a previous rule, executed in order`

// stringReplaceByReplacementRules({str: 'a', rules: [{patternString: 'a', replacement: 'b', lines: {start: 0, end: 0}]}) // 'b' logs warning `str ${str} lines range is equal to given lines range ${JSON.stringify(lines)}`

// stringReplaceByReplacementRules({str: 'a\nab\na'}, rules: [{patternString: 'a', replacement: 'c', lines: {start: 0, end: 1}}]) // 'c\ncb\na'

/**
 * Applies replacement rules from JSONL format to a string.
 * Each line in JSONL should be a valid ReplacementRule object.
 *
 * @param str - String to process with replacement rules
 * @param jsonl - JSONL format string containing replacement rules
 * @param l - Logger for debug and warning messages
 * @returns Processed string with all replacements applied
 * @example
 * ```ts
 * const result = stringReplaceByJsonl({
 *   str: 'hello world',
 *   jsonl: '{"patternString": "world", "replacement": "universe"}'
 * });
 * // Returns: 'hello universe'
 * ```
 */
export function stringReplaceByJsonl(
  { str, jsonl, l = getDefaultLogger(), }: { str: string; jsonl: Jsonl; } & Partial<
    Logged
  >,
): string {
  l.debug('stringReplaceByJsonl',);

  // Convert JSONL to objects and then to rules
  const objects = jsonlToObjects({ jsonl, l, },);
  const rules = objects as ReplacementRule[];

  // Use the sync version to process rules
  return stringReplaceByReplacementRulesSync({ str, rules, l, },);
}

/**
 * Applies multiple replacement rules to a string synchronously.
 * Rules are processed sequentially, with each rule operating on the result of the previous rule.
 *
 * @param str - String to process with replacement rules
 * @param rules - Iterable of replacement rules to apply sequentially
 * @param l - Logger for debug and warning messages
 * @returns Processed string with all replacements applied
 * @example
 * ```ts
 * const rules = [
 *   { patternString: 'old', replacement: 'new' },
 *   { patternString: 'bad', replacement: 'good' }
 * ];
 * const result = stringReplaceByReplacementRulesSync({
 *   str: 'old bad text',
 *   rules
 * });
 * // Returns: 'new good text'
 * ```
 */
export function stringReplaceByReplacementRulesSync(
  { str, rules, l = getDefaultLogger(), }:
    & { str: string; rules: Iterable<ReplacementRule>; }
    & Partial<Logged>,
): string {
  l.debug('stringReplaceByReplacementRulesSync',);

  const initialContext = { linesTargetedByPreviousRules: [] as number[], };

  // Process each rule sequentially using reduce for immutable accumulation
  return Array
    .from(rules,)
    .reduce(
      (currentResult, rule,) => {
        const newResult = stringReplaceByReplacementRule({
          str: currentResult.str,
          rule,
          l,
          context: currentResult.context,
        },);

        return {
          str: newResult,
          context: currentResult.context, // context is mutated by reference as required
        };
      },
      { str, context: initialContext, },
    )
    .str;
}

/**
 * Applies multiple replacement rules to a string asynchronously.
 * Processes rules as they arrive from the async iterable for efficient streaming.
 * Rules are processed sequentially, maintaining order and context between rules.
 *
 * @param str - String to process with replacement rules
 * @param rules - Async iterable of replacement rules to apply sequentially
 * @param l - Logger for debug and warning messages
 * @returns Promise resolving to processed string with all replacements applied
 * @example
 * ```ts
 * async function* generateRules() {
 *   yield { patternString: 'old', replacement: 'new' };
 *   yield { patternString: 'bad', replacement: 'good' };
 * }
 *
 * const result = await stringReplaceByReplacementRules({
 *   str: 'old bad text',
 *   rules: generateRules()
 * });
 * // Returns: 'new good text'
 * ```
 */
export async function stringReplaceByReplacementRules(
  { str, rules, l = getDefaultLogger(), }: { str: string;
    rules: MaybeAsyncIterable<ReplacementRule>; } & Partial<Logged>,
): Promise<string> {
  l.debug('stringReplaceByReplacementRules',);

  // Use mutable variables for efficient streaming processing
  let currentStr = str;
  const context = { linesTargetedByPreviousRules: [] as number[], };

  // Process each rule as it arrives, don't collect them first
  for await (const rule of rules) {
    currentStr = stringReplaceByReplacementRule({
      str: currentStr,
      rule,
      l,
      context,
    },);
  }

  return currentStr;
}

/**
 * Counts occurrences of a pattern in a string using functional approach.
 * Handles both string literals and RegExp patterns efficiently.
 *
 * @param text - String to search within
 * @param pattern - String literal or RegExp pattern to count
 * @returns Number of occurrences found
 */
function countOccurrences(text: string, pattern: string | RegExp,): number {
  if (pattern instanceof RegExp) {
    const matches = text.match(pattern,);
    return matches ? matches.length : 0;
  }

  // At this point, TypeScript knows pattern is a string
  const patternString = pattern as string;

  // Use functional approach for string counting
  function findIndices(searchText: string, startIndex: number,): number[] {
    const foundIndex = searchText.indexOf(patternString, startIndex,);
    if (foundIndex === -1)
      return [];
    return [foundIndex, ...findIndices(searchText, foundIndex + patternString.length,),];
  }

  return findIndices(text, 0,).length;
}

/**
 * Creates a range of consecutive line numbers.
 * Used for determining which lines should be targeted by replacement rules.
 *
 * @param start - Starting line number (inclusive)
 * @param end - Ending line number (inclusive)
 * @returns Array of line numbers from start to end
 */
function createLineRange(start: number, end: number,): number[] {
  return Array.from({ length: end - start + 1, }, (_, index,) => start + index,);
}

/**
 * Applies a single replacement rule to a string with comprehensive logging and validation.
 * Handles regex patterns, line filtering, occurrence counting, and context tracking.
 * Provides detailed warnings for edge cases and overlapping rule scenarios.
 *
 * @param str - String to process with replacement rule
 * @param rule - Replacement rule defining pattern, replacement, and optional constraints
 * @param l - Logger for debug and warning messages
 * @param context - Optional context for tracking lines targeted by previous rules
 * @returns Processed string with replacement applied according to rule specifications
 *
 * @example
 * ```ts
 * // Basic replacement
 * const result = stringReplaceByReplacementRule({
 *   str: 'hello world',
 *   rule: { patternString: 'world', replacement: 'universe' }
 * });
 * // Returns: 'hello universe'
 *
 * // Regex replacement with replaceAll
 * const regexResult = stringReplaceByReplacementRule({
 *   str: 'foo123bar456',
 *   rule: { patternString: '/\\d+/', replacement: 'NUM', replaceAll: true }
 * });
 * // Returns: 'fooNUMbarNUM'
 *
 * // Line-specific replacement
 * const lineResult = stringReplaceByReplacementRule({
 *   str: 'line1\nline2\nline3',
 *   rule: {
 *     patternString: 'line',
 *     replacement: 'row',
 *     lines: { start: 0, end: 1 }
 *   }
 * });
 * // Returns: 'row1\nrow2\nline3'
 * ```
 */
export function stringReplaceByReplacementRule(
  { str, rule, l = getDefaultLogger(), context, }:
    & { str: string; rule: ReplacementRule;
      context?: { linesTargetedByPreviousRules: number[]; }; }
    & Partial<Logged>,
): string {
  l.debug('stringReplaceByReplacementRule', {
    patternString: rule.patternString,
    replacement: rule.replacement,
    replaceAll: String(rule.replaceAll ?? false,),
    lines: rule.lines ? JSON.stringify(rule.lines,) : 'undefined',
  },);

  // Handle empty string case
  if (str === '')
    return str;

  // Determine if pattern is regex (matches /^\/.*\/$/) or literal string
  const isRegexPattern = /^\/.*\/$/.test(rule.patternString,);
  const pattern = isRegexPattern
    ? new RegExp(rule.patternString.slice(1, -1,), 'gmv',)
    : rule.patternString;

  // Split string into lines for line-based processing
  const lines = str.split('\n',);
  const totalLines = lines.length;

  // Determine line range using functional approach
  const { start: startLine, end: endLine, } = rule.lines
    ? rule.lines
    : { start: 0, end: totalLines - 1, };

  const targetedLines = rule.lines
    ? createLineRange(startLine, endLine,)
    : createLineRange(0, totalLines - 1,);

  // Warning: lines range equals entire string range
  if (rule.lines && startLine === 0 && endLine === totalLines - 1) {
    l.warn(
      `str ${str} lines range is equal to given lines range ${
        JSON.stringify(rule.lines,)
      }`,
    );
  }

  // Check for overlap with previous rules
  if (context?.linesTargetedByPreviousRules) {
    const hasOverlap = targetedLines.some(lineNum =>
      context.linesTargetedByPreviousRules.includes(lineNum,)
    );
    if (hasOverlap) {
      l.warn(
        `rule ${
          JSON.stringify(rule,)
        } targeted some or all of the same lines as a previous rule, executed in order`,
      );
    }
  }

  // Process lines using functional approach
  const processedLines = lines.map((line, lineIndex,) => {
    // Skip lines outside the specified range
    if (rule.lines && (lineIndex < startLine || lineIndex > endLine))
      return line;

    // Count occurrences for warning logic
    const occurrenceCount = countOccurrences(line, pattern,);

    // Generate appropriate warnings based on replaceAll flag and occurrence count
    if (rule.replaceAll && occurrenceCount === 1)
      l.warn('replaceAll specified but only one instance found, replaced one',);
    else if (!rule.replaceAll && occurrenceCount > 1)
      l.warn('multiple instances found but replaceAll not specified, replaced one',);

    // Perform the replacement using functional approach
    return rule.replaceAll
      ? (isRegexPattern
        ? line.replace(pattern as RegExp, rule.replacement,)
        : line.replaceAll(pattern as string, rule.replacement,))
      : (isRegexPattern
        ? line.replace(new RegExp((pattern as RegExp).source, 'mv',), rule.replacement,)
        : line.replace(pattern as string, rule.replacement,));
  },);

  // Update context with newly targeted lines (mutation required for context tracking)
  if (context)
    context.linesTargetedByPreviousRules.push(...targetedLines,);

  return processedLines.join('\n',);
}

//region To be put in other files
// TODO: Put in other files myself

/**
 * Parses JSONL (JSON Lines) format string into array of objects.
 * Each line should contain a valid JSON object, empty lines are filtered out.
 *
 * @param jsonl - JSONL format string with one JSON object per line
 * @param l - Logger for debug messages
 * @returns Array of parsed JSON objects
 * @throws Will throw if any line contains invalid JSON
 *
 * @example
 * ```ts
 * const jsonl = `{"name": "Alice", "age": 30}
 * {"name": "Bob", "age": 25}`;
 *
 * const objects = jsonlToObjects({ jsonl });
 * // Returns: [{"name": "Alice", "age": 30}, {"name": "Bob", "age": 25}]
 * ```
 */
export function jsonlToObjects(
  { jsonl, l = getDefaultLogger(), }: { jsonl: Jsonl; } & Partial<
    Logged
  >,
): UnknownRecord[] {
  l.debug('jsonlToObjects',);
  return jsonl
    .split('\n',)
    .map(function trim(json,) {
      return json.trim();
    },)
    .filter(Boolean,)
    .map(function parse(json,) {
      return JSON.parse(json,);
    },);
}

//endregion To be put in other files
