/**
 * Probe artifact enrichment and failure persistence.
 *
 * Handles writing enriched metadata (score, timing, usage, config) to artifact
 * directories, extracting partial completion data from aborted streams, and
 * saving whatever data was collected before a probe failure.
 */
import {
  type EnrichedArtifactMeta,
  writeEnrichedArtifact,
} from './linter-artifacts.ts';
import { PartialCompletionError, } from './runner-stream-helpers.ts';

import type { Probe, } from './probes.ts';
import type { RunnerConfig, } from './runner-config.ts';
import type {
  CompletionResult,
  ConfigSnapshot,
} from './runner-types.ts';

/**
 * Builds a {@link ConfigSnapshot} from the runner configuration.
 *
 * @param config - full runner configuration
 *
 * @returns snapshot of the fields relevant for reproducibility
 */
function snapshotConfig(config: RunnerConfig,): ConfigSnapshot {
  return {
    verbosity: config.verbosity,
    reasoning: config.reasoning,
    maxTokens: config.maxTokens,
    consistencyRuns: config.consistencyRuns,
  };
}

/**
 * Options for {@link enrichArtifact}.
 *
 * @example
 * ```ts
 * const opts: EnrichArtifactOptions = {
 *   probe: cssMixinProbe,
 *   config: runnerConfig,
 *   timestamp: '2025-09-21T11:13:00Z',
 *   pass: 'initial',
 *   completion: completionResult,
 *   score: 0.85,
 * };
 * ```
 */
export type EnrichArtifactOptions = {
  /**
   * Probe that produced the response
   */
  readonly probe: Probe;
  /**
   * Runner configuration
   */
  readonly config: RunnerConfig;
  /**
   * Authoritative server timestamp
   */
  readonly timestamp: string;
  /**
   * Which pass produced the response
   */
  readonly pass: 'initial' | 'fix';
  /**
   * Full completion result from the API
   */
  readonly completion: CompletionResult;
  /**
   * Computed score for this response
   */
  readonly score: number;
  /**
   * Optional fields for fix prompt, partial flag, and error message
   */
  readonly options?: {
    readonly fixPrompt?: string;
    readonly partial?: boolean;
    readonly error?: string;
  };
};

/**
 * Writes an enriched artifact for a single probe execution (initial or fix pass).
 *
 * @param probe - probe that produced the response
 *
 * @param config - runner configuration
 *
 * @param timestamp - authoritative server timestamp
 *
 * @param pass - which pass produced the response
 *
 * @param completion - full completion result from the API
 *
 * @param score - computed score for this response
 *
 * @param options - optional fields for fix prompt, partial flag, and error message
 *
 * @example
 * ```ts
 * await enrichArtifact({ probe, config, timestamp, pass: 'initial', completion, score: 0.85 });
 * ```
 */
export async function enrichArtifact({
  probe,
  config,
  timestamp,
  pass,
  completion,
  score,
  options,
}: EnrichArtifactOptions,): Promise<void> {
  /**
   * Token usage and stop reason, spread into the artifact only when present so absent keys stay out of the JSON.
   */
  const {
    usage,
    finishReason,
  } = completion;
  /**
   * Full enriched artifact written to disk; optional fields are spread in conditionally to keep absent fields out of JSON.
   */
  const enriched: EnrichedArtifactMeta = {
    model: config.model,
    label: config.label,
    probe: probe.name,
    pass,
    timestamp,
    score,
    reasoning: completion.reasoning,
    timing: completion.timing,
    ...(usage !== undefined ? { usage, } : {}),
    ...(finishReason !== undefined ? { finishReason, } : {}),
    config: snapshotConfig(config,),
    ...(options?.fixPrompt
      !== undefined ? { fixPrompt: options.fixPrompt, } : {}),
    ...(options?.partial
      === true ? { partial: true, } : {}),
    ...(options?.error
      !== undefined ? { error: options.error, } : {}),
  };
  await writeEnrichedArtifact({
    enriched,
    rawResponse: completion.text,
  },);
}

/**
/**
 * Sentinel returned by {@link extractPartialCompletion} when the caught error is
 * not a {@link PartialCompletionError}. A unique symbol keeps the "no partial"
 * outcome out of the result's value space without a banned nullish union.
 */
