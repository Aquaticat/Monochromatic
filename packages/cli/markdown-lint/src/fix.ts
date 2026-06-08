import { runRules, } from './lint.ts';
import type {
  Diagnostic,
  Fix,
  Rule,
} from './types.ts';

/**
 * Upper bound on fixpoint passes. A correct add-only rule converges in one pass
 * and most multi-edit fixes in two or three; the cap only guards against a rule
 * whose fix is not idempotent, so it never loops forever.
 */
const MAX_PASSES = 10;

/**
 * Parameters for {@link applyFixes}.
 */
export type ApplyFixesParams = {
  /**
   * Source to rewrite.
   */
  readonly source: string;
  /**
   * Diagnostics whose fixes are applied; report-only diagnostics are ignored.
   */
  readonly diagnostics: readonly Diagnostic[];
};

/**
 * Apply every fix in one pass, from the highest source offset to the lowest so
 * an earlier edit never invalidates a later offset. Any fix overlapping one
 * already applied in the pass is dropped (the next pass re-derives it against
 * fresh offsets). Add-only insertions at distinct points never overlap.
 *
 * @param source - source to rewrite
 *
 * @param diagnostics - diagnostics whose fixes are applied
 *
 * @returns rewritten source
 *
 * @example
 * ```ts
 * applyFixes({ source, diagnostics }); // source with non-overlapping fixes applied
 * ```
 */
export function applyFixes({
  source,
  diagnostics,
}: ApplyFixesParams,): string {
  /**
   * Fixes pulled off the diagnostics, sorted by start descending then end
   * descending so the pass walks from the end of the source toward the start.
   */
  const fixes: readonly Fix[] = diagnostics
    .flatMap(function fixOf(diagnostic: Diagnostic,): readonly Fix[] {
      return diagnostic.fix === undefined
        ? []
        : [diagnostic.fix,];
    },)
    .toSorted(function byOffsetDescending(
      left: Fix,
      right: Fix,
    ): number {
      return (right.start - left.start) || (right.end - left.end);
    },);
  /**
   * Lowest start offset among fixes already applied this pass; a later (lower)
   * fix overlaps when its end reaches past this point.
   */
  let appliedFloor = source.length;
  /**
   * Source being rewritten as fixes apply from the end toward the start.
   */
  let result = source;
  for (const fix of fixes) {
    if (fix.end > appliedFloor) {
      continue;
    }
    result = `${result.slice(
      0,
      fix.start,
    )}${fix.insertText}${result.slice(fix.end,)}`;
    appliedFloor = fix.start;
  }
  return result;
}

/**
 * Parameters for {@link fixSource}.
 */
export type FixSourceParams = {
  /**
   * Rules to run and fix with.
   */
  readonly rules: readonly Rule[];
  /**
   * Source to lint and fix.
   */
  readonly source: string;
  /**
   * Whether the source is MDX.
   */
  readonly mdx: boolean;
};

/**
 * Result of {@link fixSource}.
 */
export type FixSourceResult = {
  /**
   * Source after the fixpoint loop settles.
   */
  readonly source: string;
  /**
   * Diagnostics that remain unfixed after fixing.
   */
  readonly diagnostics: readonly Diagnostic[];
};

/**
 * Run the fixpoint loop and return the settled source: lint, apply fixes,
 * re-parse, repeat until a pass produces no applied fix or the pass cap is
 * reached. Re-parsing each pass is what makes `--fix` idempotent (oxlint
 * behavior) rather than markdownlint's single pass.
 *
 * @param rules - rules to run and fix with
 *
 * @param source - source to lint and fix
 *
 * @param mdx - whether the source is MDX
 *
 * @returns source after the fixpoint settles
 */
function settle({
  rules,
  source,
  mdx,
}: FixSourceParams,): string {
  /**
   * Source rewritten across passes; returned once the loop settles.
   */
  let current = source;
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    /**
     * Diagnostics for the current source this pass.
     */
    const diagnostics = runRules({
      rules,
      source: current,
      mdx,
    },);
    /**
     * Source after this pass's fixes apply.
     */
    const next = applyFixes({
      source: current,
      diagnostics,
    },);
    if (next === current) {
      break;
    }
    current = next;
  }
  return current;
}

/**
 * Fix a source to its fixpoint, then lint once more so the returned diagnostics
 * are exactly what stays unfixed.
 *
 * @param rules - rules to run and fix with
 *
 * @param source - source to lint and fix
 *
 * @param mdx - whether the source is MDX
 *
 * @returns fixed source and any remaining diagnostics
 *
 * @example
 * ```ts
 * fixSource({ rules, source, mdx: false }); // { source: fixed, diagnostics: [] }
 * ```
 */
export function fixSource({
  rules,
  source,
  mdx,
}: FixSourceParams,): FixSourceResult {
  /**
   * Source after the fixpoint loop settles.
   */
  const settled = settle({
    rules,
    source,
    mdx,
  },);
  return {
    source: settled,
    diagnostics: runRules({
      rules,
      source: settled,
      mdx,
    },),
  };
}
