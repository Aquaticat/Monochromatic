/**
 * Artifact reader that builds viewer data from enriched artifact directories.
 *
 * Walks `src/canary-lint/` and groups artifacts by (model, timestamp) to form
 * run entries. Enriched artifacts provide scores, reasoning, timing, and usage.
 * Old pre-enrichment artifacts degrade gracefully with score defaulting to 0.
 *
 * Exceeds 100 lines: single cohesive reader pipeline; splitting would scatter
 * the grouping logic across files with no clear ownership boundary.
 */
import type { Dirent, } from 'node:fs';
import { readdir, readFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import { LINT_DIR, } from '@monochromatic-dev/dev-script-inference-canary/src/linter-artifacts.ts';
import type { ArtifactMeta, EnrichedArtifactMeta, FailureArtifactMeta, } from '@monochromatic-dev/dev-script-inference-canary/src/linter-artifacts.ts';

import type { ArtifactData, ProbeDetail, ViewerEntry, } from './viewer-types.ts';

export { LINT_DIR, };

//region Type guards -- distinguish enriched, failure, and basic artifact metadata

/** Whether a parsed meta.json is an enriched artifact (has score field) */
function isEnriched(meta: ArtifactMeta): meta is EnrichedArtifactMeta {
  return 'score' in meta;
}

/** Whether a parsed meta.json is a whole-model failure artifact */
function isFailure(meta: Record<string, unknown>): meta is FailureArtifactMeta {
  return meta['failed'] === true;
}

//endregion Type guards

/**
 * Reads a file, returning undefined on any error.
 * @param path - absolute file path
 * @returns file contents or undefined
 */
async function readOptional(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    // ENOENT is expected for optional files (e.g. canary.ts not saved in old artifacts)
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      console.error(`[viewer] failed to read ${path}:`, error);
    }
    return undefined;
  }
}

/** Parsed artifact with metadata, optional source/response, and directory path */
type ParsedArtifact = {
  readonly meta: ArtifactMeta | EnrichedArtifactMeta;
  readonly source: string | undefined;
  readonly response: string | undefined;
  readonly dir: string;
};

/**
 * Composite key for grouping probe details: `label::probe::timestamp`.
 * @param label - model label
 * @param probe - probe name
 * @param timestamp - ISO timestamp
 * @returns composite key string
 *
 * @example
 * ```ts
 * probeKey('Sonnet 4.6', 'csv-rfc4180', '2026-03-06T12:00:00.000Z');
 * // "Sonnet 4.6::csv-rfc4180::2026-03-06T12:00:00.000Z"
 * ```
 */
export function probeKey(label: string, probe: string, timestamp: string): string {
  return `${label}::${probe}::${timestamp}`;
}

/**
 * Reads all artifacts from the canary lint directory and builds viewer data.
 *
 * Groups artifacts by (model, timestamp) to reconstruct per-run entries.
 * Computes overall scores as the mean of per-probe initial-pass scores.
 * @returns entries for charts/tables and per-probe details for overlays
 */
