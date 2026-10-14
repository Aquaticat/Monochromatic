/**
 Attribute each provider answer to its original native question without altering scores.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { decisionProbability, decisionRecord, DecisionWireError, parseDecisionJson, } from './decision-data.ts';
import { NATIVE_ASSESSMENT_MODEL, } from './decision-model.ts';
import type { DecisionQuestionBinding, } from './decision-request.ts';

/**
 Response validation never logs provider data.
 */
const l = tagged({ tag: 'auto-mode-decision-response', },);

//region Original answer identities and numeric values survive provider conversion

/**
 Retain a complete categorical distribution with its independent confidence metadata.

 @param answer - decoded provider answer

 @param binding - original exact choice vocabulary

 @returns canonical answer without score adjustment

 @throws DecisionWireError for malformed or incomplete distributions
 */
function categoricalAnswer({ answer, binding, }: {
  readonly answer: Readonly<Record<string, unknown>>;
  readonly binding: DecisionQuestionBinding;
},): Readonly<Record<string, unknown>> {
  tagged({ tag: categoricalAnswer.name, l, },).debug('validating complete Decisions distribution',);
  if ((answer.type !== 'choice') || (!Array.isArray(answer.probabilities,))
    || (answer.probabilities.length !== binding.labels.length)
    || ((typeof answer.choice) !== 'string') || (!binding.labels.includes(answer.choice,)))
    throw new DecisionWireError('Luna categorical answer differs from its original question',);
  /**
   Distinct labels remain distinct even when they resemble JavaScript property names.
   */
  const pairs = answer.probabilities.map(function probabilityEntry(value: unknown,): [string, number] {
    /**
     No provider score can introduce an additional label.
     */
    const entry = decisionRecord(value,);
    if (((typeof entry.value) !== 'string') || (!binding.labels.includes(entry.value,)))
      throw new DecisionWireError('Luna probability label differs from its original vocabulary',);
    return [entry.value, decisionProbability(entry.probability,),];
  },);
  if (new Set(pairs.map(function entryLabel([label,],) { return label; },),).size !== binding.labels.length)
    throw new DecisionWireError('Luna distribution repeats or omits an original label',);
  /**
   Match the existing canonical decoder tolerance without renormalizing model output.
   */
  const total = pairs.reduce(function sumScores(sum, [, score,],) { return sum + score; }, 0,);
  if (Math.abs(total - 1,) > 0.000001)
    throw new DecisionWireError('Luna distribution is not normalized within the original tolerance',);
  return {
    type: 'choice',
    choice: answer.choice,
    probabilities: Object.fromEntries(pairs,),
    confidence: decisionProbability(answer.confidence,),
  };
}

/**
 Decode only a complete response from the selected serving model.
 Refusals and identity mismatches never become estimates.

 @param raw - complete provider response

 @param questions - original request's named question bindings

 @returns canonical answer map for the original judgment decoder

 @throws DecisionWireError for an unattributed, refused, or malformed response
 */
export function decodeDecisionResponse({ raw, questions, }: {
  readonly raw: string;
  readonly questions: readonly DecisionQuestionBinding[];
},): string {
  tagged({ tag: decodeDecisionResponse.name, l, },).debug('attributing complete Decisions response',);
  /**
   Parsing and field access are separate validation boundaries.
   */
  const decoded = parseDecisionJson(raw,);
  /**
   Returned identity is mandatory even when the request fixed a provider prefix.
   */
  const response = decisionRecord(decoded,);
  if ((response.model !== NATIVE_ASSESSMENT_MODEL) || (!Array.isArray(response.answers,))
    || (response.answers.length !== questions.length))
    throw new DecisionWireError('Luna response model or complete answer count differs from its request',);
  /**
   Every answer occupies its original position and echoes its exact name.
   */
  const answers = response.answers.map(function originalAnswer(value: unknown, index: number,): [string, unknown] {
    /**
     Validate provider data before reading any estimate.
     */
    const answer = decisionRecord(value,);
    /**
     Array length equality alone does not establish answer identity.
     */
    const binding = questions[index];
    if ((binding === undefined) || (answer.name !== binding.name))
      throw new DecisionWireError('Luna answer identity or order differs from its original question',);
    if (answer.type === 'refusal')
      throw new DecisionWireError('Luna refused an original assessment question; no complete assessment was admitted',);
    if (binding.type === 'choice') return [binding.name, categoricalAnswer({ answer, binding, },),];
    if (answer.type !== 'predicate')
      throw new DecisionWireError('Luna predicate answer has an unsupported type',);
    return [binding.name, { type: 'noul', noul: decisionProbability(answer.probability,), },];
  },);
  /**
   Usage is retained without interpreting it as evidence or admission.
   */
  const usage = decisionRecord(response.usage,);
  for (const count of [usage.input_tokens, usage.output_tokens,]) {
    if (((typeof count) !== 'number') || (!Number.isSafeInteger(count,)) || (count < 0))
      throw new DecisionWireError('Luna response usage requires nonnegative safe integer counts',);
  }
  return JSON.stringify({ model: response.model, answers: Object.fromEntries(answers,), usage, },);
}

//endregion Original answer identities and values
