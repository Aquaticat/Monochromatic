/**
 Encode the original native assessment into the selected Gateway Decisions contract.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  decisionRecord,
  DecisionWireError,
  parseDecisionJson,
} from './decision-data.ts';
import { NATIVE_ASSESSMENT_MODEL, } from './decision-model.ts';

/**
 Original named question vocabulary retained for exact response attribution.
 */
export type DecisionQuestionBinding = {
  /**
   Original wire slot, never a new semantic identity.
   */
  readonly name: string;
  /**
   Original canonical question kind.
   */
  readonly type: 'choice' | 'noul';
  /**
   Every original choice, including unresolved meanings.
   */
  readonly labels: readonly string[];
};

/**
 Conversion diagnostics exclude source material.
 */
const l = tagged({ tag: 'auto-mode-decision-request', },);

/**
 Provider question limit applies to the complete original assessment.
 */
const maximumQuestions = 200;

//region Lossless conversion retains state and all named questions

/**
 Convert one original criterion to the provider's explicit option shape.

 @param entry - original label and nullable criterion description

 @returns unchanged label and supplied description

 @throws DecisionWireError for unsupported criterion data
 */
function decisionChoice(entry: [
  string,
  unknown
],): {
  readonly value: string;
  readonly description?: string
} {
  tagged({
    tag: decisionChoice.name,
    l,
  },)
    .debug('encoding original Decisions criterion',);
  /**
   Null represents an intentionally absent local description in the original wire.
   */
  const [value, description,] = entry;
  if (description === null) return { value, };
  if ((typeof description) !== 'string')
    throw new DecisionWireError('Assessment criterion description must be text or null',);
  return {
    value,
    description,
  };
}

/**
 Preserve complete native wire input in one Decisions request.
 No source text, question binding, or criterion is discarded.

 @param body - original encoded native assessment

 @returns provider request and original response binding

 @throws DecisionWireError for unsupported model, shape, or question count

 @example
 ```ts
 const encoded = encodeDecisionRequest(originalAssessmentBody);
 ```
 */
export function encodeDecisionRequest(body: string,): {
  readonly body: string;
  readonly questions: readonly DecisionQuestionBinding[];
} {
  tagged({
    tag: encodeDecisionRequest.name,
    l,
  },)
    .debug('encoding complete original Decisions assessment',);
  /**
   JSON parsing cannot execute source text retained inside the assessment.
   */
  const decoded = parseDecisionJson(body,);
  /**
   Exact root fields prevent accidental loss of new native obligations.
   */
  const request = decisionRecord(decoded,);
  if ((request.model !== NATIVE_ASSESSMENT_MODEL)
    || (Object.keys(request,)
      .toSorted()
      .join(',')
      !== 'model,questions,state'))
    throw new DecisionWireError('Assessment request differs from the fixed Luna contract',);
  /**
   Each complete native state object is serialized as exact JSON data.
   */
  const state = decisionRecord(request.state,);
  /**
   Object entries preserve the original named-question order.
   */
  const originalQuestions = Object.entries(decisionRecord(request.questions,),);
  if ((originalQuestions.length === 0) || (originalQuestions.length > maximumQuestions))
    throw new DecisionWireError('Luna assessment requires one through 200 questions without truncation',);
  /**
   Bindings retain canonical kinds while API questions use provider vocabulary.
   */
  const bindings: DecisionQuestionBinding[] = [];
  /**
   Encode each named question once without deduplication.
   */
  const questions = originalQuestions.map(function encodeQuestion([name, value,],) {
    /**
     Unknown fields are rejected instead of silently dropped.
     */
    const question = decisionRecord(value,);
    if ((name.length === 0)
      || (Object.keys(question,)
        .toSorted()
        .join(',')
        !== 'criteria,instructions,type'))
      throw new DecisionWireError('Assessment question differs from the original named shape',);
    if (question.type === 'noul') {
      bindings.push({
        name,
        type: 'noul',
        labels: [],
      },);
      return {
        type: 'predicate',
        name,
        instructions: JSON.stringify({
          instructions: question.instructions,
          criteria: question.criteria,
        },),
      };
    }
    if (question.type !== 'choice')
      throw new DecisionWireError('Assessment question type is unsupported by the native Luna adapter',);
    /**
     Original criteria remain complete even when their descriptions are null.
     */
    const choices = Object.entries(decisionRecord(question.criteria,),)
      .map(decisionChoice,);
    if ((choices.length < 2) || (choices.length > 255))
      throw new DecisionWireError('Luna choice requires two through 255 original criteria',);
    bindings.push({
      name,
      type: 'choice',
      labels: choices.map(function choiceLabel(choice,) {
        return choice.value;
      },),
    },);
    return {
      type: 'choice',
      name,
      instructions: JSON.stringify(question.instructions,),
      choices,
    };
  },);
  return {
    body: JSON.stringify({
      model: NATIVE_ASSESSMENT_MODEL,
      input: JSON.stringify(state,),
      questions,
    },),
    questions: bindings,
  };
}

//endregion Lossless conversion retains state and all named questions
