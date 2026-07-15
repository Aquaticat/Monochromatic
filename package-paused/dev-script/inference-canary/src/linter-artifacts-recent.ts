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
  isRecentTimestamp,
  NO_MATCH,
  parseArtifactDir,
  parseFailureDir,
  type RecentArtifactScan,
  TWENTY_FOUR_HOURS_MS,
} from './linter-artifacts-timestamp.ts';
import {
  LINT_DIR,
  type StoredArtifactMeta,
  type StoredFailureArtifactMeta,
} from './linter-artifacts.ts';

export type { RecentArtifactScan, };

/**
 * Reads the model directory names under {@link LINT_DIR}.
 * Returns an empty array when the directory is missing or unreadable, which the
 * caller treats identically to an empty directory (no recent artifacts).
 *
 * @returns model directory names, or empty array when the directory cannot be read
 *
 * @example
 * ```ts
 * const dirs = await readModelDirs();
 * ```
 */
async function readModelDirs(): Promise<string[]> {
  try {
    return await readdir(LINT_DIR,);
  }
  catch {
    return [];
  }
}

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
  /**
   * Lower bound for "recent" in epoch ms; artifacts older than this are ignored.
   */
  const cutoff = Date.now()
    - TWENTY_FOUR_HOURS_MS;
  /**
   * Per-model set of probe names that already have a recent initial-pass artifact.
   */
  const probePairs = new Map<string, Set<string>>();
  /**
   * Model labels with a recent whole-model failure (e.g. 429); all probes are skipped for these.
   */
  const failedModels = new Set<string>();

  /**
   * Names of model directories under {@link LINT_DIR}; empty when the directory is missing or unreadable.
   */
  const modelDirs = await readModelDirs();

  for (const modelDir of modelDirs) {
    /**
     * Absolute path to one model's artifact directory; used as the base for nested artifact scans.
     */
    const modelPath = join(
      LINT_DIR,
      modelDir,
    );
    /**
     * Names of per-run artifact subdirectories under the current model; empty when readdir fails.
     */
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
      /**
       * Parsed `failure-<timestamp>` directory parts; {@link NO_MATCH} when the dir is a per-probe artifact.
       */
      const failureParts = parseFailureDir(dirName,);
      if (failureParts !== NO_MATCH) {
        /**
         * Timestamp segment captured from the failure directory name; checked against {@link cutoff} for recency.
         */
        const rawTimestamp = failureParts.timestamp;
        if (isRecentTimestamp({
          rawTimestamp,
          cutoff,
        },)) {
          /**
           * Path to the failure artifact's meta.json; read to recover the original model label.
           */
          const metaPath = join(
            modelPath,
            dirName,
            'meta.json',
          );
          try {
            /**
             * Raw JSON text of the failure meta file before parsing.
             */
            // oxlint-disable-next-line no-await-in-loop -- sequential meta.json reads within nested artifact scan
            const metaRaw = await readFile(
              metaPath,
              'utf8',
            );
            /**
             * Parsed failure meta; partial because old artifacts may predate newer fields.
             */
            // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON from meta.json has known shape
            const meta = JSON.parse(metaRaw,) as StoredFailureArtifactMeta;
            /**
             * Display label for the model; falls back to the directory name when meta has none.
             */
            const label = meta.label
              ?? modelDir;
            if (meta.failed
              === true)
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
      /**
       * Parsed per-probe artifact directory parts; {@link NO_MATCH} when the dir is unrelated.
       */
      const parts = parseArtifactDir(dirName,);
      if (parts === NO_MATCH)
        continue;
      if (parts.pass
        !== 'initial')
        continue;

      /**
       * Timestamp segment captured from the artifact directory name; checked against {@link cutoff}.
       */
      const rawTimestamp = parts.timestamp;
      if (!isRecentTimestamp({
        rawTimestamp,
        cutoff,
      },)) {
        continue;
      }

      /**
       * Path to the probe artifact's meta.json; needed to resolve the model's display label and the probe name.
       */
      const metaPath = join(
        modelPath,
        dirName,
        'meta.json',
      );
      try {
        /**
         * Raw JSON text of the probe meta file before parsing.
         */
        // oxlint-disable-next-line no-await-in-loop -- sequential meta.json reads within nested artifact scan
        const metaRaw = await readFile(
          metaPath,
          'utf8',
        );
        /**
         * Parsed probe meta; partial because old artifacts may omit `label` or other newer fields.
         */
        // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- JSON from meta.json has known shape
        const meta = JSON.parse(metaRaw,) as StoredArtifactMeta;
        /**
         * Display label for the model; falls back to the directory name for legacy artifacts.
         */
        const label = meta.label
          ?? modelDir;
        /**
         * Probe name extracted from the artifact meta; runs are skipped when missing.
         */
        const {
          probe,
        } = meta;
        if (probe === undefined)
          continue;
        /**
         * Existing probe set for this model label, or a fresh set when this is the first hit.
         */
        const existing = probePairs.get(label,)
          ?? new Set<string>();
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
