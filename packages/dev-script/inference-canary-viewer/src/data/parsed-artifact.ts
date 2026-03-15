/**
 * Parsed artifact types and enrichment helpers for viewer data assembly.
 *
 * Provides the intermediate artifact type used during directory scanning
 * and helper functions for identifying enriched artifacts and building
 * composite grouping keys.
 */
import type {
  ArtifactMeta,
  EnrichedArtifactMeta,
} from '@monochromatic-dev/dev-script-inference-canary/src/linter-artifacts.ts';

import type { ProbeDetail, } from './viewer-types.ts';

/** Parsed artifact with metadata, optional source/response, and directory path */
export type ParsedArtifact = {
  readonly meta: ArtifactMeta | EnrichedArtifactMeta;
  readonly source: string | undefined;
  readonly response: string | undefined;
  readonly dir: string;
};

/**
 * Whether a parsed meta.json is an enriched artifact (has score field).
 *
 * @param meta - artifact metadata to check
 *
 * @returns true when the metadata includes score (enriched form)
 */
export function isEnriched(meta: ArtifactMeta,): meta is EnrichedArtifactMeta {
  return 'score' in meta;
}

/**
 * Composite key for grouping probe details: `label::probe::timestamp`.
 *
 * @param label - model label
 *
 * @param probe - probe name
 *
 * @param timestamp - ISO timestamp
 *
 * @returns composite key string
 *
 * @example
 * ```ts
 * probeKey('Sonnet 4.6', 'csv-rfc4180', '2026-03-06T12:00:00.000Z');
 * // "Sonnet 4.6::csv-rfc4180::2026-03-06T12:00:00.000Z"
 * ```
 */
export function probeKey(label: string, probe: string, timestamp: string,): string {
  return `${label}::${probe}::${timestamp}`;
}

/**
 * Assembles a probe detail record from initial and fix pass artifacts.
 *
 * @param enriched - enriched metadata from initial pass (undefined for old artifacts)
 *
 * @param fixEnriched - enriched metadata from fix pass (undefined when no fix ran)
 *
 * @param artifact - initial pass artifact with source and response
 *
 * @param fix - fix pass artifact (undefined when no fix ran)
 *
 * @returns probe detail for the overlay renderer
 */
export function buildProbeDetail({ enriched, fixEnriched, artifact, fix, }: {
  enriched: EnrichedArtifactMeta | undefined;
  fixEnriched: EnrichedArtifactMeta | undefined;
  artifact: ParsedArtifact;
  fix: ParsedArtifact | undefined;
},): ProbeDetail {
  return {
    score: enriched?.score,
    pass2Score: fixEnriched?.score,
    reasoning: enriched?.reasoning,
    timing: enriched?.timing,
    usage: enriched?.usage,
    finishReason: enriched?.finishReason,
    config: enriched?.config,
    fixPrompt: fixEnriched?.fixPrompt,
    fixReasoning: fixEnriched?.reasoning,
    fixTiming: fixEnriched?.timing,
    fixUsage: fixEnriched?.usage,
    fixFinishReason: fixEnriched?.finishReason,
    initialResponse: artifact.response,
    fixResponse: fix?.response,
    initialSource: artifact.source,
    fixSource: fix?.source,
    initialDir: artifact.dir,
    fixDir: fix?.dir,
    partial: enriched?.partial,
    error: enriched?.error,
  };
}
