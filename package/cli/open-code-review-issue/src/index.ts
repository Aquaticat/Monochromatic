#!/usr/bin/env node
/**
 * OpenCodeReview finding to GitHub Issue adapter.
 *
 * @module
 */

export { readStructuredInputFile, } from './file-input.ts';
export {
  runGitHubApi,
  type GitHubApiMethod,
  type GitHubApiRequest,
} from './github-api.ts';
export type {
  GitHubApiClient,
  GitHubRepository,
  PublicationPreflight,
} from './github-model.ts';
export {
  GitHubProcessError,
  GitHubProcessTimeoutError,
  runBoundedProcess,
  type BoundedProcessRequest,
  type BoundedProcessResult,
  type BoundedProcessRunner,
} from './github-process.ts';
export {
  IncludedResponseError,
  parseIncludedResponse,
  type IncludedResponse,
} from './github-response.ts';
export {
  GitHubCliVersionError,
  parseGitHubCliVersion,
  type GitHubCliVersion,
} from './github-version.ts';
export {
  SecurityAuthorityError,
  selectApplyPlan,
} from './authority.ts';
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
  ApplyAuthority,
  ApplySelection,
  LabelStrategy,
  NonInteractivePreview,
  PreviewIssue,
  PublicationPlan,
  SecurityPreview,
  SourceReferenceStrategy,
} from './plan-model.ts';
export {
  buildNonInteractivePreview,
  buildPublicationPlan,
} from './plan.ts';
export {
  preflightPublication,
  PublicationPreflightError,
} from './preflight.ts';
export type {
  CreatedIssue,
  PublicationResult,
  PublicationWait,
} from './publisher-model.ts';
export {
  AmbiguousReconciliationError,
  IssuePublicationError,
} from './publication-error.ts';
export { publishIssues, } from './publisher.ts';
export type {
  FindingCategory,
  FindingSeverity,
  InputPosition,
  NormalizedFinding,
  NormalizedInput,
} from './model.ts';
