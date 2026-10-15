/**
 Contracts for admitted answer values, before semantic qualification. @module
 */

/**
 Fixed predicate kind and its original named criteria.
 */
export type RelationDefinition = Readonly<{
  type: string;
  criteria: Readonly<Record<string, string>>;
}>;

/**
 Original choice distribution; admission does not normalize probabilities.
 */
export type ChoiceEstimate = Readonly<{
  choice: string;
  probabilities: Readonly<Record<string, number>>;
}>;

/**
 Answer text with optional original serving-model attribution.
 */
export type AssessmentResponse = Readonly<{
  answerText: string;
  model?: string;
}>;

/**
 Untrusted parsed answer paired with its original definition.
 */
export type RelationEstimateInput = Readonly<{
  definition: RelationDefinition;
  value: unknown;
}>;
