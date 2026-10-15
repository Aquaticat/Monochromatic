/** Admit exact pinned catalog bytes before issuing original question claims. @module */
import { createHash } from 'node:crypto';
import { QuestionSelectionError } from './selection-error.ts';
import { object, text } from './selection-values.ts';
import type { QuestionCatalog, QuestionCatalogInput, QuestionDefinition } from './selection-definition-types.ts';

//region Bounds describe the declared catalog wire profile.
/** Maximum original catalog payload, in UTF-8 bytes. */
const MAX_CATALOG_BYTES = 1_048_576;
/** Maximum fixed predicates in an original catalog. */
const MAX_DEFINITIONS = 512;
/** A choice needs competing named options. */
const MIN_CHOICE_OPTIONS = 2;
/** Maximum named options in one choice. */
const MAX_CHOICE_OPTIONS = 255;
//endregion

//region Parse unknown data before admitting its fixed predicate and rubric contracts.
/** Preserve parse failures as causes of the question-boundary diagnostic.
 * @param catalogText - Original bounded catalog bytes
 * @returns Parsed data awaiting definition admission
 * @throws QuestionSelectionError for malformed JSON
 */
function parseQuestionCatalog(catalogText: string): unknown {
  try {
    return JSON.parse(catalogText);
  } catch (error) {
    throw new QuestionSelectionError('Question catalog is not valid JSON', { cause: error });
  }
}

/** Check fixed predicate fields and named rubric membership before freezing criteria.
 * @param input - Original catalog entry awaiting structural admission
 * @returns Normally after the entry satisfies its definition contract
 * @throws QuestionSelectionError for missing, extra, or invalid predicate fields
 */
function assertQuestionDefinition(input: Readonly<{ id: string; value: unknown }>): asserts input is Readonly<{ id: string; value: QuestionDefinition }> {
  /** Retain the exact entry while narrowing its original fields. */
  const { id, value } = input;
  if (!text(id) || !object(value) || Array.isArray(value)
    || (value.type !== 'noul' && value.type !== 'choice')
    || !text(value.instructions) || !object(value.criteria) || Array.isArray(value.criteria)) {
    throw new QuestionSelectionError('Question definition is missing its fixed predicate or criteria');
  }
  if (Object.keys(value).toSorted().join(',') !== 'criteria,instructions,type') {
    throw new QuestionSelectionError('Question definition has undeclared fields');
  }
  /** Complete option membership from the original criteria object. */
  const criteria = Object.entries(value.criteria);
  if (criteria.some(function hasInvalidCriterionText([label, rubric]) {
    return !text(label) || !text(rubric);
  })) {
    throw new QuestionSelectionError('Question options require named text rubrics');
  }
  if (value.type === 'noul' && Object.keys(value.criteria).toSorted().join(',') !== 'false,true') {
    throw new QuestionSelectionError('Scalar definition requires exactly true and false criteria');
  }
  if (value.type === 'choice' && (criteria.length < MIN_CHOICE_OPTIONS || criteria.length > MAX_CHOICE_OPTIONS)) {
    throw new QuestionSelectionError('Choice definition requires two through 255 options');
  }
}
//endregion

//region Exact definition bytes precede construction of the owner-local claim catalog.
/** Pin original catalog data and prepare canonical claim indexes without issuing claims.
 * @param catalogText - Original serialized definitions
 * @param catalogSHA256 - Expected digest of those exact bytes
 * @param resolveBinding - Caller-owned synchronous binding capability
 * @param envelope - Already frozen owner projection
 * @returns Admitted definitions and empty owner-local identity indexes
 * @throws QuestionSelectionError for invalid bytes, envelope, or fixed definitions
 * @example readQuestionDefinitions({ catalogText, catalogSHA256, resolveBinding, envelope });
 */
export function readQuestionDefinitions({ catalogText, catalogSHA256, resolveBinding, envelope }: QuestionCatalogInput): QuestionCatalog {
  if (!text(catalogText) || Buffer.byteLength(catalogText) > MAX_CATALOG_BYTES || typeof resolveBinding !== 'function') {
    throw new QuestionSelectionError('Question catalog or owned binding resolver is unavailable');
  }
  /** Digest spelling remains the original SHA-256 hexadecimal representation. */
  const digest = createHash('sha256').update(catalogText).digest('hex');
  if (digest !== catalogSHA256) throw new QuestionSelectionError('Question catalog bytes differ from the pinned definitions');
  if (!object(envelope) || !Object.isFrozen(envelope)) throw new QuestionSelectionError('Question envelope must be an immutable owned projection');
  /** Parsed catalog remains unknown until root and entry checks complete. */
  const parsed = parseQuestionCatalog(catalogText);
  if (!object(parsed) || Array.isArray(parsed)) throw new QuestionSelectionError('Question catalog must be a definition object');
  /** Original order controls stable definition and identity-map iteration. */
  const entries = Object.entries(parsed);
  if (entries.length === 0 || entries.length > MAX_DEFINITIONS) throw new QuestionSelectionError('Question definition count exceeds the declared profile');
  /** Admitted fixed definitions keyed by their original catalog names. */
  const definitions = new Map<string, QuestionDefinition>();
  /** Each predicate owns an independent binding-identity index. */
  const byDefinition = new Map<string, WeakMap<object, Readonly<object>>>();
  for (const [id, value] of entries) {
    /** Stable holder exposes the validated entry without casting parsed data. */
    const original = { id, value };
    assertQuestionDefinition(original);
    /** Complete definition established by structural admission. */
    const definition = original.value;
    /** Scalar rubric order remains true then false; choices retain their original object. */
    const fixedCriteria = Object.freeze(definition.type === 'noul' ? {
      true: definition.criteria.true,
      false: definition.criteria.false,
    } : definition.criteria);
    definitions.set(id, Object.freeze({ type: definition.type, instructions: definition.instructions, criteria: fixedCriteria }));
    byDefinition.set(id, new WeakMap());
  }
  return { digest, definitions, byDefinition };
}
//endregion
