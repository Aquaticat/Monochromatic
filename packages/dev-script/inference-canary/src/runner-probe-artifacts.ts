/**
 * Probe artifact enrichment and failure persistence.
 *
 * Handles writing enriched metadata (score, timing, usage, config) to artifact
 * directories, extracting partial completion data from aborted streams, and
 * saving whatever data was collected before a probe failure.
 */
import { PartialCompletionError, } from './runner-stream-helpers.ts';
import { writeEnrichedArtifact, type EnrichedArtifactMeta, } from './linter-artifacts.ts';

import type { CompletionResult, ConfigSnapshot, } from './runner-types.ts';
import type { RunnerConfig, } from './runner-config.ts';
import type { Probe, } from './probes.ts';

/**
 * Builds a {@link ConfigSnapshot} from the runner configuration.
 *
 * @param config - full runner configuration
 *
 * @returns snapshot of the fields relevant for reproducibility
 */
function snapshotConfig(config: RunnerConfig): ConfigSnapshot {
  return {
    verbosity: config.verbosity,
    reasoning: config.reasoning,
    maxTokens: config.maxTokens,
    consistencyRuns: config.consistencyRuns,
  };
}

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
 */
export async function enrichArtifact(
  probe: Probe,
  config: RunnerConfig,
  timestamp: string,
  pass: 'initial' | 'fix',
  completion: CompletionResult,
  score: number,
  options?: { fixPrompt?: string; partial?: boolean; error?: string; },
): Promise<void> {
  const enriched: EnrichedArtifactMeta = {
    model: config.model,
    label: config.label,
    probe: probe.name,
    pass,
    timestamp,
    score,
    reasoning: completion.reasoning,
    timing: completion.timing,
    usage: completion.usage,
    finishReason: completion.finishReason,
    config: snapshotConfig(config),
    ...(options?.fixPrompt !== undefined ? { fixPrompt: options.fixPrompt, } : {}),
    ...(options?.partial === true ? { partial: true, } : {}),
    ...(options?.error !== undefined ? { error: options.error, } : {}),
  };
  await writeEnrichedArtifact(enriched, completion.text);
}

/**
 * Extracts a {@link CompletionResult} from an error if it is a
 * {@link PartialCompletionError}, otherwise returns undefined.
 *
 * @param error - caught error value
 *
 * @returns partial completion result, or undefined for non-partial errors
 */
export function extractPartialCompletion(error: unknown): CompletionResult | undefined {
  if (error instanceof PartialCompletionError) return error.partialResult;
  return undefined;
}

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
 */
export async function saveFailureArtifacts(
  probe: Probe,
  config: RunnerConfig,
  timestamp: string,
  error: unknown,
  lastCompletion: CompletionResult | undefined,
  partialCompletion: CompletionResult | undefined,
  lastScore: number,
  enrichedInitial: boolean,
): Promise<void> {
  const errorMessage = error instanceof Error ? error.message : String(error);

  // If we have a partial completion from an aborted stream, save it.
  // This captures the mid-stream response that would otherwise be lost.
  if (partialCompletion !== undefined) {
    await enrichArtifact(probe, config, timestamp, 'initial', partialCompletion, 0, {
      partial: true,
      error: errorMessage,
    });
    return;
  }

  // If we completed at least one run but haven't enriched the artifact yet, do it now.
  if (lastCompletion !== undefined && !enrichedInitial) {
    await enrichArtifact(probe, config, timestamp, 'initial', lastCompletion, lastScore, {
      error: errorMessage,
    });
  }
}
