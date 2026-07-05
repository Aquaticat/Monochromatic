/**
 * Comment-driven mutation suppression.
 *
 * Syntax, mirroring the repo's oxlint disable-comment shape:
 *
 * ```ts
 * // mutation-test-disable-next-line string, boolean -- reason
 * // mutation-test-disable-file regex -- reason
 * ```
 *
 * Family lists are optional (bare directives suppress every family);
 * reasons after `--` are optional but land in the report so ignored
 * mutants stay auditable.
 *
 * @example
 * ```ts
 * const rules = suppressionRules({ comments, table });
 * suppressionReason({ rules, line: 4, operator: 'string' });
 * ```
 */

import { positionAt, } from './lines.ts';
import type { OperatorName, } from './types.ts';

/**
 * Next-line directive prefix inside a comment's text.
 */
const NEXT_LINE_DIRECTIVE = 'mutation-test-disable-next-line';

/**
 * File-level directive prefix inside a comment's text.
 */
const FILE_DIRECTIVE = 'mutation-test-disable-file';

/**
 * Every valid operator family name, for directive validation.
 */
const FAMILY_NAMES: ReadonlySet<string> = new Set([
  'arithmetic',
  'equality',
  'logical',
  'conditional',
  'boolean',
  'string',
  'unary',
  'update',
  'array',
  'object',
  'optional-chaining',
  'block',
  'method',
  'arrow',
  'regex',
],);

/**
 * One parsed suppression rule.
 *
 * `line` is the source line the rule suppresses (undefined for file-wide
 * rules); an empty `families` set means every family.
 */
export type SuppressionRule = {
  readonly line: number | undefined;
  readonly families: ReadonlySet<OperatorName>;
  readonly reason: string;
};

/**
 * Comment shape produced by oxc-parser.
 */
export type OxcComment = {
  readonly value: string;
  readonly start: number;
  readonly end: number;
};

/**
 * Parses one directive tail into families and reason.
 *
 * @param tail - Directive text after the directive keyword.
 *
 * @returns Families (empty for all) and reason.
 *
 * @throws Error when a family name is not a known operator family.
 *
 * @example
 * ```ts
 * parseDirectiveTail('string, boolean -- flaky filler');
 * ```
 */
function parseDirectiveTail(tail: string,): {
  readonly families: ReadonlySet<OperatorName>;
  readonly reason: string;
} {
  /**
   * Reason separator position in the directive tail.
   */
  const separatorAt = tail.indexOf('--',);
  /**
   * Family list text before the reason separator.
   */
  const familiesText = (separatorAt === -1 ? tail : tail.slice(
    0,
    separatorAt,
  )).trim();
  /**
   * Reason text after the separator.
   */
  const reason = separatorAt === -1 ? '' : tail.slice(separatorAt + 2,)
    .trim();
  /**
   * Declared family names, empty when the directive suppresses all.
   */
  const families = familiesText === ''
    ? []
    : familiesText.split(',',)
      .map(function trimName(name,): string {
        return name.trim();
      },);

  for (const family of families) {
    if (!FAMILY_NAMES.has(family,))
      throw new Error(
        `unknown mutation family ${family} in suppression comment; known: ${[...FAMILY_NAMES,].join(', ',)}`,
      );
  }

  return {
    families: new Set(families as readonly OperatorName[],),
    reason,
  };
}

/**
 * Parses suppression rules out of a file's comments.
 *
 * @param options - oxc comments and the file's line-start table.
 *
 * @returns Parsed rules, possibly empty.
 *
 * @throws Error when a directive names an unknown family.
 *
 * @example
 * ```ts
 * suppressionRules({ comments: result.comments, table: lineStarts(source) });
 * ```
 */
export function suppressionRules(options: {
  readonly comments: readonly OxcComment[];
  readonly table: readonly number[];
},): readonly SuppressionRule[] {
  return options.comments.flatMap(function toRules(comment,): readonly SuppressionRule[] {
    /**
     * Comment text without leading whitespace.
     */
    const text = comment.value.trim();

    if (text.startsWith(NEXT_LINE_DIRECTIVE,)) {
      /**
       * Families and reason after the next-line keyword.
       */
      const tail = parseDirectiveTail(text.slice(NEXT_LINE_DIRECTIVE.length,),);
      return [{
        line: positionAt({
          table: options.table,
          offset: comment.start,
        },).line + 1,
        families: tail.families,
        reason: tail.reason,
      },];
    }

    if (text.startsWith(FILE_DIRECTIVE,)) {
      /**
       * Families and reason after the file-level keyword.
       */
      const tail = parseDirectiveTail(text.slice(FILE_DIRECTIVE.length,),);
      return [{
        line: undefined,
        families: tail.families,
        reason: tail.reason,
      },];
    }

    return [];
  },);
}

/**
 * Finds the suppression reason covering one mutant, if any.
 *
 * @param options - Parsed rules plus the mutant's line and family.
 *
 * @returns Reason text (possibly empty) when suppressed, undefined otherwise.
 *
 * @example
 * ```ts
 * suppressionReason({ rules, line: 4, operator: 'string' });
 * ```
 */
export function suppressionReason(options: {
  readonly rules: readonly SuppressionRule[];
  readonly line: number;
  readonly operator: OperatorName;
},): string | undefined {
  /**
   * First rule matching the mutant's line and family.
   */
  const match = options.rules.find(function matches(rule,): boolean {
    if ((rule.line !== undefined) && (rule.line !== options.line))
      return false;

    return (rule.families.size === 0) || rule.families.has(options.operator,);
  },);

  return match === undefined ? undefined : match.reason;
}
