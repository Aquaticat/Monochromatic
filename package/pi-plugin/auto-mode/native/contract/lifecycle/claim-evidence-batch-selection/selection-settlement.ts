/**
 Retain terminal original answers or their malformed and discarded diagnostics. @module
 */
import { Buffer } from 'node:buffer';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import { QuestionSelectionError } from './selection-error.ts';
import { decodeQuestionAnswers } from './selection-answer-decoding.ts';
import type {
  QuestionSettlementInput,
  QuestionSettlementOwner,
  QuestionSettlementRecord,
  SettlementClaim,
} from './selection-settlement-types.ts';

/**
 Settlement diagnostics identify lifecycle decisions without exposing answer data.
 */
const l = tagged({ tag: 'auto-mode-question-settlement' });

/** Retained answer text uses the existing UTF-8 response bound. */
const ANSWER_MAX_BYTES = 65_536;

//region Only the selection owner can authenticate and settle original batches.

/**
 Bind original batch membership, reentry protection, and judgment lifetime.

 @param knownBatch - original selection owner authenticates the supplied handle

 @param retainedOperation - incumbent synchronous owner prevents reentry

 @param budget - enclosing judgment checks lifetime before and after decoding

 @param current - original binding reader prevents silently reusing changed claims

 @returns settlement operation retaining original terminal diagnostics

 @example
 ```ts
 const settle = createQuestionSettlement({ knownBatch, retainedOperation, budget, current });
 ```
 */
export function createQuestionSettlement<const Claim extends SettlementClaim>({
  knownBatch,
  retainedOperation,
  budget,
  current,
}: QuestionSettlementOwner<Claim>): (input: QuestionSettlementInput) => QuestionSettlementRecord {
  /**
   Each bound owner keeps a separate function diagnostic scope.
   */
  const sl = tagged({
    tag: createQuestionSettlement.name,
    l
  });
  sl.debug('binding original question settlement owner');
  /**
   Retain the complete response only while its original judgment remains current.

   @param batch - opaque original issued batch handle

   @param answerText - untrusted raw response text

   @param model - optional original serving-model attribution

   @returns original terminal batch record

   @throws QuestionSelectionError for unknown or already terminal batches

   @throws original binding or budget failure after retaining discarded diagnostics
   */
  function settle({
    batch: handle,
    answerText,
    model
  }: QuestionSettlementInput): QuestionSettlementRecord {
    return retainedOperation(function settleOriginalQuestionBatch(): QuestionSettlementRecord {
      /**
       Nested diagnostics retain this original settlement occurrence's scope.
       */
      const rl = tagged({
        tag: settleOriginalQuestionBatch.name,
        l: sl
      });
      rl.debug('settling original question batch');
      /**
       The original owner rejects foreign handles before touching any claims.
       */
      const batch = knownBatch(handle);
      if (batch.settled) throw new QuestionSelectionError('Question batch already has a terminal response');
      /**
       Oversized and non-string responses never enter retained raw diagnostics.
       */
      const retainedRaw = ((typeof answerText) === 'string') && (Buffer.byteLength(answerText) <= ANSWER_MAX_BYTES)
        ? answerText : undefined;
      try {
        budget.checkpoint();
        for (const claim of batch.selected) current(claim);
        /**
         Decode all answers before updating original claims.
         */
        const response = decodeQuestionAnswers({
          selected: batch.selected,
          ...(retainedRaw === undefined ? {} : { raw: retainedRaw }),
          model
        });
        budget.checkpoint();
        for (const [index, claim] of batch.selected
          .entries()) {
          claim.answer = nonNullishOrThrow(response.values[index]);
          if ((response.failure === undefined) && ((typeof model) === 'string')) claim.model = model;
        }
        batch.settled = true;
        batch.record = Object.freeze({
          answers: Object.freeze(response.values),
          ...(retainedRaw === undefined ? {} : { raw: retainedRaw }),
          malformed: response.failure !== undefined,
          discarded: false,
          failure: response.failure,
          ...((response.failure === undefined) && ((typeof model) === 'string') ? { model } : {}),
          semanticQualification: 'not-established',
          instructionAuthority: 'not-established',
        });
        rl.debug('retained terminal question response');
        return batch.record;
      } catch (error) {
        /**
         Failure retires every selected answer without making partial estimates usable.
         */
        const values = batch.selected
          .map(function createDiscardedAnswer() { return Object.freeze({ status: 'discarded' as const }); });
        for (const [index, claim] of batch.selected
          .entries()) claim.answer = nonNullishOrThrow(values[index]);
        batch.settled = true;
        batch.record = Object.freeze({
          answers: Object.freeze(values),
          ...(retainedRaw === undefined ? {} : { raw: retainedRaw }),
          malformed: false,
          discarded: true,
          failure: error,
          semanticQualification: 'not-established',
          instructionAuthority: 'not-established',
        });
        rl.debug('retained discarded question response before rethrowing original failure');
        throw error;
      }
    });
  }
  return settle;
}

//endregion
