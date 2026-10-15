/**
 Inspect current answers or retained diagnostics without reviving original claims. @module
 */
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import { QuestionSelectionError } from './selection-error.ts';
import type { SelectionBatch, SelectionClaim, SelectionOwner } from './selection-owner-types.ts';
import type { QuestionSettlementRecord } from './selection-settlement-types.ts';

/**
 Public inspection retains absent fields as own properties with undefined values.
 */
export type QuestionInspection = Readonly<{
  answerFor: (handle: unknown) => Readonly<{
    issued: boolean;
    answer: SelectionClaim['answer'];
    semanticQualification: 'not-established';
  }>;
  resultFor: (handle: unknown) => SelectionBatch['record'];
  inspectClaim: (handle: unknown) => Readonly<{ retainedOnly: true; issued: boolean; answer: SelectionClaim['answer'] }>;
  inspectBatch: (handle: unknown) => Readonly<{ retainedOnly: true; settled: boolean; record: SelectionBatch['record'] }>;
  discard: (input: Readonly<{ batch: unknown; error: unknown }>) => QuestionSettlementRecord;
}>;

//region Diagnostic retention stays distinct from current usable answers.
/**
 Bind current inspection and historical retention to original membership.
 @param owner - original membership and lifetime capabilities
 @returns current reads and retained diagnostic operations
 @example createQuestionInspection(owner);
 */
export function createQuestionInspection(owner: SelectionOwner): QuestionInspection {
  /**
   Inspect original answer state only while its binding remains current.
   @param handle - original declared claim handle
   @returns frozen current state without semantic qualification
   */
  function answerFor(handle: unknown): ReturnType<QuestionInspection['answerFor']> {
    return owner.atomic(function inspectCurrentClaim(): ReturnType<QuestionInspection['answerFor']> {
      /**
       Original membership precedes freshness and lifetime checks.
       */
      const claim = owner.knownClaim(handle);
      owner.current(claim);
      owner.budget.checkpoint();
      return Object.freeze({ issued: claim.issued, answer: claim.answer, semanticQualification: 'not-established' });
    });
  }
  /**
   Read terminal diagnostics while every original dependency remains current.
   @param handle - original issued batch handle
   @returns original terminal record
   @throws QuestionSelectionError for unterminated batches
   */
  function resultFor(handle: unknown): SelectionBatch['record'] {
    return owner.atomic(function readCurrentBatchRecord(): SelectionBatch['record'] {
      /**
       Terminal state does not itself establish currentness.
       */
      const batch = owner.knownBatch(handle);
      if (!batch.settled) throw new QuestionSelectionError('Question batch has no terminal response');
      for (const claim of batch.selected) owner.current(claim);
      owner.budget.checkpoint();
      return batch.record;
    });
  }
  /**
   Retain failed transport without reissuing or reviving any original claim.
   @param batch - original issued batch handle
   @param error - original transport or finalization failure
   @returns terminal discarded record preserving failure identity
   @throws QuestionSelectionError for already terminal batches
   */
  function discard({ batch: handle, error }: Readonly<{ batch: unknown; error: unknown }>): QuestionSettlementRecord {
    return owner.retainedOperation(function discardOriginalQuestionBatch(): QuestionSettlementRecord {
      /**
       Failure retention does not require current lifetime or dependencies.
       */
      const batch = owner.knownBatch(handle);
      if (batch.settled) throw new QuestionSelectionError('Question batch already has a terminal response');
      /**
       Every original selected claim receives its corresponding discarded marker.
       */
      const values = batch.selected.map(function createDiscardedClaimAnswer() { return Object.freeze({ status: 'discarded' as const }); });
      for (const [index, claim] of batch.selected.entries()) claim.answer = nonNullishOrThrow(values[index]);
      batch.settled = true;
      batch.record = Object.freeze({
        answers: Object.freeze(values),
        malformed: false,
        discarded: true,
        failure: error,
        semanticQualification: 'not-established',
        instructionAuthority: 'not-established',
      });
      return batch.record;
    });
  }
  /**
   Read retained claim diagnostics without checking freshness or granting permission.
   @param handle - original declared claim handle
   @returns frozen historical claim projection
   */
  function inspectClaim(handle: unknown): ReturnType<QuestionInspection['inspectClaim']> {
    return owner.retainedOperation(function inspectHistoricalClaim(): ReturnType<QuestionInspection['inspectClaim']> {
      /**
       The projection retains the answer key even before settlement.
       */
      const claim = owner.knownClaim(handle);
      return Object.freeze({ retainedOnly: true, issued: claim.issued, answer: claim.answer });
    });
  }
  /**
   Read retained batch diagnostics without making stale answers usable evidence.
   @param handle - original issued batch handle
   @returns frozen historical batch projection
   */
  function inspectBatch(handle: unknown): ReturnType<QuestionInspection['inspectBatch']> {
    return owner.retainedOperation(function inspectHistoricalBatch(): ReturnType<QuestionInspection['inspectBatch']> {
      /**
       The projection retains the record key even before settlement.
       */
      const batch = owner.knownBatch(handle);
      return Object.freeze({ retainedOnly: true, settled: batch.settled, record: batch.record });
    });
  }
  return { answerFor, resultFor, discard, inspectClaim, inspectBatch };
}
//endregion
