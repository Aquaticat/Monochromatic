/**
 * Structured OpenCodeReview input parsing and normalization.
 *
 * @module
 */

import type {
  FindingCategory,
  FindingSeverity,
  NormalizedFinding,
  NormalizedInput,
} from './model.ts';

//region Validation constants

/**
 * Accepted OCR categories for runtime narrowing.
 */
const FINDING_CATEGORIES: ReadonlySet<string> = new Set([
  'bug',
  'security',
  'performance',
  'maintainability',
  'test',
  'style',
  'documentation',
  'other',
],);

/**
 * Accepted OCR severities for runtime narrowing.
 */
const FINDING_SEVERITIES: ReadonlySet<string> = new Set([
  'critical',
  'high',
  'medium',
  'low',
],);

//endregion Validation constants

//region Errors

/**
 * Reports an unsupported envelope or malformed finding before policy work.
 *
 * @example
 * ```ts
 * throw new InputValidationError('input must be JSON');
 * ```
 */
export class InputValidationError extends Error {
  /**
   * Creates a structured-input validation failure.
   *
   * @param message - User-facing evidence identifying rejected input.
   *
   * @example
   * ```ts
   * const error = new InputValidationError('comment path is missing');
   * ```
   */
  public constructor(message: string,) {
    super(message,);
    this.name = InputValidationError.name;
  }
}

//endregion Errors

//region Runtime narrowing

/**
 * Narrows non-null objects for property validation.
 *
 * @param value - Untrusted JSON value at current validation boundary.
 *
 * @returns Whether named properties can be inspected safely.
 *
 * @example
 * ```ts
 * isRecord({ status: 'complete' }); // true
 * ```
 */
function isRecord(value: unknown,): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value,);
}

/**
 * Narrows validated category text to OCR's declared category union.
 *
 * @param value - Category candidate from one comment.
 *
 * @returns Whether candidate belongs to supported category vocabulary.
 *
 * @example
 * ```ts
 * isFindingCategory('bug'); // true
 * ```
 */
function isFindingCategory(value: string,): value is FindingCategory {
  return FINDING_CATEGORIES.has(value,);
}

/**
 * Narrows validated severity text to OCR's declared severity union.
 *
 * @param value - Severity candidate from one comment.
 *
 * @returns Whether candidate belongs to supported severity vocabulary.
 *
 * @example
 * ```ts
 * isFindingSeverity('high'); // true
 * ```
 */
function isFindingSeverity(value: string,): value is FindingSeverity {
  return FINDING_SEVERITIES.has(value,);
}

/**
 * Reads mandatory string property from one untrusted record.
 *
 * @param record - Record carrying candidate property.
 * @param key - Property whose type is part of accepted OCR schema.
 * @param position - One-based record number for diagnostic evidence.
 *
 * @returns Validated string value.
 *
 * @throws {@link InputValidationError} when property is absent or non-string.
 *
 * @example
 * ```ts
 * requiredString({ path: 'a.ts' }, 'path', 1); // 'a.ts'
 * ```
 */
function requiredString({
  record,
  key,
  position,
}: {
  readonly record: Readonly<Record<string, unknown>>;
  readonly key: string;
  readonly position: number;
},): string {
  const value = record[key];
  if (typeof value !== 'string') {
    throw new InputValidationError(`record ${String(position,)} property ${key} must be a string`,);
  }
  return value;
}

/**
 * Reads optional string property with empty-string normalization.
 *
 * @param record - Record carrying candidate property.
 * @param key - Optional OCR property.
 * @param position - One-based record number for diagnostic evidence.
 *
 * @returns Empty string when absent or validated supplied text.
 *
 * @throws {@link InputValidationError} when supplied value is non-string.
 *
 * @example
 * ```ts
 * optionalString({ record: {}, key: 'existing_code', position: 1 }); // ''
 * ```
 */
function optionalString({
  record,
  key,
  position,
}: {
  readonly record: Readonly<Record<string, unknown>>;
  readonly key: string;
  readonly position: number;
},): string {
  const value = record[key];
  if (value === undefined) {
    return '';
  }
  if (typeof value !== 'string') {
    throw new InputValidationError(`record ${String(position,)} property ${key} must be a string`,);
  }
  return value;
}

/**
 * Reads positive integer line property.
 *
 * @param record - Record carrying line property.
 * @param key - Start or end line key.
 * @param position - One-based record number for diagnostic evidence.
 *
 * @returns Validated positive integer.
 *
 * @throws {@link InputValidationError} when property is not positive integer.
 *
 * @example
 * ```ts
 * positiveLine({ record: { start_line: 2 }, key: 'start_line', position: 1 }); // 2
 * ```
 */
function positiveLine({
  record,
  key,
  position,
}: {
  readonly record: Readonly<Record<string, unknown>>;
  readonly key: string;
  readonly position: number;
},): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isInteger(value,) || value < 1) {
    throw new InputValidationError(
      `record ${String(position,)} property ${key} must be a positive integer`,
    );
  }
  return value;
}

//endregion Runtime narrowing

//region Comment normalization

/**
 * Normalizes optional category after case and whitespace folding.
 *
 * @param record - Comment record carrying category.
 * @param position - One-based record number for diagnostic evidence.
 *
 * @returns Supported category or absence.
 *
 * @throws {@link InputValidationError} when supplied category is unsupported.
 *
 * @example
 * ```ts
 * normalizeCategory({ record: { category: ' BUG ' }, position: 1 }); // 'bug'
 * ```
 */
