import assert from 'node:assert/strict';
import { parseBatchAnswer as parseNoul } from '../drex-1.5-recheck/batch-cost-protocol.mjs';
export { summarizeBatch } from '../drex-1.5-recheck/batch-cost-protocol.mjs';

//region Preserve valid billing independently from semantic-answer validation.
export function parseUsage({ raw, model }) {
  const value = JSON.parse(raw);
  assert.equal(value.model, model);
  const { usage } = value;
  assert(Number.isSafeInteger(usage?.input_tokens) && usage.input_tokens >= 0);
  assert(Number.isSafeInteger(usage.input_tokens * 50));
  assert(Number.isSafeInteger(usage?.output_tokens) && usage.output_tokens >= 0);
  return { input_tokens: usage.input_tokens, output_tokens: usage.output_tokens };
}
//endregion

//region Validate the mixed answer map before projecting binary estimates to the existing parser.
export function parseBatchAnswer({ raw, plan }) {
  const value = JSON.parse(raw);
  assert(value.answers && typeof value.answers === 'object' && !Array.isArray(value.answers));
  assert.deepEqual(Object.keys(value.answers).sort(), Object.keys(plan.questions).sort());
  assert.equal(plan.questions.invocationSource.type, 'choice');
  const { invocationSource, ...binaryAnswers } = value.answers;
  assert(invocationSource && typeof invocationSource === 'object' && !Array.isArray(invocationSource));
  assert.equal(invocationSource.type, 'choice');
  const labels = Object.keys(plan.questions.invocationSource.criteria);
  assert(labels.includes(invocationSource.choice));
  assert(typeof invocationSource.confidence === 'number' && Number.isFinite(invocationSource.confidence));
  assert(invocationSource.confidence >= 0 && invocationSource.confidence <= 1);
  const probabilities = invocationSource.probabilities;
  assert(probabilities && typeof probabilities === 'object' && !Array.isArray(probabilities));
  assert.deepEqual(Object.keys(probabilities).sort(), [...labels].sort());
  let sum = 0;
  for (const label of labels) {
    const probability = probabilities[label];
    assert(typeof probability === 'number' && Number.isFinite(probability) && probability >= 0 && probability <= 1);
    sum += probability;
  }
  // Tolerance checks distribution encoding, not classification confidence or a production threshold.
  assert(Math.abs(sum - 1) <= 0.001, 'Choice probability mass is not normalized within the diagnostic encoding tolerance');
  const { invocationSource: selectionQuestion, ...binaryQuestions } = plan.questions;
  assert.equal(selectionQuestion.type, 'choice');
  for (const question of Object.values(binaryQuestions)) assert.equal(question.type, 'noul');
  const binary = parseNoul({ raw: JSON.stringify({ ...value, answers: binaryAnswers }), plan: { model: plan.model, questions: binaryQuestions } });
  return {
    ...binary,
    sourceChoice: { choice: invocationSource.choice, confidence: invocationSource.confidence, probabilities: { ...probabilities } },
  };
}
//endregion
