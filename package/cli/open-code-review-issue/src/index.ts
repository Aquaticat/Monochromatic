#!/usr/bin/env node
/**
 * OpenCodeReview finding to GitHub Issue adapter.
 *
 * @module
 */

export {
  InputValidationError,
  parseStructuredInput,
} from './ingest.ts';
export type {
  FindingCategory,
  FindingSeverity,
  InputPosition,
  NormalizedFinding,
  NormalizedInput,
} from './model.ts';