function normalizeCategory({
  record,
  position,
}: {
  readonly record: Readonly<Record<string, unknown>>;
  readonly position: number;
},): FindingCategory | undefined {
  const value = record.category;
  if (value === undefined || value === '') {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new InputValidationError(`record ${String(position,)} property category must be a string`,);
  }
  const normalized = value.trim().toLowerCase();
  if (!isFindingCategory(normalized,)) {
    throw new InputValidationError(`record ${String(position,)} has unsupported category ${value}`,);
  }
  return normalized;
}

/**
 * Normalizes optional severity after case and whitespace folding.
 *
 * @param record - Comment record carrying severity.
 * @param position - One-based record number for diagnostic evidence.
 *
 * @returns Supported severity or absence.
 *
 * @throws {@link InputValidationError} when supplied severity is unsupported.
 *
 * @example
 * ```ts
 * normalizeSeverity({ record: { severity: ' HIGH ' }, position: 1 }); // 'high'
 * ```
 */
function normalizeSeverity({
  record,
  position,
}: {
  readonly record: Readonly<Record<string, unknown>>;
  readonly position: number;
},): FindingSeverity | undefined {
  const value = record.severity;
  if (value === undefined || value === '') {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new InputValidationError(`record ${String(position,)} property severity must be a string`,);
  }
  const normalized = value.trim().toLowerCase();
  if (!isFindingSeverity(normalized,)) {
    throw new InputValidationError(`record ${String(position,)} has unsupported severity ${value}`,);
  }
  return normalized;
}

/**
 * Converts one OCR comment to adapter-owned naming and position metadata.
 *
 * @param value - Untrusted comment value.
 * @param position - One-based comment position.
 *
 * @returns Validated normalized finding.
 *
 * @throws {@link InputValidationError} when comment violates OCR schema.
 *
 * @example
 * ```ts
 * normalizeComment({ value: { path: 'a.ts', content: 'x', start_line: 1, end_line: 1 }, position: 1 });
 * ```
 */
function normalizeComment({
  value,
  position,
}: {
  readonly value: unknown;
  readonly position: number;
},): NormalizedFinding {
  if (!isRecord(value,)) {
    throw new InputValidationError(`record ${String(position,)} must be an object`,);
  }
  const path = requiredString({ record: value, key: 'path', position, });
  if (path.trim() === '') {
    throw new InputValidationError(`record ${String(position,)} property path must not be empty`,);
  }
  const startLine = positiveLine({ record: value, key: 'start_line', position, });
  const endLine = positiveLine({ record: value, key: 'end_line', position, });
  if (endLine < startLine) {
    throw new InputValidationError(`record ${String(position,)} end_line precedes start_line`,);
  }
  const category = normalizeCategory({ record: value, position, });
  const severity = normalizeSeverity({ record: value, position, });
  return {
    position: { kind: 'record', value: position, },
    path,
    content: requiredString({ record: value, key: 'content', position, }),
    existingCode: optionalString({ record: value, key: 'existing_code', position, }),
    suggestionCode: optionalString({ record: value, key: 'suggestion_code', position, }),
    startLine,
    endLine,
    ...(category === undefined ? {} : { category, }),
    ...(severity === undefined ? {} : { severity, }),
  };
}

//endregion Comment normalization

//region Envelope parsing

/**
 * Reads optional resolved head from complete OCR result manifest.
 *
 * @param result - Validated top-level result record.
 *
 * @returns Resolved head string when available.
 *
 * @example
 * ```ts
 * readResolvedHead({ manifest: { input: { resolved_head: 'abc' } } }); // 'abc'
 * ```
 */
function readResolvedHead(result: Readonly<Record<string, unknown>>,): string | undefined {
  if (!isRecord(result.manifest,)
    || !isRecord(result.manifest.input,)
    || typeof result.manifest.input.resolved_head !== 'string'
    || result.manifest.input.resolved_head === '')
  {
    return undefined;
  }
  return result.manifest.input.resolved_head;
}

/**
 * Parses one supported OCR structured input envelope atomically.
 *
 * @param text - Complete JSON or JSONL text supplied by trusted transport boundary.
 *
 * @returns Normalized findings and available head provenance.
 *
 * @throws {@link InputValidationError} when JSON or recognized schema is invalid.
 *
 * @example
 * ```ts
 * parseStructuredInput({ text: '{"status":"complete","comments":[]}' });
 * ```
 */
export function parseStructuredInput({ text, }: { readonly text: string; },): NormalizedInput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text,);
  }
  catch (error: unknown) {
    throw new InputValidationError(`input must be valid JSON: ${String(error,)}`,);
  }
  if (Array.isArray(parsed,)) {
    return {
      inputKind: 'comments',
      findings: parsed.map(function normalizeArrayComment(value, index,): NormalizedFinding {
        return normalizeComment({ value, position: index + 1, });
      },),
    };
  }
  if (!isRecord(parsed,)
    || typeof parsed.status !== 'string'
    || !Array.isArray(parsed.comments,))
  {
    throw new InputValidationError('input is not a complete OCR result or comment array',);
  }
  const resolvedHead = readResolvedHead(parsed,);
  return {
    inputKind: 'result',
    ...(resolvedHead === undefined ? {} : { resolvedHead, }),
    findings: parsed.comments.map(function normalizeResultComment(value, index,): NormalizedFinding {
      return normalizeComment({ value, position: index + 1, });
    },),
  };
}

//endregion Envelope parsing
