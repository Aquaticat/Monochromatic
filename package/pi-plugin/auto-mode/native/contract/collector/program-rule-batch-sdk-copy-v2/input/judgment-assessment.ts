/**
 Original assessment preserves once-only batch attempts and exact failure retention under one operation guard. @module
 */
import { readAssessmentResponse } from '../../../lifecycle/claim-evidence-batch-selection/selection-values.ts';
import { JudgmentConstructionError } from './judgment-error.ts';
import type {
  JudgmentLifecycleContext,
  JudgmentAssessmentOperations
} from './judgment-lifecycle-types.ts';

/**
 Retain both original failures as ordered peers without introducing a single-cause projection.

 @param error - original assessment failure

 @param retentionError - subsequent terminal-retention failure

 @returns original aggregate shape with both failures and no cause property
 */
function createAssessmentRetentionError({
  error,
  retentionError
}: Readonly<{
  error: unknown;
  retentionError: unknown;
}>): AggregateError {
  return new AggregateError(
    [
      error,
      retentionError
    ],
    'Assessment failure and terminal retention failure'
  );
}

//region Issuance precedes original transport attempts and terminal answer retention.
/**
 Bind original assessment to fixed selection, dependency, and shared transport lifetime capabilities.

 @param input - original lazy selection and budget callbacks

 @param state - shared synchronous and asynchronous operation flags

 @param issuedBatches - original batch membership owned by this judgment

 @param attemptedBatches - original once-only assessment reservations

 @returns original issuance and asynchronous assessment methods

 @example createJudgmentAssessment({ input, state, issuedBatches, attemptedBatches });
 */
export function createJudgmentAssessment({
  input,
  state,
  issuedBatches,
  attemptedBatches
}: JudgmentLifecycleContext): JudgmentAssessmentOperations {
  /**
   Captured callbacks retain original selection, currentness, and transport invocation order.
   */
  const {
    knownSelection,
    ready,
    bindingSegment,
    budget,
    send
  } = input;
  /**
   Publish judgment batch membership only after original selection issuance succeeds.

   @param claims - complete original selected claim handles

   @returns original issued batch handle
   */
  function issue(claims: Parameters<JudgmentAssessmentOperations['issue']>[0]): ReturnType<JudgmentAssessmentOperations['issue']> {
    ready();
    /**
     Original selection owns the issued batch before judgment membership is published.
     */
    const batch = knownSelection()
      .issue(claims);
    issuedBatches.add(batch);
    return batch;
  }
  /**
   Assess an original issued batch once while excluding overlapping judgment operations.

   @param batch - original judgment-issued batch occurrence

   @returns original terminal settlement record

   @throws JudgmentConstructionError for overlap, foreign membership, or a repeated attempt

   @throws AggregateError when assessment and original failure retention both fail
   */
  async function assess(batch: object): Promise<Awaited<ReturnType<JudgmentAssessmentOperations['assess']>>> {
    if (state.operating) throw new JudgmentConstructionError('Judgment operations cannot overlap or reenter');
    state.operating = true;
    /**
     Original operation exclusion is released on every successful and failed exit.
     */
    using activity = { [Symbol.dispose](): void { 
      state.operating = false; 
    } };
    if (!issuedBatches.has(batch)) throw new JudgmentConstructionError('Question batch is not owned by this judgment');
    if (attemptedBatches.has(batch)) throw new JudgmentConstructionError('Question batch cannot be assessed concurrently or sampled again');
    attemptedBatches.add(batch);
    state.assessing = true;
    /**
     Original assessment phase ends independently of transport success or retained failure.
     */
    using assessment = { [Symbol.dispose](): void { 
      state.assessing = false; 
    } };
    try {
      /**
       Dependency checks surround the original selection request lookup.
       */
      const request = bindingSegment(function readBatchRequest() { 
        return knownSelection()
          .requestFor(batch); 
      });
      /**
       The original budget supplies exact attempt, cancellation, and deadline fields to transport.
       */
      const answer = await budget.dispatch(function sendAssessmentAttempt(attempt) {
        return send(Object.freeze({
          request,
          ...attempt
        }));
      });
      return bindingSegment(function settleAssessmentAnswer() {
        return knownSelection()
          .settle({
            batch,
            ...readAssessmentResponse(answer)
          });
      });
    } catch (error) {
      try {
        if (!knownSelection()
          .inspectBatch(batch)
          .settled) knownSelection()
            .discard({
              batch,
              error
            });
      } catch (retentionError) {
        throw createAssessmentRetentionError({
          error,
          retentionError
        });
      }
      throw error;
    }
  }
  return {
    issue,
    assess
  };
}
//endregion
