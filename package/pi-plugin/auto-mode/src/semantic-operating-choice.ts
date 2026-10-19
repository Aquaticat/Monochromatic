/**
 Operating admission for categorical estimates preserves unresolved meanings.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { readPolicyRecord, } from './policy-data.ts';
import { SemanticAdmissionPolicyError, } from './semantic-admission-error.ts';

/**
 Uncertainty activates the user's minimum action score.
 */
const uncertaintyBoundary = 0.2;
/**
 Require stronger action support when uncertainty reaches its boundary.
 */
const uncertainMinimumSelectedScore = 0.6;
/**
 Preserve the incumbent decoder's tolerance for normalized distributions.
 */
const distributionTolerance = 0.000001;
/**
 Admission diagnostics exclude original instruction text and model values.
 */
const l = tagged({ tag: 'auto-mode-semantic-operating-choice', },);

//region Closed distributions retain every configured label before admission

/**
 Validate complete scores without invoking accessors or freezing borrowed records.

 @param value - original score record from the native decoder

 @param labels - fixed definition's complete choice vocabulary

 @returns owned finite scores for the exact configured vocabulary

 @throws SemanticAdmissionPolicyError for missing, unbounded, or unnormalized scores

 @throws InstructionResolutionInputError for unsupported record shapes
 */
function readScores({
  value,
  labels,
}: {
  readonly value: unknown;
  readonly labels: readonly string[];
},): Readonly<Record<string, number>> {
  /**
   Structural validation copies only own data properties.
   */
  const record = readPolicyRecord({
    input: value,
    fields: labels,
  },);
  /**
   Scores belong to this invocation, never the submitted estimate.
   */
  const scores: Record<string, number> = {};
  /**
   Accumulate the bounded vocabulary without exposing mutable bindings to later checks.
   */
  const total = labels.reduce(
    function addScore(
      sum,
      label,
    ) {
    /**
     Missing members fail the same numeric check as malformed scores.
     */
    const score = record[label];
    if (((typeof score) !== 'number') || (!Number.isFinite(score,))
      || (score < 0)
      || (score > 1))
      throw new SemanticAdmissionPolicyError('Semantic admission requires every configured score between zero and one',);
    scores[label] = score;
    return sum + score;
  },
    0,
  );
  if (Math.abs(total - 1,) > distributionTolerance)
    throw new SemanticAdmissionPolicyError('Semantic admission requires a complete normalized distribution',);
  return Object.freeze(scores,);
}

/**
 Admit a supported unique leader under the user's uncertainty-dependent action rule.
 Native callers separately authenticate model, definition, scope, and original evidence ownership.
 Neither admission nor the score establishes empirical accuracy or an action verdict.

 @param value - original decoded categorical estimate

 @param labels - complete vocabulary fixed by the original question definition

 @returns whether this estimate may contribute its supported relationship

 @throws SemanticAdmissionPolicyError for malformed choice or distribution values

 @throws InstructionResolutionInputError for unsupported record shapes

 @example
 ```ts
 admitsOperatingChoice({ value: decodedEstimate, labels: fixedDefinitionLabels });
 ```
 */
export function admitsOperatingChoice({
  value,
  labels,
}: {
  readonly value: unknown;
  readonly labels: readonly string[];
},): boolean {
  /**
   Keep the acceptance boundary visible without logging borrowed content.
   */
  const rl = tagged({
    tag: admitsOperatingChoice.name,
    l,
  },);
  rl.debug('checking the adopted categorical operating policy',);
  /**
   Metadata cannot replace the original choice and probability fields.
   */
  const record = readPolicyRecord({
    input: value,
    fields: [
      'choice',
      'probabilities',
    ],
  },);
  /**
   Selected labels remain untrusted until checked against this exact definition.
   */
  const { choice, } = record;
  if (((typeof choice) !== 'string') || (!labels.includes(choice,)))
    throw new SemanticAdmissionPolicyError('Semantic admission choice differs from the configured question vocabulary',);
  /**
   Validate the complete distribution even for an unresolved selected meaning.
   */
  const scores = readScores({
    value: record.probabilities,
    labels,
  },);
  /**
   Exact vocabulary validation guarantees presence without a non-null assertion.
   */
  const selectedScore = scores[choice];
  if ((selectedScore === undefined) || (choice === 'unknown')
    || (choice === 'unsupported')) {
    rl.debug('retaining unresolved categorical meaning',);
    return false;
  }
  if (labels.some(function reachesSelectedScore(label,) {
    return (label !== choice) && ((scores[label] ?? 0) >= selectedScore);
  },)) {
    rl.debug('retaining a tied or nonleading categorical meaning',);
    return false;
  }
  if (((scores.unknown ?? 0) >= uncertaintyBoundary)
    && (selectedScore < uncertainMinimumSelectedScore)) {
    rl.debug('uncertainty requires a higher-scoring categorical meaning',);
    return false;
  }
  rl.debug('admitting the uniquely leading supported categorical estimate',);
  return true;
}

//endregion Closed distributions and explicit abstention
