/**
 Original evidence closure retains complete terminal batch diagnostics without granting execution permission. @module
 */
import { JudgmentConstructionError } from './judgment-error.ts';
import type {
  JudgmentLifecycleContext,
  JudgmentEvidenceClosure
} from './judgment-lifecycle-types.ts';

//region Evidence closes once after original batch retention, dependency checks, and final budget accounting.
/**
 Bind original finalization to the same issued membership and retained closure state.

 @param input - original selection, dependency, and accounting capabilities

 @param state - retained closure outcome shared with native execution entry

 @param issuedBatches - complete original issued batch set

 @returns original evidence finalization method

 @example createJudgmentFinalization({ input, state, issuedBatches, attemptedBatches });
 */
export function createJudgmentFinalization({
  input,
  state,
  issuedBatches
}: JudgmentLifecycleContext): () => JudgmentEvidenceClosure {
  /**
   Original finalization capabilities stay lazy until the public close operation.
   */
  const {
    knownSelection,
    ready,
    active,
    bindingSegment,
    finalizeDependencies,
    readDependencyHandle,
    budget,
    parentJSON
  } = input;
  /**
   Close the original evidence group once, retaining exact failure when closure cannot complete.

   @returns frozen original evidence-only closure

   @throws JudgmentConstructionError when finalization already has an outcome
   */
  function finalize(): JudgmentEvidenceClosure {
    if (state.finished || state.closeFailed) throw new JudgmentConstructionError('Judgment already has a finalization outcome');
    try {
      for (const batch of issuedBatches) {
        if (!knownSelection()
          .inspectBatch(batch)
          .settled) knownSelection()
            .discard({
          batch,
          error: new JudgmentConstructionError('Judgment closed before this question batch was dispatched')
        });
      }
      ready();
      /**
       Complete terminal batch results retain original issuance order inside the dependency segment.
       */
      const batches = bindingSegment(function readIssuedBatchResults() {
        return Object.freeze([...issuedBatches].map(function readBatchResult(batch) { 
          return knownSelection()
            .resultFor(batch); 
        }));
      });
      /**
       Original dependency projection is retained before the final active and budget checks.
       */
      const dependencies = finalizeDependencies(readDependencyHandle());
      active();
      /**
       Original final accounting is published only after the last dependency check succeeds.
       */
      const accounting = budget.finish();
      state.finished = true;
      /**
       Frozen closure explicitly withholds policy authority and human permission.
       */
      const finalRecord = Object.freeze({
        evidenceOnly: true as const,
        status: 'evidence-closed' as const,
        policyVerdict: 'not-established' as const,
        instructionAuthority: 'not-established' as const,
        humanPermission: false as const,
        dependencies,
        accounting,
        parentJSON,
        batches
      });
      state.finalRecord = finalRecord;
      return finalRecord;
    } catch (error) {
      state.closeFailed = true;
      state.finalRecord = Object.freeze({
        retainedOnly: true as const,
        status: 'close-failed',
        failure: error,
        accounting: budget.diagnostics(),
        batches: Object.freeze([...issuedBatches].map(function inspectIssuedBatch(batch) { 
          return knownSelection()
            .inspectBatch(batch); 
        }))
      });
      throw error;
    }
  }
  return finalize;
}
//endregion
