/**
 * Bounded availability fallback for structured model review.
 *
 * @module
 */

import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type {
  ReviewWithFallbackOptions,
  ReviewWithFallbackResult,
} from './types.ts';

/**
 * Shared package logger.
 */
const parentLogger = tagged({ tag: 'model-review', },);

/**
 * Fallback orchestration logger.
 */
const l = tagged({
  tag: 'fallback',
  l: parentLogger,
},);

/**
 * Exhausted structured reviewer error with complete attempt audit.
 *
 * @example
 * ```ts
 * throw new ReviewUnavailableError({ attemptedCandidateIdentities: ['a/one'], diagnostics: ['failed'] });
 * ```
 */
class ReviewUnavailableError extends Error {
  /**
   * Candidate identities whose transports started.
   */
  readonly attemptedCandidateIdentities: readonly string[];
  /**
   * Normalized transport, parsing, and selection diagnostics.
   */
  readonly diagnostics: readonly string[];

  /**
   * Create exhausted-reviewer diagnostic.
   *
   * @param attemptedCandidateIdentities - candidates whose transports started
   *
   * @param diagnostics - normalized failure details
   *
   * @param cause - terminal lower-level failure
   *
   * @example
   * ```ts
   * new ReviewUnavailableError({ attemptedCandidateIdentities: ['a/one'], diagnostics: ['timeout'] });
   * ```
   */
  constructor(
    {
      attemptedCandidateIdentities,
      diagnostics,
      cause,
    }: {
      readonly attemptedCandidateIdentities: readonly string[];
      readonly diagnostics: readonly string[];
      readonly cause?: unknown;
    },
  ) {
    super(
      `Structured review unavailable after attempts by ${attemptedCandidateIdentities.join(', ')}: ${diagnostics.join('; ')}`,
      ...(cause === undefined ? [] : [{ cause, },]),
    );
    this.name = 'ReviewUnavailableError';
    this.attemptedCandidateIdentities = [...attemptedCandidateIdentities,];
    this.diagnostics = [...diagnostics,];
  }
}

/**
 * Successful fallback contender paired with identity.
 *
 * @example
 * ```ts
 * const success: FallbackAttemptSuccess<Candidate, Verdict> = { candidate, candidateIdentity: 'a/one', verdict };
 * ```
 */
type FallbackAttemptSuccess<TCandidate, TVerdict,> = {
  /**
   * Winning candidate.
   */
  readonly candidate: TCandidate;
  /**
   * Canonical winner identity.
   */
  readonly candidateIdentity: string;
  /**
   * Strictly parsed verdict.
   */
  readonly verdict: TVerdict;
};

/**
 * Resolve bounded distinct fallback set before starting any fallback transport.
 *
 * @param options - fallback resolver and identity policy
 *
 * @param excludedCandidateIdentities - initial exclusions
 *
 * @returns selected distinct fallback candidates
 *
 * @example
 * ```ts
 * await resolveFallbackCandidates({ options, excludedCandidateIdentities: ['a/first'] });
 * ```
 */
async function resolveFallbackCandidates<TCandidate, TVerdict,>(
  {
    options,
    excludedCandidateIdentities,
  }: {
    readonly options: ForeignBorrowed<ReviewWithFallbackOptions<TCandidate, TVerdict>>;
    readonly excludedCandidateIdentities: readonly string[];
  },
): Promise<readonly TCandidate[]> {
  try {
    /**
     * First fallback selected outside initial candidate identity.
     */
    const firstCandidate = await options.resolveFallback({
      excludedCandidateIdentities,
    },);
    /**
     * Canonical first-fallback identity.
     */
    const firstIdentity = options.candidateIdentity(firstCandidate,);
    if (excludedCandidateIdentities.includes(firstIdentity,)) {
      throw new Error(
        `Fallback reviewer resolver selected excluded candidate: ${firstIdentity}`,
      );
    }
    try {
      /**
       * Exclusions used to resolve distinct second fallback.
       */
      const secondExclusions = [
        ...excludedCandidateIdentities,
        firstIdentity,
      ];
      /**
       * Second fallback selected before either transport starts.
       */
      const secondCandidate = await options.resolveFallback({
        excludedCandidateIdentities: secondExclusions,
      },);
      /**
       * Canonical second-fallback identity.
       */
      const secondIdentity = options.candidateIdentity(secondCandidate,);
      if (secondExclusions.includes(secondIdentity,)) {
        throw new Error(
          `Fallback reviewer resolver selected excluded candidate: ${secondIdentity}`,
        );
      }
      return [
        firstCandidate,
        secondCandidate,
      ];
    }
    catch (error) {
      if (options.isCandidateUnavailable(error,))
        return [firstCandidate,];
      throw error;
    }
  }
  catch (error) {
    if (options.isCandidateUnavailable(error,))
      return [];
    throw error;
  }
}

/**
 * Run one fallback contender and label failures with candidate identity.
 *
 * @param candidate - selected fallback candidate
 *
 * @param options - caller identity and complete-attempt callbacks
 *
 * @param diagnostics - shared failure audit sink
 *
 * @returns valid verdict paired with candidate
 *
 * @mutates options - attempt callback may update captured state
 *
 * @mutates diagnostics - records normalized contender failures
 *
 * @example
 * ```ts
 * await runFallbackAttempt({ candidate, options, diagnostics });
 * ```
 */
