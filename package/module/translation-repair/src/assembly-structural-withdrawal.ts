import type { ChunkPair, } from './chunk-document.ts';
import {
  introducedFootnoteFindings,
  introducedStructuralRegressions,
} from './assembly-regressions.ts';
import { type SliceReplacement, spliceSlices, } from './splice-slices.ts';

//region Structural withdrawal proof
// Before blanket withdrawal, test whether reverting one replacement repairs the
// actual whole document. This preserves unrelated insertions without changing
// the author's right to defend a candidate against per-slice findings.

/**
 * Finds a single withdrawal that leaves no introduced structural or footnote defect.
 *
 * Tries replacements in their supplied document order and keeps the first proven
 * repair. Each trial reparses an actual splice, not an isolated slice that may
 * own only one half of a valid container. No trial result changes caller state.
 *
 * @param targetText - inherited document defining permissible existing defects
 *
 * @param slices - prepared locations for every replacement
 *
 * @param replacements - current assembly, before any speculative withdrawal
 *
 * @returns One proven slice index, or none when blanket fallback remains necessary
 *
 * @example
 * ```ts
 * const proven = singleStructuralWithdrawal({ targetText, slices, replacements, });
 * ```
 */
export function singleStructuralWithdrawal(
  { targetText, slices, replacements, }: {
    readonly targetText: string;
    readonly slices: readonly ChunkPair[];
    readonly replacements: readonly SliceReplacement[];
  },
): readonly number[] {
  // A sole replacement has no sibling to preserve; the ordinary fallback already
  // produces exactly that result and retains its existing diagnostic.
  if (replacements.length < 2)
    return [];
  for (const replacement of replacements) {
    /** Counterfactual set retains every other accepted wording. */
    const remaining = replacements.filter(function other(candidate,): boolean {
      return candidate.sliceIndex !== replacement.sliceIndex;
    },);
    /** Whole page produced by this one withdrawal, including all slice joins. */
    const assembledText = spliceSlices({ targetText, slices, replacements: remaining, },);
    if (introducedStructuralRegressions({ incumbentText: targetText, assembledText, },).length > 0)
      continue;
    // Restoring grammar can expose a footnote hidden by the malformed component.
    // It is not a proven repair until that graph also matches the inherited one.
    if (introducedFootnoteFindings({ incumbentText: targetText, assembledText, },).length > 0)
      continue;
    return [replacement.sliceIndex,];
  }
  return [];
}

//endregion Structural withdrawal proof
