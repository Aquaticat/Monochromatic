/**
 * Tests for the benchmark's attempt-retry policy predicates.
 * Fixtures are cat-themed invention only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import type { CriticAttemptRecord, } from './scorecard.ts';
import {
  COMPLETION_TOKEN_CEILING,
  isRetryableAttempt,
  isTruncatedAttempt,
} from './attempt-retry.ts';

/**
 * Baseline schema-mismatch record corruptions derive from.
 */
const MISMATCH_RECORD: CriticAttemptRecord = {
  modelId: 'hf:zai-org/GLM-5.2',
  entryId: 'whiskers',
  outcomeKind: 'schema-mismatch',
  detail: 'content parsed as JSON but failed the caller schema guard',
  resolvedClaimCount: 0,
  unresolvedReasons: [],
  seededHitIds: [],
  plantedSeedIds: ['seed/omission-0',],
};

await describe({
  name: isTruncatedAttempt.name,
  children: [
    it({
      name: 'marks truncated-thinking and cut-off-JSON mismatch details',
      fn: async () => {
        expect(isTruncatedAttempt({
          record: {
            ...MISMATCH_RECORD,
            detail: 'output was truncated inside its thinking block;'
              + ' raise or omit maxTokens (thinking tokens count against it)',
          },
        },),).toBe(true,);
        expect(isTruncatedAttempt({
          record: {
            ...MISMATCH_RECORD,
            detail: 'content is not valid JSON: Unexpected end of JSON input',
          },
        },),).toBe(true,);
        expect(isTruncatedAttempt({
          record: {
            ...MISMATCH_RECORD,
            detail: 'content is not valid JSON:'
              + ' Unterminated string in JSON at position 42',
          },
        },),).toBe(true,);
      },
    },),

    it({
      name: 'marks ceiling-level token counts even with unrecognized details',
      fn: async () => {
        expect(isTruncatedAttempt({
          record: {
            ...MISMATCH_RECORD,
            completionTokens: COMPLETION_TOKEN_CEILING,
          },
        },),).toBe(true,);
        expect(isTruncatedAttempt({
          record: {
            ...MISMATCH_RECORD,
            completionTokens: COMPLETION_TOKEN_CEILING - 1,
          },
        },),).toBe(false,);
      },
    },),

    it({
      name: 'passes over non-truncation mismatches and other outcome kinds',
      fn: async () => {
        expect(isTruncatedAttempt({ record: MISMATCH_RECORD, },),).toBe(false,);
        expect(isTruncatedAttempt({
          record: {
            ...MISMATCH_RECORD,
            outcomeKind: 'http-error',
            detail: 'HTTP 502',
            completionTokens: COMPLETION_TOKEN_CEILING,
          },
        },),).toBe(false,);
        expect(isTruncatedAttempt({
          record: {
            ...MISMATCH_RECORD,
            outcomeKind: 'ok',
            detail: '',
          },
        },),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: isRetryableAttempt.name,
  children: [
    it({
      name: 'retries every http-error shape and truncated mismatches',
      fn: async () => {
        expect(isRetryableAttempt({
          record: {
            ...MISMATCH_RECORD,
            outcomeKind: 'http-error',
            detail: 'HTTP 502',
          },
        },),).toBe(true,);
        expect(isRetryableAttempt({
          record: {
            ...MISMATCH_RECORD,
            outcomeKind: 'http-error',
            detail: 'transport: Error: Timeout: hf:MiniMaxAI/MiniMax-M3'
              + ' exceeded its 480000ms deadline',
          },
        },),).toBe(true,);
        expect(isRetryableAttempt({
          record: {
            ...MISMATCH_RECORD,
            completionTokens: COMPLETION_TOKEN_CEILING,
          },
        },),).toBe(true,);
      },
    },),

    it({
      name: 'never retries refusals, clean records, or well-formed garbage',
      fn: async () => {
        expect(isRetryableAttempt({
          record: {
            ...MISMATCH_RECORD,
            outcomeKind: 'refusal-shaped',
            detail: 'api-refusal-field',
          },
        },),).toBe(false,);
        expect(isRetryableAttempt({
          record: {
            ...MISMATCH_RECORD,
            outcomeKind: 'ok',
            detail: '',
          },
        },),).toBe(false,);
        expect(isRetryableAttempt({ record: MISMATCH_RECORD, },),).toBe(false,);
      },
    },),
  ],
},);