async function runFallbackAttempt<TCandidate, TVerdict,>(
  {
    candidate,
    options,
    diagnostics,
  }: {
    readonly candidate: TCandidate;
    readonly options: ForeignBorrowed<ReviewWithFallbackOptions<TCandidate, TVerdict>>;
    readonly diagnostics: string[];
  },
): Promise<FallbackAttemptSuccess<TCandidate, TVerdict>> {
  /**
   * Canonical contender identity.
   */
  const candidateIdentity = options.candidateIdentity(candidate,);
  /**
   * Per-contender logger.
   */
  const innerL = tagged({
    tag: runFallbackAttempt.name,
    l,
  },);
  innerL.debug(`starting fallback reviewer ${candidateIdentity}`,);
  try {
    return {
      candidate,
      candidateIdentity,
      verdict: await options.runAttempt({ candidate, },),
    };
  }
  catch (error) {
    /**
     * Candidate-labeled normalized error.
     */
    const diagnostic = `${candidateIdentity}: ${caughtValueText(error,)}`;
    diagnostics.push(diagnostic,);
    innerL.error(`fallback reviewer failed: ${diagnostic}`,);
    throw new Error(
      diagnostic,
      { cause: error, },
    );
  }
}

/**
 * Run initial reviewer and bounded concurrent availability fallbacks.
 *
 * @param options - candidate selection, identity, availability, and attempt policy
 *
 * @returns first valid verdict with reviewer audit
 *
 * @mutates options - caller callbacks may update captured selection and transport state
 *
 * @throws {@link ReviewUnavailableError} when no candidate returns valid verdict
 *
 * @example
 * ```ts
 * const result = await runReviewWithFallback(options);
 * ```
 */
async function runReviewWithFallback<TCandidate, TVerdict,>(
  options: ReviewWithFallbackOptions<TCandidate, TVerdict>,
): Promise<ReviewWithFallbackResult<TCandidate, TVerdict>> {
  /**
   * Initial candidate identity.
   */
  const firstIdentity = options.candidateIdentity(options.firstCandidate,);
  /**
   * Candidate identities whose transports started.
   */
  const attemptedCandidateIdentities: string[] = [firstIdentity,];
  /**
   * Normalized failure audit.
   */
  const diagnostics: string[] = [];
  /**
   * Per-call fallback logger.
   */
  const innerL = tagged({
    tag: runReviewWithFallback.name,
    l,
  },);

  try {
    return {
      verdict: await options.runAttempt({ candidate: options.firstCandidate, },),
      candidate: options.firstCandidate,
      candidateIdentity: firstIdentity,
      usedFallback: false,
      attemptedCandidateIdentities,
    };
  }
  catch (error) {
    diagnostics.push(`${firstIdentity}: ${caughtValueText(error,)}`,);
    innerL.error(`initial reviewer failed: ${diagnostics[0]}`,);
  }

  /**
   * Fallback selection result preserving failures without function-root mutation.
   */
  const fallbackSelection = await (async function selectFallbacks(): Promise<
    | {
      readonly ok: true;
      readonly candidates: readonly TCandidate[];
    }
    | {
      readonly ok: false;
      readonly error: unknown;
    }
  > {
    try {
      return {
        ok: true,
        candidates: await resolveFallbackCandidates({
          options,
          excludedCandidateIdentities: [firstIdentity,],
        },),
      };
    }
    catch (error) {
      return {
        ok: false,
        error,
      };
    }
  })();
  if (!fallbackSelection.ok) {
    diagnostics.push(`fallback selection: ${caughtValueText(fallbackSelection.error,)}`,);
    throw new ReviewUnavailableError({
      attemptedCandidateIdentities,
      diagnostics,
      cause: fallbackSelection.error,
    },);
  }
  /**
   * Distinct fallbacks resolved before transport starts.
   */
  const fallbackCandidates = fallbackSelection.candidates;
  if (fallbackCandidates.length === 0) {
    diagnostics.push('no distinct fallback reviewer is available',);
    throw new ReviewUnavailableError({
      attemptedCandidateIdentities,
      diagnostics,
    },);
  }

  attemptedCandidateIdentities.push(
    ...fallbackCandidates.map(function fallbackIdentity(candidate,) {
      return options.candidateIdentity(candidate,);
    },),
  );

  try {
    /**
     * First fulfilled valid verdict; rejected transports do not settle race.
     */
    const winner = await Promise.any(
      fallbackCandidates.map(function startFallback(candidate,) {
        return runFallbackAttempt({
          candidate,
          options,
          diagnostics,
        },);
      },),
    );
    innerL.debug(`fallback reviewer race winner: ${winner.candidateIdentity}`,);
    return {
      verdict: winner.verdict,
      candidate: winner.candidate,
      candidateIdentity: winner.candidateIdentity,
      usedFallback: true,
      attemptedCandidateIdentities,
    };
  }
  catch (error) {
    throw new ReviewUnavailableError({
      attemptedCandidateIdentities,
      diagnostics,
      cause: error,
    },);
  }
}

export {
  ReviewUnavailableError,
  runReviewWithFallback,
};