export async function readArtifacts(): Promise<ArtifactData> {
  /** Initial-pass artifacts grouped by run key (model::timestamp) then by probe name */
  const initialByRun = new Map<string, Map<string, ParsedArtifact>>();
  /** Fix-pass artifacts grouped identically */
  const fixByRun = new Map<string, Map<string, ParsedArtifact>>();
  /** Whole-model failure artifacts */
  const failures: FailureArtifactMeta[] = [];

  let modelDirents: Dirent[];
  try {
    modelDirents = await readdir(LINT_DIR, { withFileTypes: true, });
  } catch {
    console.error('[viewer] no artifact directory found, skipping artifact loading');
    return { entries: [], probeDetails: new Map(), };
  }

  for (const modelDirent of modelDirents.filter(function isDir(dirent) { return dirent.isDirectory(); })) {
    const modelPath = join(LINT_DIR, modelDirent.name);
    let subdirents: Dirent[];
    try {
      subdirents = await readdir(modelPath, { withFileTypes: true, });
    } catch (error) {
      console.error(`[viewer] failed to read model directory ${modelPath}:`, error);
      continue;
    }

    for (const subdirent of subdirents.filter(function isDir(dirent) { return dirent.isDirectory(); })) {
      const dirPath = join(modelPath, subdirent.name);
      const metaRaw = await readOptional(join(dirPath, 'meta.json'));
      if (metaRaw === undefined) continue;

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(metaRaw) as Record<string, unknown>;
      } catch (error) {
        console.error(`[viewer] malformed meta.json in ${dirPath}:`, error);
        continue;
      }

      if (isFailure(parsed)) {
        failures.push(parsed);
        continue;
      }

      // Old artifacts without label fall back to the directory name
      const meta: ArtifactMeta | EnrichedArtifactMeta = {
        ...(parsed as ArtifactMeta | EnrichedArtifactMeta),
        label: (parsed as ArtifactMeta).label ?? modelDirent.name,
      };
      const [source, response] = await Promise.all([
        readOptional(join(dirPath, 'canary.ts')),
        readOptional(join(dirPath, 'response.txt')),
      ]);
      const artifact: ParsedArtifact = { meta, source, response, dir: dirPath, };
      const runKey = `${meta.label}::${meta.timestamp}`;

      const target = meta.pass === 'initial' ? initialByRun : fixByRun;
      const probes = target.get(runKey) ?? new Map<string, ParsedArtifact>();
      probes.set(meta.probe, artifact);
      target.set(runKey, probes);
    }
  }

  return buildViewerData(initialByRun, fixByRun, failures);
}

/**
 * Assembles viewer entries and probe details from grouped artifacts.
 * @param initialByRun - initial-pass artifacts grouped by run key
 * @param fixByRun - fix-pass artifacts grouped by run key
 * @param failures - whole-model failure metadata
 * @returns assembled viewer data
 */
function buildViewerData(
  initialByRun: ReadonlyMap<string, ReadonlyMap<string, ParsedArtifact>>,
  fixByRun: ReadonlyMap<string, ReadonlyMap<string, ParsedArtifact>>,
  failures: readonly FailureArtifactMeta[],
): ArtifactData {
  const entries: ViewerEntry[] = [];
  const probeDetails = new Map<string, ProbeDetail>();

  for (const [runKey, probes] of initialByRun) {
    const fixes = fixByRun.get(runKey) ?? new Map<string, ParsedArtifact>();
    const firstProbe = probes.values().next().value as ParsedArtifact | undefined;
    if (firstProbe === undefined) continue;

    const { model, label, timestamp, } = firstProbe.meta;
    const probeScores: Record<string, number> = {};
    const pass2Scores: Record<string, number> = {};
    let config: ViewerEntry['config'];
    let hasPass2 = false;

    for (const [probeName, artifact] of probes) {
      const enriched = isEnriched(artifact.meta) ? artifact.meta : undefined;
      probeScores[probeName] = enriched?.score ?? 0;
      if (enriched?.config !== undefined) ({ config } = enriched);

      const fix = fixes.get(probeName);
      const fixEnriched = fix !== undefined && isEnriched(fix.meta) ? fix.meta : undefined;
      if (fixEnriched?.score !== undefined) {
        pass2Scores[probeName] = fixEnriched.score;
        hasPass2 = true;
      }

      probeDetails.set(probeKey(label, probeName, timestamp), {
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
      });
    }

    const scores = Object.values(probeScores);
    const overallScore = scores.length > 0
      ? scores.reduce(function addScore(sum, score) { return sum + score; }, 0) / scores.length
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
    });
  }

  for (const failure of failures) {
    entries.push({
      timestamp: failure.timestamp,
      model: failure.model,
      label: (failure as unknown as { label?: string }).label ?? failure.model,
      overallScore: 0,
      probeScores: {},
      failed: true,
      error: failure.error,
      config: failure.config,
    });
  }

  entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  console.error(`[viewer] loaded ${String(entries.length)} runs, ${String(probeDetails.size)} probe details`);
  return { entries, probeDetails, };
}
