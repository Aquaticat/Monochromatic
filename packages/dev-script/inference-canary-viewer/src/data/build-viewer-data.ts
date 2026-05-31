/**
 * Assembles viewer entries and probe details from grouped artifact data.
 *
 * Takes pre-grouped initial-pass and fix-pass artifacts and produces
 * the final viewer data structure consumed by chart and overlay renderers.
 */
import type {
  FailureArtifactMeta,
} from '@monochromatic-dev/dev-script-inference-canary/ts';

import {
  buildProbeDetail,
  isEnriched,
  type ParsedArtifact,
  probeKey,
} from './parsed-artifact.ts';
import type {
  ArtifactData,
  ProbeDetail,
  ViewerEntry,
} from './viewer-types.ts';

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
 *
 * @example
 * ```ts
 * const { entries, probeDetails, } = buildViewerData({ initialByRun, fixByRun, failures, });
 * // entries: ViewerEntry[], probeDetails: Map<string, ProbeDetail>
 * ```
 */
export function buildViewerData({
  initialByRun,
  fixByRun,
  failures,
}: {
  readonly initialByRun: ReadonlyMap<string, ReadonlyMap<string, ParsedArtifact>>;
  readonly fixByRun: ReadonlyMap<string, ReadonlyMap<string, ParsedArtifact>>;
  readonly failures: readonly FailureArtifactMeta[];
},): ArtifactData {
  /**
   * Per-run viewer entries built up below; one entry per initial-pass run plus one per failure.
   */
  const entries: ViewerEntry[] = [];
  /**
   * Per-probe detail records keyed by `probeKey(label, probeName, timestamp)` for overlay lookup.
   */
  const probeDetails = new Map<string, ProbeDetail>();

  for (const [runKey, probes,] of initialByRun) {
    /**
     * Fix-pass artifacts for this run; defaults to empty so runs without a fix pass still process.
     */
    const fixes = fixByRun.get(runKey,)
      ?? new Map<string, ParsedArtifact>();
    /**
     * Sample probe used to read run-level metadata (model, label, timestamp).
     */
    const firstProbe = probes.values()
      .next()
      .value;
    if (firstProbe === undefined)
      continue;

    /**
     * Run-level metadata copied from the first probe in the run.
     */
    const {
      model,
      label,
      timestamp,
    } = firstProbe.meta;
    /**
     * Initial-pass score per probe, populated as the loop processes each probe artifact.
     */
    const probeScores: Record<string, number> = {};
    /**
     * Fix-pass (pass 2) score per probe; populated only when a fix artifact has a score.
     */
    const pass2Scores: Record<string, number> = {};
    /**
     * Probe configuration carried on the run entry; first enriched probe to declare one wins.
     */
    let config: ViewerEntry['config'] = undefined;
    /**
     * Flips to true once any probe contributes a fix-pass score, gating `pass2Scores` on the entry.
     */
    let hasPass2 = false;

    for (const [probeName, artifact,] of probes) {
      /**
       * Enriched metadata for the initial pass, or undefined if the artifact is raw.
       */
      const enriched = isEnriched(artifact.meta,) ? artifact.meta : undefined;
      probeScores[probeName] = enriched?.score
        ?? 0;
      if (enriched?.config
        !== undefined)
        ({ config, } = enriched);

      /**
       * Matching fix-pass artifact for this probe, if a fix run produced one.
       */
      const fix = fixes.get(probeName,);
      /**
       * Enriched fix-pass metadata, or undefined when the fix artifact is missing or raw.
       */
      const fixEnriched = (fix !== undefined) && isEnriched(fix.meta,)
        ? fix.meta
        : undefined;
      if (fixEnriched?.score
        !== undefined) {
        pass2Scores[probeName] = fixEnriched.score;
        hasPass2 = true;
      }

      probeDetails.set(
        probeKey({
          label,
          probe: probeName,
          timestamp,
        },),
        buildProbeDetail({
          artifact,
          ...(enriched !== undefined ? { enriched, } : {}),
          ...(fixEnriched !== undefined ? { fixEnriched, } : {}),
          ...(fix !== undefined ? { fix, } : {}),
        },),
      );
    }

    /**
     * Initial-pass scores collected from `probeScores`; averaged below for the run summary.
     */
    const scores = Object.values(probeScores,);
    /**
     * Mean of `scores`; zero when no probes contributed, used as the run's headline score.
     */
    const overallScore = scores.length
      > 0
      ? scores.reduce(
        function addScore(
          sum,
          score,
        ) {
          return sum + score;
        },
        0,
      )
        / scores
        .length
      : 0;

    entries.push({
      timestamp,
      model,
      label,
      overallScore,
      probeScores,
      ...(hasPass2 ? { pass2Scores, } : {}),
      failed: false,
      ...(config !== undefined ? { config, } : {}),
    },);
  }

  for (const failure of failures) {
    entries.push({
      timestamp: failure.timestamp,
      model: failure.model,
      label: failure.label,
      overallScore: 0,
      probeScores: {},
      failed: true,
      error: failure.error,
      config: failure.config,
    },);
  }

  entries.sort(function byTimestamp(
    a,
    b,
  ) {
    return a.timestamp
      .localeCompare(b.timestamp,);
  },);

  console.error(
    `[viewer] loaded ${String(entries.length,)} runs, ${
      String(probeDetails.size,)
    } probe details`,
  );
  return {
    entries,
    probeDetails,
  };
}
