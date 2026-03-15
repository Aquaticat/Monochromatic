/**
 * Assembles viewer entries and probe details from grouped artifact data.
 *
 * Takes pre-grouped initial-pass and fix-pass artifacts and produces
 * the final viewer data structure consumed by chart and overlay renderers.
 */
import {
  type ArtifactMeta,
  type EnrichedArtifactMeta,
  type FailureArtifactMeta,
  LINT_DIR,
} from '@monochromatic-dev/dev-script-inference-canary/src/linter-artifacts.ts';

import type {
  ArtifactData,
  ProbeDetail,
  ViewerEntry,
} from './viewer-types.ts';

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
 * Assembles viewer entries and probe details from grouped artifacts.
 *
 * @param initialByRun - initial-pass artifacts grouped by run key
 *
 * @param fixByRun - fix-pass artifacts grouped by run key
 *
 * @param failures - whole-model failure metadata
 *
 * @returns assembled viewer data
 */
export function buildViewerData(
  initialByRun: ReadonlyMap<string, ReadonlyMap<string, ParsedArtifact>>,
  fixByRun: ReadonlyMap<string, ReadonlyMap<string, ParsedArtifact>>,
  failures: readonly FailureArtifactMeta[],
): ArtifactData {
  const entries: ViewerEntry[] = [];
  const probeDetails = new Map<string, ProbeDetail>();

  for (const [runKey, probes,] of initialByRun) {
    const fixes = fixByRun.get(runKey,) ?? new Map<string, ParsedArtifact>();
    const firstProbe = probes.values().next().value;
    if (firstProbe === undefined)
      continue;

    const { model, label, timestamp, } = firstProbe.meta;
    const probeScores: Record<string, number> = {};
    const pass2Scores: Record<string, number> = {};
    let config: ViewerEntry['config'];
    let hasPass2 = false;

    for (const [probeName, artifact,] of probes) {
      const enriched = isEnriched(artifact.meta,) ? artifact.meta : undefined;
      probeScores[probeName] = enriched?.score ?? 0;
      if (enriched?.config !== undefined)
        ({ config, } = enriched);

      const fix = fixes.get(probeName,);
      const fixEnriched = fix !== undefined && isEnriched(fix.meta,)
        ? fix.meta
        : undefined;
      if (fixEnriched?.score !== undefined) {
        pass2Scores[probeName] = fixEnriched.score;
        hasPass2 = true;
      }

      probeDetails.set(probeKey(label, probeName, timestamp,), {
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
      },);
    }

    const scores = Object.values(probeScores,);
    const overallScore = scores.length > 0
      ? scores.reduce(function addScore(sum, score,) {
        return sum + score;
      }, 0,) / scores.length
      : 0;

    entries.push({
      timestamp,
      model,
      label,
      overallScore,
      probeScores,
      ...(hasPass2 ? { pass2Scores, } : {}),
      failed: false,
      config,
    },);
  }

  for (const failure of failures) {
    entries.push({
      timestamp: failure.timestamp,
      model: failure.model,
      label: (failure as unknown as { label?: string; }).label ?? failure.model,
      overallScore: 0,
      probeScores: {},
      failed: true,
      error: failure.error,
      config: failure.config,
    },);
  }

  entries.sort(function byTimestamp(a, b,) {
    return a.timestamp.localeCompare(b.timestamp,);
  },);

  console.error(
    `[viewer] loaded ${String(entries.length,)} runs, ${
      String(probeDetails.size,)
    } probe details`,
  );
  return { entries, probeDetails, };
}
