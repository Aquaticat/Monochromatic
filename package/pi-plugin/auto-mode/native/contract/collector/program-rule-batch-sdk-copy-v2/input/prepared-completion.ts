/**
 Original prepared completion gives retained lifecycle failures precedence over native rejection. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import type { PreparedCompletion, PreparedCompletionInput } from './prepared-completion-types.ts';

/**
 Completion diagnostics omit native values, decisions, and opaque failures.
 */
const l = tagged({ tag: 'auto-mode-prepared-completion' });

//region Report original failure precedence before exposing the frozen completion envelope.
/**
 Complete original prepared dispatch after every issued native member settles.

 @param batchState - original admission owner whose decision reads retain their ordering

 @param failures - original retained lifecycle failures in publication order

 @param settled - original native settlements in declaration order

 @param snapshots - original complete-group assessment snapshots

 @param PreparedBatchContractError - original dispatcher contract error constructor

 @param PreparedBatchExecutionError - original dispatcher lifecycle error constructor

 @returns original decision, assessment count, first snapshot, and fulfilled native values

 @throws Error for absent admission, retained lifecycle failures, or unhandled native rejections

 @example completePreparedBatch({ batchState, failures, settled, snapshots, PreparedBatchContractError, PreparedBatchExecutionError });
 */
export function completePreparedBatch({
  batchState,
  failures,
  settled,
  snapshots,
  PreparedBatchContractError,
  PreparedBatchExecutionError,
}: PreparedCompletionInput): PreparedCompletion {
  /**
   Completion tracing keeps the original dispatcher boundary without reading payloads.
   */
  const cl = tagged({ tag: completePreparedBatch.name, l });
  cl.debug('reporting original prepared group completion');
  if (batchState.decision === undefined) throw new PreparedBatchContractError('Prepared batch completed without admission outcome');
  if (failures.length > 0) throw new PreparedBatchExecutionError(
    'Prepared batch retained lifecycle failures',
    { failures, outcomes: settled, assessmentDecision: batchState.decision }
  );
  /**
   Native rejections are considered only after retained lifecycle failures have been ruled out.
   */
  const rejected = settled.filter(function isRejectedResult(result) {
    return result.status === 'rejected';
  });
  if (rejected.length > 0) throw new PreparedBatchExecutionError(
    'Prepared batch has unhandled native outcomes',
    {
      failures: rejected.map(function readRejection(result) {
        return result.reason;
      }),
      outcomes: settled,
      assessmentDecision: batchState.decision,
    }
  );
  cl.debug('returning original fulfilled prepared group');
  return Object.freeze({
    decision: batchState.decision,
    assessmentCount: snapshots.length,
    members: snapshots[0] ?? Object.freeze([]),
    outcomes: Object.freeze(settled.map(function readCompletedValue(result) {
      return result.value;
    })),
  });
}
//endregion
