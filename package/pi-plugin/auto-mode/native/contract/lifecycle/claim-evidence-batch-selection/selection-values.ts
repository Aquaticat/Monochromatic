/**
 Admit response attribution and fixed-criterion estimates without granting claim identity. @module
 */
import { QuestionSelectionError } from './selection-error.ts';
import type {
  AssessmentResponse,
  ChoiceEstimate,
  RelationEstimateInput
} from './selection-value-types.ts';

//region Validate original values without replacing their objects or normalizing estimates.
/**
 Maximum UTF-8 bytes retained for serving-model attribution.
 */
const MAX_MODEL_BYTES = 256;
/**
 Floating-point reporting drift permitted in a complete distribution.
 */
const DISTRIBUTION_TOLERANCE = 0.000001;

/** Identify non-null objects; individual readers reject arrays where required.
 @param value - Untrusted boundary value
 
 @returns Whether properties can be inspected
 
 @example object({ choice: 'yes' });
 */
export function object(value: unknown): value is Readonly<Record<string, unknown>> {
  return (value !== null) && ((typeof value) === 'object');
}

/** Admit nonempty well-formed text for identifiers and attribution.
 @param value - Untrusted boundary value
 
 @returns Whether text can identify an original criterion or serving model
 
 @example text('yes');
 */
export function text(value: unknown): value is string {
  return ((typeof value) === 'string') && (value.length > 0)
    && value.isWellFormed();
}

/** Retain optional serving-model attribution without another serialized answer envelope.
 @param input - Raw answer text or attributed response
 
 @returns Frozen original answer text and validated attribution
 
 @throws QuestionSelectionError for invalid attribution or response properties
 
 @example readAssessmentResponse({ answerText: '0.5', model: 'fixture' });
 */
export function readAssessmentResponse(input: unknown): AssessmentResponse {
  if ((typeof input) === 'string') return Object.freeze({ answerText: input });
  if ((!object(input)) || (Object.getPrototypeOf(input) !== Object.prototype)
    || (Reflect.ownKeys(input)
      .length
      !== 2)
    || (!Object.hasOwn(
      input,
      'answerText'
    ))
    || (!Object.hasOwn(
      input,
      'model'
    ))) {
    throw new QuestionSelectionError('Assessment response requires answer text and its serving-model attribution');
  }
  /** Original answer property, inspected without invoking accessors. */
  const answer = Object.getOwnPropertyDescriptor(
    input,
    'answerText'
  );
  /** Original model property, inspected without invoking accessors. */
  const model = Object.getOwnPropertyDescriptor(
    input,
    'model'
  );
  /** Untrusted descriptor payload narrowed before publication. */
  const answerText: unknown = answer?.value;
  /** Untrusted serving identity narrowed before its byte bound is checked. */
  const modelText: unknown = model?.value;
  if ((answer?.enumerable !== true) || (!Object.hasOwn(
    answer,
    'value'
  ))
    || ((typeof answerText) !== 'string')
    || (model?.enumerable !== true)
    || (!Object.hasOwn(
      model,
      'value'
    ))
    || (!text(modelText))
    || (Buffer.byteLength(modelText) > MAX_MODEL_BYTES)) {
    throw new QuestionSelectionError('Attributed assessment response requires bounded model text and data properties');
  }
  return Object.freeze({
    answerText,
    model: modelText
  });
}

/** Establish fixed-option membership and a complete original choice distribution.
 @param input - Original definition and untrusted parsed estimate
 
 @returns Normally after the original choice satisfies its declared distribution

 @throws QuestionSelectionError for mismatched options or invalid probabilities
 */
function assertChoiceEstimate(input: RelationEstimateInput): asserts input is RelationEstimateInput & Readonly<{ value: ChoiceEstimate }> {
  /** Captured definition and original answer from the reader boundary. */
  const {
    definition,
    value
  } = input;
  if ((!object(value)) || Array.isArray(value)
    || (Object.keys(value)
      .toSorted()
      .join(',')
      !== 'choice,probabilities')
    || (!text(value.choice))
    || (!Object.hasOwn(
      definition.criteria,
      value.choice
    ))) {
    throw new QuestionSelectionError('Choice answer must select an option from its original definition');
  }
  /** Original distribution object, retained for freezing without a copy. */
  const { probabilities } = value;
  /** Complete option set supplied by the original fixed definition. */
  const labels = Object.keys(definition.criteria);
  if ((!object(probabilities))
    || Array.isArray(probabilities)
    || (Object.keys(probabilities)
      .length
      !== labels.length)
    || Object.keys(probabilities)
    .some(function lacksDeclaredCriterion(label) {
      return !Object.hasOwn(
        definition.criteria,
        label
      );
    })) {
    throw new QuestionSelectionError('Choice probabilities differ from the original option set');
  }
  /** Accumulate numeric evidence without rewriting any probability. */
  const distribution = {
    largest: 0,
    total: 0
  };
  for (const label of labels) {
    /** Untrusted original member must be finite and bounded. */
    const probability = probabilities[label];
    if (((typeof probability) !== 'number') || (!Number.isFinite(probability))
      || (probability < 0)
      || (probability > 1)) {
      throw new QuestionSelectionError('Choice probabilities must be bounded numbers');
    }
    distribution.total += probability;
    distribution.largest = Math.max(
      distribution.largest,
      probability
    );
  }
  // Allow reporting drift without imposing a semantic confidence cutoff or normalizing received values.
  if ((Math.abs(distribution.total - 1) > DISTRIBUTION_TOLERANCE) || (probabilities[value.choice] !== distribution.largest)) {
    throw new QuestionSelectionError('Choice answer is not a complete distribution with a highest-probability selected option');
  }
  Object.freeze(probabilities);
  Object.freeze(value);
}

/** Validate parsed JSON against fixed criteria without claim identity or semantic qualification.
 @param input - Original definition and parsed estimate
 
 @returns Original scalar or frozen choice distribution
 
 @throws QuestionSelectionError for invalid estimate or unsupported definition type
 
 @example readRelationEstimate({ definition: { type: 'noul', criteria: {} }, value: 0.5 });
 */
export function readRelationEstimate(input: RelationEstimateInput): number | ChoiceEstimate {
  /** Capture caller properties once before choosing the validation branch. */
  const {
    definition,
    value
  } = input;
  if (definition.type === 'noul') {
    if (((typeof value) === 'number') && Number.isFinite(value)
      && (value >= 0)
      && (value <= 1)) return value;
    throw new QuestionSelectionError('Scalar answer must be a bounded numeric estimate');
  }
  if (definition.type !== 'choice') throw new QuestionSelectionError('Estimate definition type is unsupported');
  /** Stable holder permits an assertion without reading caller properties again. */
  const original = {
    definition,
    value
  };
  assertChoiceEstimate(original);
  return original.value;
}
//endregion
