// stringReplaceByReplacementRules({str: '', rules: []}) // ''

// stringReplaceByReplacementRules({str: 'a', rules: [{replaceAll: true, patternString: 'a', replacement: 'b'}]}) // 'b' logs warning "replaceAll specified but only one instance found, replaced one"

// stringReplaceByReplacementRules({str: 'a', rules: [{patternString: 'a', replacement: 'b'}]}) // 'b'

// stringReplaceByReplacementRules({str: 'aa', rules: [{patternString: 'a', replacement: 'b'}]}) // 'ba' logs warning "multiple instances found but replaceAll not specified, replaced one"

// stringReplaceByReplacementRules({str: 'ab', rules: [{patternString: 'a', replacement: 'b'},{patternString: 'bb', replacement: 'c'}]}); // 'c' logs warning `rule ${JSON.stringify(rule)} targeted some or all of the same lines as a previous rule, executed in order`

// stringReplaceByReplacementRules({str: 'a', rules: [{patternString: 'a', replacement: 'b', lines: {start: 0, end: 0}]}) // 'b' logs warning `str ${str} lines range is equal to given lines range ${JSON.stringify(lines)}`

// stringReplaceByReplacementRules({str: 'a\nab\na'}, rules: [{patternString: 'a', replacement: 'c', lines: {start: 0, end: 1}}]) // 'c\ncb\na'

import type { UnknownRecord, } from 'type-fest';
import type { MaybeAsyncIterable, } from './iterable.basic';
import type { Jsonl, } from './jsonl.basic';
import type { Logged, } from './logged.basic';
import { getDefaultLogger, } from './string.log';

type ReplacementRule = {
  readonly replaceAll?: true;
  /** If matches ^\/.+\/$ , will be created as Regexp with g,m,v flags, otherwise treated as literal string */
  readonly patternString: string;
  /** literal string */
  readonly replacement: string;
  /** Only replace in which lines */
  readonly lines?: {
    readonly start: number;
    readonly end: number;
  };
};

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

export async function stringReplaceByReplacementRules(
  { str, rules, l = getDefaultLogger(), }: { str: string;
    rules: MaybeAsyncIterable<ReplacementRule>; } & Partial<Logged>,
): Promise<string> {
  l.debug('stringReplaceByReplacementRules',);

  const initialContext = { linesTargetedByPreviousRules: [] as number[], };
  const ruleArray: ReplacementRule[] = [];

  // Collect all rules first
  for await (const rule of rules)
    ruleArray.push(rule,);

  // Process using the same immutable pattern
  return ruleArray
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
          context: currentResult.context,
        };
      },
      { str, context: initialContext, },
    )
    .str;
}

/**
 * Counts occurrences of a pattern in a string
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
 * Creates a range of line numbers
 */
function createLineRange(start: number, end: number,): number[] {
  return Array.from({ length: end - start + 1, }, (_, index,) => start + index,);
}

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
