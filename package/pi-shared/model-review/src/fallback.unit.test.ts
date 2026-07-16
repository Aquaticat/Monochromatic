/**
 * Built-artifact tests for reviewer availability fallback.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  ReviewUnavailableError,
  runReviewWithFallback,
} from '../dist/final/node/index.mjs';

/**
 * Fixture reviewer candidate.
 *
 * @example
 * ```ts
 * const candidate: Candidate = { identity: 'provider/model' };
 * ```
 */
type Candidate = {
  /** Canonical candidate identity. */
  readonly identity: string;
};

/** Initial candidate fixture. */
const FIRST: Candidate = { identity: 'test/first', };

/** First fallback candidate fixture. */
const FALLBACK_ONE: Candidate = { identity: 'test/fallback-one', };

/** Second fallback candidate fixture. */
const FALLBACK_TWO: Candidate = { identity: 'test/fallback-two', };

/**
 * Resolver-specific availability exhaustion.
 *
 * @example
 * ```ts
 * throw new CandidateUnavailableError('none');
 * ```
 */
class CandidateUnavailableError extends Error {
  /**
   * Create fixture availability error.
   *
   * @param message - fixture diagnostic
   *
   * @example
   * ```ts
   * new CandidateUnavailableError('none');
   * ```
   */
  constructor(message: string,) {
    super(message,);
    this.name = 'CandidateUnavailableError';
  }
}

/**
 * Capture async error without promise matcher indirection.
 *
 * @param action - action expected to fail
 *
 * @returns thrown value
 *
 * @example
 * ```ts
 * const error = await captureError(async () => { throw new Error('x'); });
 * ```
 */
async function captureError(action: () => Promise<unknown>,): Promise<unknown> {
  try {
    await action();
  }
  catch (error) {
    return error;
  }
  throw new Error('expected action to fail',);
}

