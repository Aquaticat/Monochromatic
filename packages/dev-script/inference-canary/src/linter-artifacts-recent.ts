/**
 * Recent artifact scanning.
 *
 * Scans `src/canary-lint/` directories to find model:probe pairs tested within
 * the last 24 hours, allowing the runner to skip recently-tested combinations.
 * Also detects whole-model failure artifacts so the runner can skip all probes
 * for models that recently failed entirely (e.g. 429 errors).
 */
import {
  readdir,
  readFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

import {
  ARTIFACT_DIR_PATTERN,
  FAILURE_DIR_PATTERN,
  isRecentTimestamp,
  type RecentArtifactScan,
  TWENTY_FOUR_HOURS_MS,
} from './linter-artifacts-timestamp.ts';
import {
  type ArtifactMeta,
  type FailureArtifactMeta,
  LINT_DIR,
} from './linter-artifacts.ts';

export type { RecentArtifactScan, };

/**
 * Scans artifact directories to find model:probe pairs tested within the last 24 hours.
 *
 * Derives recent results directly from artifact directory timestamps.
 * Only considers initial-pass artifacts (fix-pass artifacts always accompany an initial).
 * Also detects whole-model failure artifacts (`failure-<timestamp>`) so the runner
 * can skip all probes for models that recently failed entirely (e.g. 429 errors).
 *
 * @returns scan result with per-probe pairs and whole-model failure labels
 *
 * @example
 * ```ts
 * const scan = await getRecentArtifactPairs();
 * scan.probePairs.get('Opus 4.6')?.has('sudoku-solver');
 * ```
 */
export async function getRecentArtifactPairs(): Promise<RecentArtifactScan> {
  /** Lower bound for "recent" in epoch ms; artifacts older than this are ignored. */
  const cutoff = Date.now() - TWENTY_FOUR_HOURS_MS;
  /** Per-model set of probe names that already have a recent initial-pass artifact. */
  const probePairs = new Map<string, Set<string>>();
  /** Model labels with a recent whole-model failure (e.g. 429); all probes are skipped for these. */
  const failedModels = new Set<string>();

  /**
   * Names of model directories under {@link LINT_DIR}; `undefined` when the directory is missing.
   */
  const modelDirs = await (async function tryReadModelDirs(): Promise<string[] | undefined> {
    try {
      return await readdir(LINT_DIR,);
    }
    catch {
      return undefined;
    }
  })();
  if (modelDirs === undefined) {
    return {
      probePairs,
      failedModels,
    };
  }

  for (const modelDir of modelDirs) {
    /** Absolute path to one model's artifact directory; used as the base for nested artifact scans. */
    const modelPath = join(
      LINT_DIR,
      modelDir,
    );
    /** Names of per-run artifact subdirectories under the current model; empty when readdir fails. */
    let artifactDirs: string[] = [];
    try {
      // oxlint-disable-next-line no-await-in-loop -- sequential directory reads per model
      artifactDirs = await readdir(modelPath,);
    }
    catch {
      continue;
    }

    for (const dirName of artifactDirs) {
      //region Failure artifact detection: whole-model failures like 429 or auth errors
      /** Regex match for the `failure-<timestamp>` directory naming convention; null when the dir is a per-probe artifact. */
      const failureMatch = FAILURE_DIR_PATTERN.exec(dirName,);
      if ((failureMatch !== null) && (failureMatch.groups !== undefined)) {
        /**
         * Timestamp segment captured from the failure directory name; checked against {@link cutoff} for recency.
         */
        const rawTimestamp = failureMatch.groups['timestamp'];
        if ((rawTimestamp !== undefined) && isRecentTimestamp({
          rawTimestamp,
          cutoff,
        },)) {
          /** Path to the failure artifact's meta.json; read to recover the original model label. */
          const metaPath = join(
            modelPath,
            dirName,
            'meta.json',
          );
          try {
            /** Raw JSON text of the failure meta file before parsing. */
            // oxlint-disable-next-line no-await-in-loop -- sequential meta.json reads within nested artifact scan
            const metaRaw = await readFile(
              metaPath,
              'utf8',
            );
            /** Parsed failure meta; partial because old artifacts may predate newer fields. */
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON from meta.json has known shape
            const meta = JSON.parse(metaRaw,) as Partial<FailureArtifactMeta>;
            /** Display label for the model; falls back to the directory name when meta has none. */
            const label = meta.label ?? modelDir;
            if (meta.failed === true)
              failedModels.add(label,);
          }
          catch {
            // Missing or malformed meta.json: skip
          }
        }
        continue;
      }
      //endregion Failure artifact detection

      //region Per-probe artifact detection: individual probe results
      /** Regex match for the per-probe artifact directory naming convention; null when the dir is unrelated. */
      const match = ARTIFACT_DIR_PATTERN.exec(dirName,);
      if ((match === null) || (match.groups === undefined))
        continue;
      if (match.groups['pass'] !== 'initial')
        continue;

      /**
       * Timestamp segment captured from the artifact directory name; checked against {@link cutoff}.
       */
      const rawTimestamp = match.groups['timestamp'];
      if (rawTimestamp === undefined)
        continue;
      if (!isRecentTimestamp({
        rawTimestamp,
        cutoff,
      },)) {
        continue;
      }

      /** Path to the probe artifact's meta.json; needed to resolve the model's display label and the probe name. */
      const metaPath = join(
        modelPath,
        dirName,
        'meta.json',
      );
      try {
        /** Raw JSON text of the probe meta file before parsing. */
        // oxlint-disable-next-line no-await-in-loop -- sequential meta.json reads within nested artifact scan
        const metaRaw = await readFile(
          metaPath,
          'utf8',
        );
        /** Parsed probe meta; partial because old artifacts may omit `label` or other newer fields. */
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON from meta.json has known shape
        const meta = JSON.parse(metaRaw,) as Partial<ArtifactMeta>;
        /** Display label for the model; falls back to the directory name for legacy artifacts. */
        const label = meta.label ?? modelDir;
        /** Probe name extracted from the artifact meta; runs are skipped when missing. */
        const {
          probe,
        } = meta;
        if (probe === undefined)
          continue;
        /** Existing probe set for this model label, or a fresh set when this is the first hit. */
        const existing = probePairs.get(label,) ?? new Set<string>();
        existing.add(probe,);
        probePairs.set(
          label,
          existing,
        );
      }
      catch {
        // Missing or malformed meta.json; skip
      }
      //endregion Per-probe artifact detection
    }
  }

  return {
    probePairs,
    failedModels,
  };
}
