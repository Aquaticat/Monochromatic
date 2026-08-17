#!/usr/bin/env node
/**
 * OpenCodeReview finding to GitHub Issue adapter.
 *
 * @module
 */

export { InputValidationError, } from './input-validation-error.ts';
export { parseStructuredInput, } from './ingest.ts';
export type {
  FindingCategory,
  FindingSeverity,
  InputPosition,
  NormalizedFinding,
  NormalizedInput,
} from './model.ts';
