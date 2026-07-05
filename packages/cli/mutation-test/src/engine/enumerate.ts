/**
 * Mutant enumeration: parse one source file and emit every mutant.
 *
 * Runs host-side; containers only ever see the resulting span manifest.
 *
 * @example
 * ```ts
 * enumerateMutants({ file: 'src/a.ts', source: 'const x = 1 + 2;' });
 * ```
 */

import { parseSync, } from 'oxc-parser';

import {
  lineStarts,
  positionAt,
} from './lines.ts';
import { mutantId, } from './mutant-id.ts';
import { allOperators, } from './operators/index.ts';
import {
  suppressionReason,
  suppressionRules,
  type OxcComment,
} from './suppression.ts';
import { walk, } from './walk.ts';
import type {
  EstreeNode,
  Mutant,
  Replacement,
} from './types.ts';

/**
 * Mutant excluded by a suppression comment, kept for report honesty.
 */
export type IgnoredMutant = Mutant & {
  readonly reason: string;
};

/**
 * Enumeration output: runnable mutants plus suppressed ones.
 */
export type EnumerationResult = {
  readonly mutants: readonly Mutant[];
  readonly ignored: readonly IgnoredMutant[];
};

/**
 * Builds a full mutant from one replacement.
 *
 * @param options - Replacement, file identity, source, and line table.
 *
 * @returns Identified mutant with position info.
 *
 * @example
 * ```ts
 * toMutant({ replacement, file: 'src/a.ts', source, table });
 * ```
 */
function toMutant(options: {
  readonly replacement: Replacement;
  readonly file: string;
  readonly source: string;
  readonly table: readonly number[];
},): Mutant {
  /**
   * One-based line and zero-based column of the replacement start.
   */
  const position = positionAt({
    table: options.table,
    offset: options.replacement.start,
  },);

  return {
    id: mutantId({
      file: options.file,
      start: options.replacement.start,
      end: options.replacement.end,
      operator: options.replacement.operator,
      replacement: options.replacement.text,
    },),
    file: options.file,
    start: options.replacement.start,
    end: options.replacement.end,
    line: position.line,
    column: position.column,
    operator: options.replacement.operator,
    original: options.source.slice(
      options.replacement.start,
      options.replacement.end,
    ),
    replacement: options.replacement.text,
    description: options.replacement.description,
  };
}

/**
 * Enumerates every mutant in one source file.
 *
 * Identical (span, replacement) pairs from overlapping families dedupe;
 * output is sorted by span then replacement so manifests stay stable
 * across runs.
 *
 * @param options - Package-relative file path and its source text.
 *
 * @returns Runnable mutants plus suppression-ignored mutants.
 *
 * @throws Error when the file does not parse.
 *
 * @example
 * ```ts
 * const { mutants, ignored } = enumerateMutants({ file: 'src/a.ts', source });
 * ```
 */
export function enumerateMutants(options: {
  readonly file: string;
  readonly source: string;
},): EnumerationResult {
  /**
   * Parse result carrying program, comments, and syntax errors.
   */
  const parsed = parseSync(
    options.file,
    options.source,
  );

  if (parsed.errors.length > 0)
    throw new Error(
      `parse of ${options.file} failed: ${parsed.errors
        .map(function toMessage(error,): string {
          return error.message;
        },)
        .join('; ',)}`,
    );

  /**
   * Line-start offsets shared by position math and suppressions.
   */
  const table = lineStarts(options.source,);
  /**
   * Parsed suppression rules from the file's comments.
   */
  const rules = suppressionRules({
    comments: parsed.comments as readonly OxcComment[],
    table,
  },);
  /**
   * All replacements collected across operators, pre-dedupe.
   */
  const collected: Replacement[] = [];

  walk({
    root: parsed.program as unknown as EstreeNode,
    visit: function visitNode(entry,): void {
      for (const operator of allOperators) {
        collected.push(...operator({
          node: entry.node,
          parent: entry.parent,
          source: options.source,
        },),);
      }
    },
  },);

  /**
   * Replacements deduped by span plus replacement text.
   */
  const deduped = [
    ...new Map(collected.map(function bySpanText(replacement,): readonly [
      string,
      Replacement,
    ] {
      return [
        `${String(replacement.start,)}:${String(replacement.end,)}:${replacement.text}`,
        replacement,
      ];
    },),)
      .values(),
  ]
    .sort(function bySpan(a, b,): number {
      return (a.start - b.start)
        || (a.end - b.end)
        || (a.text < b.text ? -1 : 1);
    },);

  /**
   * Runnable mutants accumulated during suppression filtering.
   */
  const mutants: Mutant[] = [];
  /**
   * Suppressed mutants accumulated during suppression filtering.
   */
  const ignored: IgnoredMutant[] = [];

  for (const replacement of deduped) {
    /**
     * Full mutant with identity and position.
     */
    const mutant = toMutant({
      replacement,
      file: options.file,
      source: options.source,
      table,
    },);
    /**
     * Suppression reason covering this mutant, when any rule matches.
     */
    const reason = suppressionReason({
      rules,
      line: mutant.line,
      operator: mutant.operator,
    },);

    if (reason === undefined)
      mutants.push(mutant,);
    else
      ignored.push({
        ...mutant,
        reason,
      },);
  }

  return {
    mutants,
    ignored,
  };
}