await describe({
  name: runReviewWithFallback.name,
  children: [
    it({
      name: 'returns initial valid denial without fallback',
      fn: async () => {
        /** Fallback resolver invocation count. */
        const resolverCalls: unknown[] = [];
        /** Valid initial denial result. */
        const result = await runReviewWithFallback({
          firstCandidate: FIRST,
          candidateIdentity(candidate,) {
            return candidate.identity;
          },
          async resolveFallback(options,) {
            resolverCalls.push(options,);
            return FALLBACK_ONE;
          },
          async runAttempt() {
            return { approved: false, };
          },
          isCandidateUnavailable(error,) {
            return error instanceof CandidateUnavailableError;
          },
        },);
        expect(result.verdict,).toEqual({ approved: false, },);
        expect(result.usedFallback,).toBe(false,);
        expect(resolverCalls,).toHaveLength(0,);
      },
    },),
    it({
      name: 'resolves two distinct fallbacks before concurrent attempts',
      fn: async () => {
        /** Resolver exclusion snapshots. */
        const exclusions: (readonly string[])[] = [];
        /** Attempt start identities. */
        const attempts: string[] = [];
        /** Result returned by first valid fallback. */
        const result = await runReviewWithFallback({
          firstCandidate: FIRST,
          candidateIdentity(candidate,) {
            return candidate.identity;
          },
          async resolveFallback({ excludedCandidateIdentities, },) {
            exclusions.push(excludedCandidateIdentities,);
            return excludedCandidateIdentities.length === 1
              ? FALLBACK_ONE
              : FALLBACK_TWO;
          },
          async runAttempt({ candidate, },) {
            attempts.push(candidate.identity,);
            if (candidate === FIRST)
              throw new Error('initial failed',);
            if (candidate === FALLBACK_ONE) {
              await Promise.resolve();
              expect(attempts,).toEqual([
                FIRST.identity,
                FALLBACK_ONE.identity,
                FALLBACK_TWO.identity,
              ],);
              return { approved: false, };
            }
            return { approved: true, };
          },
          isCandidateUnavailable(error,) {
            return error instanceof CandidateUnavailableError;
          },
        },);
        expect(exclusions,).toEqual([
          [FIRST.identity,],
          [FIRST.identity, FALLBACK_ONE.identity,],
        ],);
        expect(result.usedFallback,).toBe(true,);
        expect(result.attemptedCandidateIdentities,).toEqual([
          FIRST.identity,
          FALLBACK_ONE.identity,
          FALLBACK_TWO.identity,
        ],);
      },
    },),
    it({
      name: 'ignores rejected contender until another returns valid verdict',
      fn: async () => {
        /** Valid result returned after first fallback rejects. */
        const result = await runReviewWithFallback({
          firstCandidate: FIRST,
          candidateIdentity(candidate,) {
            return candidate.identity;
          },
          async resolveFallback({ excludedCandidateIdentities, },) {
            return excludedCandidateIdentities.length === 1
              ? FALLBACK_ONE
              : FALLBACK_TWO;
          },
          async runAttempt({ candidate, },) {
            if (candidate !== FALLBACK_TWO)
              throw new Error(`${candidate.identity} failed`,);
            await Promise.resolve();
            return { approved: false, feedback: 'valid denial', };
          },
          isCandidateUnavailable(error,) {
            return error instanceof CandidateUnavailableError;
          },
        },);
        expect(result.candidateIdentity,).toBe(FALLBACK_TWO.identity,);
        expect(result.verdict,).toEqual({
          approved: false,
          feedback: 'valid denial',
        },);
      },
    },),
    it({
      name: 'runs one fallback when second is unavailable',
      fn: async () => {
        /** Attempted candidate identities. */
        const attempts: string[] = [];
        /** Sole-fallback result. */
        const result = await runReviewWithFallback({
          firstCandidate: FIRST,
          candidateIdentity(candidate,) {
            return candidate.identity;
          },
          async resolveFallback({ excludedCandidateIdentities, },) {
            if (excludedCandidateIdentities.length === 1)
              return FALLBACK_ONE;
            throw new CandidateUnavailableError('no second fallback',);
          },
          async runAttempt({ candidate, },) {
            attempts.push(candidate.identity,);
            if (candidate === FIRST)
              throw new Error('initial failed',);
            return { approved: true, };
          },
          isCandidateUnavailable(error,) {
            return error instanceof CandidateUnavailableError;
          },
        },);
        expect(attempts,).toEqual([FIRST.identity, FALLBACK_ONE.identity,],);
        expect(result.candidateIdentity,).toBe(FALLBACK_ONE.identity,);
      },
    },),
    it({
      name: 'reports complete diagnostics when every attempt fails',
      fn: async () => {
        /** Exhausted-review error. */
        const error = await captureError(async function exhaustReviewers() {
          return runReviewWithFallback({
            firstCandidate: FIRST,
            candidateIdentity(candidate,) {
              return candidate.identity;
            },
            async resolveFallback({ excludedCandidateIdentities, },) {
              return excludedCandidateIdentities.length === 1
                ? FALLBACK_ONE
                : FALLBACK_TWO;
            },
            async runAttempt({ candidate, },) {
              throw new Error(`${candidate.identity} transport failed`,);
            },
            isCandidateUnavailable(candidateError,) {
              return candidateError instanceof CandidateUnavailableError;
            },
          },);
        },);
        expect(error,).toBeInstanceOf(ReviewUnavailableError,);
        if (!(error instanceof ReviewUnavailableError))
          throw new Error('expected ReviewUnavailableError',);
        expect(error.attemptedCandidateIdentities,).toEqual([
          FIRST.identity,
          FALLBACK_ONE.identity,
          FALLBACK_TWO.identity,
        ],);
        expect(error.message,).toContain('test/first transport failed',);
        expect(error.message,).toContain('test/fallback-one transport failed',);
        expect(error.message,).toContain('test/fallback-two transport failed',);
      },
    },),
    it({
      name: 'rejects fallback resolver returning excluded identity',
      fn: async () => {
        /** Duplicate-selection failure. */
        const error = await captureError(async function resolveDuplicate() {
          return runReviewWithFallback({
            firstCandidate: FIRST,
            candidateIdentity(candidate,) {
              return candidate.identity;
            },
            async resolveFallback() {
              return FIRST;
            },
            async runAttempt() {
              throw new Error('initial failed',);
            },
            isCandidateUnavailable(candidateError,) {
              return candidateError instanceof CandidateUnavailableError;
            },
          },);
        },);
        expect(error,).toBeInstanceOf(ReviewUnavailableError,);
        expect((error as Error).message,).toContain('selected excluded candidate',);
      },
    },),
  ],
},);
