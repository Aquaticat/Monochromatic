/**
 Original judgment lifecycle composes one operation guard, issued batch custody, and terminal evidence closure. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { JudgmentConstructionError } from './judgment-error.ts';
import { createJudgmentEvidence } from './judgment-evidence.ts';
import { createJudgmentAssessment } from './judgment-assessment.ts';
import { createJudgmentFinalization } from './judgment-finalization.ts';
import type {
  JudgmentLifecycleInput,
  JudgmentLifecycleState,
  JudgmentLifecycle
} from './judgment-lifecycle-types.ts';

/**
 Lifecycle diagnostics omit original request content, question text, and model answers.
 */
const l = tagged({ tag: 'auto-mode-judgment-lifecycle' });

//region Original judgment lifetime shares one operation exclusion and one batch ownership set.
/**
 Allocate original lifecycle ownership without invoking lazy selection or dependency readers.

 @param input - original judgment capabilities captured during construction

 @returns original operation, evidence, assessment, and finalization methods

 @example createJudgmentLifecycle(input);
 */
export function createJudgmentLifecycle(input: JudgmentLifecycleInput): JudgmentLifecycle {
  /**
   Constructor diagnostics do not inspect live source or original assessment content.
   */
  const rl = tagged({
    tag: createJudgmentLifecycle.name,
    l
  });
  rl.debug('binding original judgment lifecycle');
  /**
   Private phase flags preserve original operation and closure outcomes.
   */
  const state: JudgmentLifecycleState = {
    operating: false,
    assessing: false,
    finished: false,
    closeFailed: false
  };
  /**
   Original issuance custody remains distinct from attempted assessment membership.
   */
  const issuedBatches = new Set<object>();
  /**
   Once-only reservations cannot be replenished by a failed transport or stale dependency.
   */
  const attemptedBatches = new WeakSet<object>();
  /**
   All lifecycle operations share exactly the same original membership and mutable phase state.
   */
  const context = {
    input,
    state,
    issuedBatches,
    attemptedBatches
  };
  /**
   Exclude synchronous callback reentry and overlap with an asynchronous original assessment.

   @param run - original synchronous public operation

   @returns original operation result

   @throws JudgmentConstructionError when this judgment already has an active operation
   */
  function operation<Result>(run: () => Result): Result {
    if (state.operating) throw new JudgmentConstructionError('Judgment operations cannot reenter through callbacks');
    state.operating = true;
    /**
     The same guard is released on normal return and on every thrown failure.
     */
    using activity = { [Symbol.dispose](): void { 
      state.operating = false; 
    } };
    return run();
  }
  return {
    state,
    operation,
    ...createJudgmentEvidence(context),
    ...createJudgmentAssessment(context),
    finalize: createJudgmentFinalization(context)
  };
}
//endregion
