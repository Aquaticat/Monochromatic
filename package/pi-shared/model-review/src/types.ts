/**
 * Public contracts for shared structured model review.
 *
 * @module
 */

import type {
  Api,
  Model,
  ProviderStreams,
  Tool,
} from '@earendil-works/pi-ai';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

//region Structured attempt contracts

/**
 * Provider credentials resolved by a caller before review transport.
 *
 * @example
 * ```ts
 * const auth: StructuredReviewAuth = { apiKey: 'token' };
 * ```
 */
type StructuredReviewAuth = {
  /**
   * Provider API key when required.
   */
  readonly apiKey?: string;
  /**
   * Provider headers when required.
   */
  readonly headers?: Readonly<Record<string, string>>;
};

/**
 * One provider prompt used by structured or direct-JSON transport.
 *
 * @example
 * ```ts
 * const prompt: StructuredReviewPrompt = {
 *   systemPrompt: 'Judge independently.',
 *   userContent: 'Review this evidence.',
 * };
 * ```
 */
type StructuredReviewPrompt = {
  /**
   * Reviewer system instructions.
   */
  readonly systemPrompt: string;
  /**
   * Reviewer user-message body.
   */
  readonly userContent: string;
};

/**
 * Inputs available when a caller builds direct-JSON retry instructions.
 *
 * @example
 * ```ts
 * contract.buildJsonRetryPrompt({ initialPrompt, firstAttemptTextContent: '' });
 * ```
 */
type StructuredReviewPromptInput = {
  /**
   * Original structured-tool prompt.
   */
  readonly initialPrompt: StructuredReviewPrompt;
  /**
   * Text returned when initial response omitted forced tool.
   */
  readonly firstAttemptTextContent: string;
};

/**
 * Caller-owned structured verdict contract.
 *
 * @example
 * ```ts
 * const contract: StructuredReviewContract<Verdict> = {
 *   toolName: 'submit_verdict',
 *   tool,
 *   parse: parseVerdict,
 *   buildJsonRetryPrompt,
 * };
 * ```
 */
type StructuredReviewContract<TVerdict,> = {
  /**
   * Exact tool name expected from structured response.
   */
  readonly toolName: string;
  /**
   * Pi AI tool exposed only to reviewer.
   */
  readonly tool: Tool;
  /**
   * Strict parser converting unknown tool or JSON data to verdict.
   */
  readonly parse: (value: unknown) => TVerdict;
  /**
   * Caller-specific prompt used after omitted structured tool.
   */
  readonly buildJsonRetryPrompt: (
    input: StructuredReviewPromptInput,
  ) => StructuredReviewPrompt;
};

/**
 * Stream function seam used by production provider dispatch and deterministic tests.
 *
 * @example
 * ```ts
 * const stream: StructuredReviewStream = provider.streamSimple;
 * ```
 */
type StructuredReviewStream = ProviderStreams['streamSimple'];

/**
 * Complete options for one structured reviewer candidate.
 *
 * @example
 * ```ts
 * await runStructuredReviewAttempt({ model, auth, prompt, contract, timeoutMs: 10_000 });
 * ```
 */
type StructuredReviewAttemptOptions<TVerdict,> = {
  /**
   * Selected reviewer model.
   */
  readonly model: ForeignBorrowed<Model<Api>>;
  /**
   * Resolved reviewer credentials.
   */
  readonly auth: ForeignBorrowed<StructuredReviewAuth>;
  /**
   * Initial structured-tool prompt.
   */
  readonly prompt: StructuredReviewPrompt;
  /**
   * Goal-agnostic verdict contract.
   */
  readonly contract: ForeignBorrowed<StructuredReviewContract<TVerdict>>;
  /**
   * Timeout covering forced-tool and JSON retries.
   */
  readonly timeoutMs: number;
  /**
   * Optional provider output cap.
   */
  readonly maxOutputTokens?: number;
  /**
   * Optional caller cancellation signal.
   */
  readonly signal?: AbortSignal;
  /**
   * Injected stream adapter for deterministic tests.
   */
  readonly stream?: ForeignBorrowed<StructuredReviewStream>;
};

//endregion Structured attempt contracts

//region Fallback orchestration contracts

/**
 * Valid review paired with candidate identity and attempt audit.
 *
 * @example
 * ```ts
 * if (result.usedFallback) console.log(result.candidateIdentity);
 * ```
 */
type ReviewWithFallbackResult<TCandidate, TVerdict,> = {
  /**
   * Parsed valid verdict.
   */
  readonly verdict: TVerdict;
  /**
   * Candidate that supplied verdict.
   */
  readonly candidate: TCandidate;
  /**
   * Canonical identity of winning candidate.
   */
  readonly candidateIdentity: string;
  /**
   * Whether winning candidate came from fallback race.
   */
  readonly usedFallback: boolean;
  /**
   * Candidate identities whose transports started.
   */
  readonly attemptedCandidateIdentities: readonly string[];
};

/**
 * Options for one initial reviewer plus bounded availability fallback.
 *
 * @example
 * ```ts
 * await runReviewWithFallback({ firstCandidate, candidateIdentity, resolveFallback, runAttempt });
 * ```
 */
type ReviewWithFallbackOptions<TCandidate, TVerdict,> = {
  /**
   * Initially selected candidate.
   */
  readonly firstCandidate: TCandidate;
  /**
   * Stable canonical identity function.
   */
  readonly candidateIdentity: (candidate: TCandidate) => string;
  /**
   * Resolve one candidate outside supplied exclusions.
   */
  readonly resolveFallback: (
    options: { readonly excludedCandidateIdentities: readonly string[]; },
  ) => Promise<TCandidate>;
  /**
   * Run complete transport and strict parsing for one candidate.
   */
  readonly runAttempt: (
    options: { readonly candidate: TCandidate; },
  ) => Promise<TVerdict>;
  /**
   * Classify resolver failure as exhausted candidate availability.
   */
  readonly isCandidateUnavailable: (error: unknown) => boolean;
};

//endregion Fallback orchestration contracts

export type {
  ReviewWithFallbackOptions,
  ReviewWithFallbackResult,
  StructuredReviewAttemptOptions,
  StructuredReviewAuth,
  StructuredReviewContract,
  StructuredReviewPrompt,
  StructuredReviewPromptInput,
  StructuredReviewStream,
};
