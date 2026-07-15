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
} from '@monochromatic-dev/dev-script-inference-canary/ts';

import type { ProbeDetail, } from './viewer-types.ts';

/**
 * Parsed artifact with metadata, optional source/response, and directory path
 */
export type ParsedArtifact = {
  readonly meta: ArtifactMeta | EnrichedArtifactMeta;
  readonly source?: string;
  readonly response?: string;
  readonly dir: string;
};

/**
 * Whether a parsed meta.json is an enriched artifact (has score field).
 *
 * @param meta - artifact metadata to check
 *
 * @returns true when the metadata includes score (enriched form)
 *
 * @example
 * ```ts
 * isEnriched({ model: 'm', label: 'M', probe: 'p', timestamp: 't', pass: 'initial' }); // false
 * isEnriched({ model: 'm', label: 'M', probe: 'p', timestamp: 't', pass: 'initial', score: 0.9 }); // true
 * ```
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
 * probeKey({ label: 'Sonnet 4.6', probe: 'csv-rfc4180', timestamp: '2026-03-06T12:00:00.000Z', });
 * // "Sonnet 4.6::csv-rfc4180::2026-03-06T12:00:00.000Z"
 * ```
 */
export function probeKey({
  label,
  probe,
  timestamp,
}: {
  readonly label: string;
  readonly probe: string;
  readonly timestamp: string;
},): string {
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
 *
 * @example
 * ```ts
 * const detail = buildProbeDetail({ enriched: meta, fixEnriched: undefined, artifact, fix: undefined });
 * // { score: 0.85, reasoning: '...', initialDir: '...' } (pass2Score omitted: no fix pass)
 * ```
 */
export function buildProbeDetail({
  enriched,
  fixEnriched,
  artifact,
  fix,
}: {
  readonly enriched?: EnrichedArtifactMeta;
  readonly fixEnriched?: EnrichedArtifactMeta;
  readonly artifact: ParsedArtifact;
  readonly fix?: ParsedArtifact;
},): ProbeDetail {
  return {
    initialDir: artifact.dir,
    ...(enriched?.score !== undefined ? { score: enriched.score, } : {}),
    ...(fixEnriched?.score !== undefined ? { pass2Score: fixEnriched.score, } : {}),
    ...(enriched?.reasoning !== undefined ? { reasoning: enriched.reasoning, } : {}),
    ...(enriched?.timing !== undefined ? { timing: enriched.timing, } : {}),
    ...(enriched?.usage !== undefined ? { usage: enriched.usage, } : {}),
    ...(enriched?.finishReason !== undefined ? { finishReason: enriched.finishReason, } : {}),
    ...(enriched?.config !== undefined ? { config: enriched.config, } : {}),
    ...(fixEnriched?.fixPrompt !== undefined ? { fixPrompt: fixEnriched.fixPrompt, } : {}),
    ...(fixEnriched?.reasoning !== undefined ? { fixReasoning: fixEnriched.reasoning, } : {}),
    ...(fixEnriched?.timing !== undefined ? { fixTiming: fixEnriched.timing, } : {}),
    ...(fixEnriched?.usage !== undefined ? { fixUsage: fixEnriched.usage, } : {}),
    ...(fixEnriched?.finishReason !== undefined ? { fixFinishReason: fixEnriched.finishReason, } : {}),
    ...(artifact.response !== undefined ? { initialResponse: artifact.response, } : {}),
    ...(fix?.response !== undefined ? { fixResponse: fix.response, } : {}),
    ...(artifact.source !== undefined ? { initialSource: artifact.source, } : {}),
    ...(fix?.source !== undefined ? { fixSource: fix.source, } : {}),
    ...(fix?.dir !== undefined ? { fixDir: fix.dir, } : {}),
    ...(enriched?.partial !== undefined ? { partial: enriched.partial, } : {}),
    ...(enriched?.error !== undefined ? { error: enriched.error, } : {}),
  };
}
