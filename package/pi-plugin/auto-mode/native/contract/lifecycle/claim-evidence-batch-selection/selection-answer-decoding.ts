/**
 Admit complete answer membership before any original claim receives a result. @module
 */
import { Buffer } from 'node:buffer';
import { QuestionSelectionError } from './selection-error.ts';
import {
  object,
  text,
  readRelationEstimate
} from './selection-values.ts';
import type {
  DecodedQuestionAnswers,
  QuestionAnswer,
  SettlementClaim,
} from './selection-settlement-types.ts';
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { caughtValueText } from '@monochromatic-dev/module-caught-value/ts';

/**
 Decode diagnostics retain the original failure without replacing its identity.
 */
const l = tagged({ tag: 'auto-mode-question-answer-decoding' });

/**
 Model attribution uses the existing bounded UTF-8 wire profile.
 */
const MODEL_MAX_BYTES = 256;

//region A malformed member makes the complete response unusable.

/**
 Decode the response within its original selected membership.

 @param selected - original claims supply their pinned relation definitions

 @param raw - bounded transport text retained before decoding

 @param model - untrusted serving-model attribution

 @returns admitted answers or original failure with malformed markers for every claim

 @example
 ```ts
 const decoded = decodeQuestionAnswers({ selected, raw: answerText, model: servingModel });
 ```
 */
export function decodeQuestionAnswers({
  selected,
  raw,
  model,
}: {
  readonly selected: readonly SettlementClaim[];
  readonly raw?: string;
  readonly model: unknown;
}): DecodedQuestionAnswers {
  /**
   Diagnostics retain the decoding boundary without serializing borrowed values.
   */
  const dl = tagged({
    tag: decodeQuestionAnswers.name,
    l
  });
  dl.debug('decoding complete original question response');
  try {
    if ((model !== undefined) && ((!text(model)) || (Buffer.byteLength(model) > MODEL_MAX_BYTES)))
      throw new QuestionSelectionError('Assessment model attribution is malformed');
    if ((raw === undefined) || (!raw.isWellFormed()))
      throw new QuestionSelectionError('Answer text exceeds the declared JSON response profile');
    /**
     JSON values remain unknown until membership and every answer shape are checked.
     */
    const answers: unknown = JSON.parse(raw);
    if ((!Array.isArray(answers)) || (answers.length !== selected.length))
      throw new QuestionSelectionError('Answer membership differs from the issued question batch');
    /**
     Mapping original claims keeps each pinned definition paired with its exact answer slot.
     */
    const values = selected.map(function validateOriginalAnswer(
      claim,
      index
    ): QuestionAnswer {
      /**
       The parsed array supplies untrusted values without widening the retained claim type.
       */
      const answer: unknown = answers[index];
      if ((!object(answer)) || Array.isArray(answer)
        || (answer.id !== `q${index}`))
        throw new QuestionSelectionError('Answer identity differs from the issued question');
      if ((answer.status === 'estimate') && (Object.keys(answer)
        .toSorted()
        .join(',')
        === 'id,status,value'))
        return Object.freeze({
          status: 'estimate',
          value: readRelationEstimate({
            definition: claim.definition,
            value: answer.value
          })
        });
      if ((answer.status === 'unresolved') && (Object.keys(answer)
        .toSorted()
        .join(',')
        === 'id,reason,status')
        && text(answer.reason)) return Object.freeze({
          status: 'unresolved',
          reason: answer.reason
        });
      throw new QuestionSelectionError('Answer is neither a bounded estimate nor an explicit unresolved result');
    });
    return {
      failure: undefined,
      values
    };
  } catch (error) {
    dl.debug(`retaining original response decoding failure: ${caughtValueText(error)}`);
    return {
      failure: error,
      values: selected.map(function createMalformedAnswer() { return Object.freeze({ status: 'malformed' }); }),
    };
  }
}

//endregion
