import type { AlignmentStep, } from './align-blocks-walk.ts';
import type { BlockPair, } from './pair-blocks-wire.ts';

//region Block pairing steps
// TRANSLATES A ROSTER'S PAIRING INTO THE VOCABULARY THE GROUPER ALREADY READS,
// so nothing downstream of alignment learns that a model was involved.
//
// The step vocabulary is `paired`, `source-only` and `target-only`, one block
// per step. A pairing may name ONE original rendered by SEVERAL translation
// blocks, which is the correspondence the deterministic walk could not express
// and the whole reason for asking a model. It is carried here as the first
// correspondence `paired` and the rest `target-only`, which puts them in the
// same run as long as the budget holds, exactly as a skipped block already is.
//
// EVERY BLOCK APPEARS EXACTLY ONCE, on the side it belongs to, because the
// grouper measures characters per step and a block counted twice would inflate
// a run past its budget and cut the document somewhere it should not.

/**
 * Converts a pairing into monotone alignment steps covering both sides.
 *
 * @param pairs - correspondences the roster agreed on, in document order
 *
 * @param sourceCount - original blocks
 *
 * @param targetCount - translation blocks
 *
 * @returns Steps in document order, each block appearing exactly once
 *
 * @example
 * ```ts
 * const steps = blockPairingToSteps({ pairs, sourceCount: 12, targetCount: 16, },);
 * ```
 */
export function blockPairingToSteps(
  {
    pairs,
    sourceCount,
    targetCount,
  }: {
    readonly pairs: readonly BlockPair[];
    readonly sourceCount: number;
    readonly targetCount: number;
  },
): readonly AlignmentStep[] {
  /**
   * Translation blocks each original is paired with, in document order.
   */
  const targetsBySource = new Map<number, number[]>();
  for (const pair of pairs) {
    /**
     * Targets recorded for this original so far.
     */
    const already = targetsBySource.get(pair.source,) ?? [];
    already.push(pair.target,);
    targetsBySource.set(
      pair.source,
      already,
    );
  }

  /**
   * Translation blocks some original claims.
   */
  const claimedTargets = new Set(pairs.map(function toTarget(pair,): number {
    return pair.target;
  },),);

  /**
   * Steps in document order.
   */
  const steps: AlignmentStep[] = [];

  /**
   * Translation blocks already emitted, so unpaired ones land in order.
   */
  let emittedTargets = 0;

  /**
   * Emits every unclaimed translation block strictly before a boundary.
   *
   * @param before - first translation index NOT to emit
   *
   * @example
   * ```ts
   * emitUnclaimedTargetsBefore(3,);
   * ```
   */
  function emitUnclaimedTargetsBefore(before: number,): void {
    while (emittedTargets < before) {
      if (!claimedTargets.has(emittedTargets,))
        steps.push({
          kind: 'target-only',
          targetIndex: emittedTargets,
        },);
      emittedTargets += 1;
    }
  }

  for (let source = 0; source < sourceCount; source += 1) {
    /**
     * Translation blocks this original renders as, in order.
     */
    const targets = [ ...(targetsBySource.get(source,) ?? []), ]
      .toSorted(function ascending(
        left,
        right,
      ): number {
        return left - right;
      },);
    if (targets.length === 0) {
      steps.push({
        kind: 'source-only',
        sourceIndex: source,
      },);
      continue;
    }
    for (const [at, target,] of targets.entries()) {
      emitUnclaimedTargetsBefore(target,);
      steps.push((at === 0)
        ? {
          kind: 'paired',
          sourceIndex: source,
          targetIndex: target,
        }
        : {
          // THE SECOND AND LATER RENDERINGS of one original. They carry their
          // own text and must not re-count the original's characters, and they
          // must not be cut away from the original they render.
          kind: 'target-only',
          targetIndex: target,
          continuesPairing: true,
        },);
      emittedTargets = target + 1;
    }
  }
  emitUnclaimedTargetsBefore(targetCount,);
  return steps;
}

//endregion Block pairing steps