export const NO_PARTIAL: unique symbol = Symbol('no-partial',);

/**
 * Extracts a {@link CompletionResult} from an error if it is a
 * {@link PartialCompletionError}, otherwise returns {@link NO_PARTIAL}.
 *
 * @param error - caught error value
 *
 * @returns partial completion result, or {@link NO_PARTIAL} for non-partial errors
 *
 * @example
 * ```ts
 * const partial = extractPartialCompletion(caughtError);
 * if (partial !== NO_PARTIAL) savePartialData(partial);
 * ```
 */
export function extractPartialCompletion(error: unknown,): CompletionResult | typeof NO_PARTIAL {
  if (error instanceof PartialCompletionError)
    return error.partialResult;
  return NO_PARTIAL;
}

/**
 * Options for {@link saveFailureArtifacts}.
 *
 * @example
 * ```ts
 * const opts: SaveFailureArtifactsOptions = {
 *   probe: cssMixinProbe,
 *   config: runnerConfig,
 *   timestamp: '2025-09-21T11:13:00Z',
 *   error: new Error('timeout'),
 *   lastCompletion,
 *   partialCompletion: NO_PARTIAL,
 *   lastScore: 0.5,
 *   enrichedInitial: false,
 * };
 * ```
 */
type SaveFailureArtifactsOptions = {
  /**
   * Probe being executed
   */
  readonly probe: Probe;
  /**
   * Runner configuration
   */
  readonly config: RunnerConfig;
  /**
   * Authoritative server timestamp
   */
  readonly timestamp: string;
  /**
   * The caught error
   */
  readonly error: unknown;
  /**
   * Completion from the last successful consistency run, absent when none completed
   */
  readonly lastCompletion?: CompletionResult;
  /**
   * Partial completion extracted from a PartialCompletionError, {@link NO_PARTIAL} when absent
   */
  readonly partialCompletion: CompletionResult | typeof NO_PARTIAL;
  /**
   * Score from the last successful consistency run
   */
  readonly lastScore: number;
  /**
   * Whether the initial-pass artifact was already enriched
   */
  readonly enrichedInitial: boolean;
};

/**
 * Saves whatever data was collected before a probe failure.
 *
 * For completed consistency runs, the last run's completion is already enriched
 * during the normal flow. This function handles the partial/failed case: it writes
 * the partial completion (if any) with `partial: true` and the error message.
 *
 * @param probe - probe being executed
 *
 * @param config - runner configuration
 *
 * @param timestamp - authoritative server timestamp
 *
 * @param error - the caught error
 *
 * @param lastCompletion - completion from the last successful consistency run (if any)
 *
 * @param partialCompletion - partial completion extracted from a PartialCompletionError
 *
 * @param lastScore - score from the last successful consistency run
 *
 * @param enrichedInitial - whether the initial-pass artifact was already enriched
 *
 * @example
 * ```ts
 * await saveFailureArtifacts({ probe, config, timestamp, error, lastCompletion, partialCompletion: partial, lastScore: 0.5, enrichedInitial: false });
 * ```
 */
export async function saveFailureArtifacts({
  probe,
  config,
  timestamp,
  error,
  lastCompletion,
  partialCompletion,
  lastScore,
  enrichedInitial,
}: SaveFailureArtifactsOptions,): Promise<void> {
  /**
   * Human-readable error string written into the failure artifact for post-hoc inspection.
   */
  const errorMessage = error instanceof Error ? error.message : String(error,);

  // If we have a partial completion from an aborted stream, save it.
  // This captures the mid-stream response that would otherwise be lost.
  if (partialCompletion !== NO_PARTIAL) {
    await enrichArtifact({
      probe,
      config,
      timestamp,
      pass: 'initial',
      completion: partialCompletion,
      score: 0,
      options: {
        partial: true,
        error: errorMessage,
      },
    },);
    return;
  }

  // If we completed at least one run but haven't enriched the artifact yet, do it now.
  if ((lastCompletion !== undefined) && (!enrichedInitial)) {
    await enrichArtifact({
      probe,
      config,
      timestamp,
      pass: 'initial',
      completion: lastCompletion,
      score: lastScore,
      options: {
        error: errorMessage,
      },
    },);
  }
}
