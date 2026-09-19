import type { ChunkPair, } from './chunk-document.ts';
import {
  introducedFootnoteFindings,
  introducedStructuralRegressions,
} from './assembly-regressions.ts';
import {
  type SliceReplacement,
  spliceSlices,
} from './splice-slices.ts';
import { strictRefusalOffset, } from './strict-refusal-offset.ts';

//region Structural withdrawal proof
// Before blanket withdrawal, test whether reverting one replacement repairs the
// actual whole document. This preserves unrelated insertions without changing
// the author's right to defend a candidate against per-slice findings.

/**
 Finds a single withdrawal that leaves no introduced structural or footnote defect.
 
 Tries replacements in their supplied document order and keeps the first proven
 repair. Each trial reparses an actual splice, not an isolated slice that may
 own only one half of a valid container. No trial result changes caller state.
 
 @param targetText - inherited document defining permissible existing defects
 
 @param slices - prepared locations for every replacement
 
 @param replacements - current assembly, before any speculative withdrawal
 
 @returns One proven slice index, or none when blanket fallback remains necessary
 
 @example
 ```ts
 const proven = singleStructuralWithdrawal({ targetText, slices, replacements, });
 ```
 */
export function singleStructuralWithdrawal(
  {
    targetText,
    slices,
    replacements,
  }: {
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
    /**
     Counterfactual set retains every other accepted wording.
     */
    const remaining = replacements.filter(function other(candidate,): boolean {
      return candidate.sliceIndex !== replacement.sliceIndex;
    },);
    /**
     Whole page produced by this one withdrawal, including all slice joins.
     */
    const assembledText = spliceSlices({
      targetText,
      slices,
      replacements: remaining,
    },);
    if (introducedStructuralRegressions({
      incumbentText: targetText,
      assembledText,
    },)
      .length
      > 0)
      continue;
    // Restoring grammar can expose a footnote hidden by the malformed component.
    // It is not a proven repair until that graph also matches the inherited one.
    if (introducedFootnoteFindings({
      incumbentText: targetText,
      assembledText,
    },)
      .length
      > 0)
      continue;
    return [replacement.sliceIndex,];
  }
  return [];
}

/**
 One withdrawal that moves the first strict-grammar refusal later.

 @example
 ```ts
 const step: AdvancingWithdrawal = { sliceIndex: 4, from: 120, to: 980, };
 ```
 */
export type AdvancingWithdrawal = {
  /**
   Slice whose replacement is withdrawn.
   */
  readonly sliceIndex: number;

  /**
   Offset of the first refusal before the withdrawal.
   */
  readonly from: number;

  /**
   Offset of the first refusal after it, later than `from`.
   */
  readonly to: number;
};

/**
 Finds the withdrawal that moves the first strict-grammar refusal furthest
 later, when no single withdrawal repairs the page (class fifty-eight).

 The parser names where it stopped; a withdrawal after which it stops later
 removed the break it named, and the guard's next round reads what is left.
 Nothing is chosen when the page parses already or when no withdrawal moves
 the refusal.

 @param targetText - inherited document the replacements are spliced over

 @param slices - prepared locations for every replacement

 @param replacements - current assembly, before any speculative withdrawal

 @returns Withdrawal that advances the refusal furthest, at most one, or none

 @example
 ```ts
 const [step,] = advancingStructuralWithdrawal({ targetText, slices, replacements, },);
 ```
 */
export function advancingStructuralWithdrawal(
  {
    targetText,
    slices,
    replacements,
  }: {
    readonly targetText: string;
    readonly slices: readonly ChunkPair[];
    readonly replacements: readonly SliceReplacement[];
  },
): readonly AdvancingWithdrawal[] {
  /**
   What the grammar makes of the page as it stands.
   */
  const standing = strictRefusalOffset({
    text: spliceSlices({
      targetText,
      slices,
      replacements,
    },),
  },);
  if (!standing.refused)
    return [];
  /**
   Where the grammar stops before any withdrawal.
   */
  const from = standing.offset;
  /**
   Every withdrawal that moves the refusal later.
   */
  const advancing = replacements.flatMap(function advances(replacement,): readonly AdvancingWithdrawal[] {
    /**
     Page with this one replacement withdrawn.
     */
    const withdrawnText = spliceSlices({
      targetText,
      slices,
      replacements: replacements.filter(function other(candidate,): boolean {
        return candidate.sliceIndex !== replacement.sliceIndex;
      },),
    },);
    /**
     What the grammar makes of it then.
     */
    const reading = strictRefusalOffset({ text: withdrawnText, },);
    /**
     Where it stops then; the page's end when it no longer stops.
     */
    const to = reading.refused
      ? reading.offset
      : withdrawnText.length;
    if (to <= from)
      return [];
    return [{
      sliceIndex: replacement.sliceIndex,
      from,
      to,
    },];
  },);
  /**
   First candidate, absent when nothing advances the refusal.
   */
  const [first, ...rest] = advancing;
  if (first === undefined)
    return [];
  /**
   Candidate that moves the refusal furthest.
   */
  const furthest = rest.reduce(
    function later(
      best: AdvancingWithdrawal,
      candidate: AdvancingWithdrawal,
    ): AdvancingWithdrawal {
      return (candidate.to > best.to) ? candidate : best;
    },
    first,
  );
  return [furthest,];
}

//endregion Structural withdrawal proof
