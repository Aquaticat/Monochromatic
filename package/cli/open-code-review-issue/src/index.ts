#!/usr/bin/env node
/**
 * OpenCodeReview finding to GitHub Issue adapter.
 *
 * @module
 */

export { readStructuredInputFile, } from './file-input.ts';
export { InputValidationError, } from './input-validation-error.ts';
export type {
  RenderedIssue,
  SourceLink,
} from './issue-model.ts';
export {
  renderIssue,
  renderIssueBody,
} from './issue-render.ts';
export {
  capIssueTitle,
  renderIssueTitle,
} from './issue-title.ts';
export { parseStructuredInput, } from './ingest.ts';
export type {
  FindingCategory,
  FindingSeverity,
  InputPosition,
  NormalizedFinding,
  NormalizedInput,
} from './model.ts';
