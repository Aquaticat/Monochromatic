/**
 Wire projections and narrowing for authored decision fixtures. @module
 */
import assert from 'node:assert/strict';

//region Wire projections describe exactly the fields the fixture asserts.

/**
 Decision wire question projection consumed by the request assertions.
 */
export type DecisionWireQuestion = Readonly<{
  instructions: Readonly<{
    selectedRule?: Readonly<Record<string, unknown>>;
    predicate: string;
  }>;
  criteria: Readonly<Record<string, unknown>>;
}>;

/**
 Decision wire projection carrying its questions and clause relation definition.
 */
export type DecisionWire = Readonly<{
  model: string;
  questions: Readonly<Record<string, DecisionWireQuestion>>;
  state: Readonly<{
    clauseRelationDefinition: Readonly<{ instructions: string }>;
  }>;
}>;

/**
 Mutable authored answer the low-confidence mode rewrites in place.
 */
export type MutableDecisionAnswer = {
  choice: string;
  probabilities: Record<string, number>;
};

/**
 Mutable authored response whose answers the low-confidence mode rewrites.
 */
export type MutableDecisionResponse = {
  answers: Record<string, MutableDecisionAnswer>;
};

//endregion

//region Wire shape errors name the member that failed its projection.

/**
 Wire shape failures name the request member whose projection did not hold.
 */
export class DecisionFallbackWireShapeError extends Error {
  /**
   Diagnostic identity stays distinct from evidence and transport failures.
   */
  override readonly name = 'DecisionFallbackWireShapeError';
}

/**
 Recognize an object member before its projected field reads.

 @param value - wire member arriving from parsed JSON

 @returns whether ordinary property reads can inspect the member
 */
function isWireMemberRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return ((typeof value) === 'object') && (value !== null);
}

/**
 Narrow a parsed wire member before its projected field reads.

 @param value - wire member arriving from parsed JSON

 @returns record view for further field checks

 @throws DecisionFallbackWireShapeError when the member is not an object
 */
function wireMemberRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (!isWireMemberRecord(value))
    throw new DecisionFallbackWireShapeError('Decision wire member must be an object before its field reads');
  return value;
}

/**
 Validate the clause relation containers the clause comparison dereferences.

 @param value - decision wire state member

 @returns narrowed state projection for the clause comparison

 @throws DecisionFallbackWireShapeError when a dereferenced container is missing
 */
export function assertClauseRelationDefinition(value: unknown): asserts value is DecisionWire['state'] {
  /**
   State carries the clause relation definition the fixture compares.
   */
  const state = wireMemberRecord(value);
  /**
   Relation definition keeps its complete interpretation instructions.
   */
  wireMemberRecord(state.clauseRelationDefinition);
}

//endregion

//region Request assertions validate the authored decision wire in place.

/**
 Validate the decision wire containers the request assertions dereference.

 Leaf fields stay unvalidated because the fixture only compares them, exactly
 like the original assertions, so well-formed and tolerated shapes pass alike.

 @param value - parsed decision wire request

 @returns narrowed wire projection for the request assertions

 @example
 ```ts
 assertDecisionWire(JSON.parse(input.body));
 ```

 @throws DecisionFallbackWireShapeError when a dereferenced container is missing
 */
export function assertDecisionWire(value: unknown): asserts value is DecisionWire {
  /**
   Wire stays an object record before its question member is read.
   */
  const wire = wireMemberRecord(value);
  /**
   Questions arrive keyed by their authored selection slot.
   */
  const questions = wireMemberRecord(wire.questions);
  for (const question of Object.values(questions)) {
    /**
     Each question keeps its local interpretation instructions.
     */
    const questionRecord = wireMemberRecord(question);
    /**
     Instructions carry the optional selected rule and the predicate.
     */
    wireMemberRecord(questionRecord.instructions);
    /**
     Criteria stay keyed by authored choice label.
     */
    wireMemberRecord(questionRecord.criteria);
  }
}

/**
 Validate the mutable authored response containers the rewrite mutates.

 @param value - parsed authored decision response

 @returns narrowed response projection for the low-confidence rewrite

 @example
 ```ts
 assertMutableDecisionResponse(JSON.parse(raw));
 ```

 @throws DecisionFallbackWireShapeError when a mutation target is missing
 */
export function assertMutableDecisionResponse(value: unknown): asserts value is MutableDecisionResponse {
  /**
   Response stays an object record before its answer member is read.
   */
  const response = wireMemberRecord(value);
  /**
   Answers arrive keyed by question slot and stay mutable rewrite targets.
   */
  const answers = wireMemberRecord(response.answers);
  for (const answer of Object.values(answers))
    wireMemberRecord(answer);
}

//endregion
